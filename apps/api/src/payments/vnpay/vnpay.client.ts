import { createHmac, timingSafeEqual } from 'crypto';
import { VnpayConfig } from '../payment-config';

// Phần thuần (không DB, không Nest) của tích hợp VNPay 2.1.0: dựng URL thanh toán có chữ ký
// và xác thực chữ ký của Return/IPN. Tách riêng để kiểm thử độc lập.

const VNP_VERSION = '2.1.0';
const SIGNATURE_FIELDS = ['vnp_SecureHash', 'vnp_SecureHashType'];

/** VNPay ký trên chuỗi đã encode kiểu form (khoảng trắng thành "+"). */
function encodeValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function buildSignedString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeValue(key)}=${encodeValue(params[key])}`)
    .join('&');
}

function sign(secret: string, data: string): string {
  return createHmac('sha512', secret).update(Buffer.from(data, 'utf-8')).digest('hex');
}

/** yyyyMMddHHmmss theo giờ Việt Nam (GMT+7), đúng định dạng VNPay yêu cầu. */
export function formatVnpayDate(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    pad(shifted.getUTCFullYear(), 4) +
    pad(shifted.getUTCMonth() + 1) +
    pad(shifted.getUTCDate()) +
    pad(shifted.getUTCHours()) +
    pad(shifted.getUTCMinutes()) +
    pad(shifted.getUTCSeconds())
  );
}

/** Nội dung hiển thị trên trang VNPay: chỉ giữ chữ không dấu, số, khoảng trắng để chữ ký không lệch. */
export function sanitizeOrderInfo(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function normalizeClientIp(raw?: string | null): string {
  const first = (raw || '').split(',')[0].trim().replace(/^::ffff:/, '');
  if (!first || first === '::1') return '127.0.0.1';
  return first;
}

export interface BuildPaymentUrlInput {
  txnRef: string;
  amountVnd: number;
  orderInfo: string;
  ipAddr: string;
  createdAt: Date;
  expiresAt: Date;
}

export function buildVnpayPaymentUrl(config: VnpayConfig, input: BuildPaymentUrlInput): string {
  const params: Record<string, string> = {
    vnp_Version: VNP_VERSION,
    vnp_Command: 'pay',
    vnp_TmnCode: config.tmnCode,
    // VNPay tính theo đơn vị nhỏ nhất: nhân 100 với tiền VND.
    vnp_Amount: String(Math.round(input.amountVnd) * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: sanitizeOrderInfo(input.orderInfo),
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: `${config.publicBaseUrl}/payments/vnpay/return`,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: formatVnpayDate(input.createdAt),
    vnp_ExpireDate: formatVnpayDate(input.expiresAt),
  };

  const signedString = buildSignedString(params);
  const secureHash = sign(config.hashSecret, signedString);
  return `${config.payUrl}?${signedString}&vnp_SecureHash=${secureHash}`;
}

/**
 * Xác thực chữ ký của query mà VNPay gửi về (Return hoặc IPN).
 * Từ chối nếu có tham số lặp/lồng nhau (query dạng mảng/object) vì VNPay không bao giờ gửi như vậy.
 */
export function verifyVnpayQuery(config: VnpayConfig, query: Record<string, unknown>): boolean {
  const received = query?.vnp_SecureHash;
  if (typeof received !== 'string' || received.length === 0) return false;

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith('vnp_') || SIGNATURE_FIELDS.includes(key)) continue;
    if (typeof value !== 'string') return false;
    params[key] = value;
  }

  const expected = sign(config.hashSecret, buildSignedString(params));
  const a = Buffer.from(expected.toLowerCase(), 'utf-8');
  const b = Buffer.from(received.toLowerCase(), 'utf-8');
  return a.length === b.length && timingSafeEqual(a, b);
}

const RESPONSE_CODE_MESSAGES: Record<string, string> = {
  '07': 'Giao dịch bị nghi ngờ gian lận, VNPay đã tạm giữ để kiểm tra',
  '09': 'Thẻ/tài khoản chưa đăng ký dịch vụ Internet Banking',
  '10': 'Xác thực thông tin thẻ/tài khoản sai quá 3 lần',
  '11': 'Đã hết thời gian chờ thanh toán, vui lòng tạo mã mới',
  '12': 'Thẻ/tài khoản đang bị khóa',
  '13': 'Nhập sai mật khẩu xác thực giao dịch (OTP)',
  '24': 'Bạn đã hủy giao dịch trên cổng VNPay',
  '51': 'Tài khoản không đủ số dư để thanh toán',
  '65': 'Tài khoản đã vượt hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
  '99': 'Lỗi không xác định từ cổng VNPay',
};

export function describeVnpayFailure(responseCode: string | undefined): string {
  const known = responseCode ? RESPONSE_CODE_MESSAGES[responseCode] : undefined;
  return known ?? `Thanh toán VNPay không thành công (mã ${responseCode || 'không rõ'})`;
}
