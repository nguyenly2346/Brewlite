// Cấu hình cổng thanh toán đọc từ biến môi trường tại thời điểm gọi (không cache),
// để test đổi env được và để cấu hình sai bị phát hiện ngay khi khởi động.

export type PaymentProvider = 'mock' | 'vnpay';

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  payUrl: string;
  /** Origin công khai của backend mà trình duyệt/VNPay truy cập được (không kèm đường dẫn). */
  publicBaseUrl: string;
  /** Origin của website để chuyển khách về sau khi thanh toán. */
  frontendUrl: string;
  /** Thời hạn mã QR / link thanh toán (phút). */
  qrTtlMinutes: number;
}

export const VNPAY_SANDBOX_PAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

function stripTrailingSlash(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getPaymentProvider(): PaymentProvider {
  const raw = (process.env.PAYMENT_PROVIDER || 'mock').trim().toLowerCase();
  if (raw === 'mock' || raw === 'vnpay') return raw;
  // Không âm thầm rơi về mock: gõ sai tên provider trên môi trường thật sẽ thành "thanh toán miễn phí".
  throw new Error(`PAYMENT_PROVIDER không hợp lệ: "${raw}" (chỉ nhận "mock" hoặc "vnpay")`);
}

export function isMockPaymentEnabled(): boolean {
  return getPaymentProvider() === 'mock';
}

export function getVnpayConfig(): VnpayConfig {
  const tmnCode = (process.env.VNPAY_TMN_CODE || '').trim();
  const hashSecret = (process.env.VNPAY_HASH_SECRET || '').trim();
  const missing: string[] = [];
  if (!tmnCode) missing.push('VNPAY_TMN_CODE');
  if (!hashSecret) missing.push('VNPAY_HASH_SECRET');
  if (missing.length > 0) {
    throw new Error(`Thiếu cấu hình VNPay: ${missing.join(', ')}`);
  }

  const port = process.env.PORT || '4000';
  const ttl = Number(process.env.VNPAY_QR_TTL_MINUTES || 10);

  return {
    tmnCode,
    hashSecret,
    payUrl: (process.env.VNPAY_PAY_URL || VNPAY_SANDBOX_PAY_URL).trim(),
    publicBaseUrl: stripTrailingSlash(process.env.API_PUBLIC_URL || `http://localhost:${port}`),
    frontendUrl: stripTrailingSlash(process.env.FRONTEND_URL || 'http://localhost:3000'),
    qrTtlMinutes: Number.isFinite(ttl) && ttl >= 1 && ttl <= 60 ? Math.floor(ttl) : 10,
  };
}

/** Gọi lúc khởi động: provider = vnpay mà thiếu khóa thì dừng app thay vì lỗi lúc khách thanh toán. */
export function assertPaymentConfigValid(): void {
  if (getPaymentProvider() === 'vnpay') {
    getVnpayConfig();
  }
}
