import { createHmac } from 'crypto';

// PrismaService kéo theo prisma/seed.ts (tạo PrismaClient thật khi import); test này dùng DB giả nên chặn lại.
jest.mock('../src/prisma/prisma.service', () => ({ PrismaService: class {} }));

import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import {
  buildVnpayPaymentUrl,
  formatVnpayDate,
  normalizeClientIp,
  sanitizeOrderInfo,
  verifyVnpayQuery,
} from '../src/payments/vnpay/vnpay.client';
import { VnpayPaymentsService } from '../src/payments/vnpay/vnpay-payments.service';
import { getPaymentProvider, isMockPaymentEnabled } from '../src/payments/payment-config';
import { VnpayConfig } from '../src/payments/payment-config';

const SECRET = 'TEST_HASH_SECRET_0123456789';
const config: VnpayConfig = {
  tmnCode: 'TESTTMN1',
  hashSecret: SECRET,
  payUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  publicBaseUrl: 'https://abc.example.test',
  frontendUrl: 'http://localhost:3000',
  qrTtlMinutes: 10,
};

// Bản ký độc lập (viết lại theo đặc tả VNPay) để kiểm chéo với hàm trong code.
function referenceSign(params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');
  return createHmac('sha512', SECRET).update(Buffer.from(data, 'utf-8')).digest('hex');
}

function signedCallback(fields: Record<string, string>): Record<string, string> {
  return { ...fields, vnp_SecureHash: referenceSign(fields) };
}

describe('VNPay client (chữ ký, URL, định dạng)', () => {
  it('định dạng ngày theo giờ Việt Nam GMT+7', () => {
    expect(formatVnpayDate(new Date('2026-11-25T17:30:05Z'))).toBe('20261126003005');
    expect(formatVnpayDate(new Date('2026-01-01T00:00:00Z'))).toBe('20260101070000');
  });

  it('dựng URL: đủ tham số, số tiền nhân 100, chữ ký khớp bản tham chiếu', () => {
    const createdAt = new Date('2026-11-25T03:00:00Z');
    const url = buildVnpayPaymentUrl(config, {
      txnRef: 'BL20261125100000ABCDEF',
      amountVnd: 45000,
      orderInfo: 'Thanh toán đơn hàng #A2B3C',
      ipAddr: '127.0.0.1',
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(config.payUrl);
    const q = Object.fromEntries(parsed.searchParams.entries());
    expect(q.vnp_Amount).toBe('4500000');
    expect(q.vnp_TmnCode).toBe('TESTTMN1');
    expect(q.vnp_TxnRef).toBe('BL20261125100000ABCDEF');
    expect(q.vnp_ReturnUrl).toBe('https://abc.example.test/payments/vnpay/return');
    expect(q.vnp_CreateDate).toBe('20261125100000');
    expect(q.vnp_ExpireDate).toBe('20261125101000');
    expect(q.vnp_OrderInfo).toBe('Thanh toan don hang A2B3C');

    const { vnp_SecureHash, ...rest } = q;
    expect(vnp_SecureHash).toBe(referenceSign(rest));
    // Chính URL mình dựng phải tự xác thực được (cùng thuật toán với chiều VNPay gọi về).
    expect(verifyVnpayQuery(config, q)).toBe(true);
  });

  it('verify: sai khi bị sửa tham số, thiếu chữ ký, sai secret hoặc tham số dạng mảng', () => {
    const good = signedCallback({ vnp_TxnRef: 'X1', vnp_Amount: '1000000', vnp_ResponseCode: '00' });
    expect(verifyVnpayQuery(config, good)).toBe(true);
    expect(verifyVnpayQuery(config, { ...good, vnp_Amount: '100' })).toBe(false);
    const noHash: Record<string, string> = { ...good };
    delete noHash.vnp_SecureHash;
    expect(verifyVnpayQuery(config, noHash)).toBe(false);
    expect(verifyVnpayQuery({ ...config, hashSecret: 'other' }, good)).toBe(false);
    expect(verifyVnpayQuery(config, { ...good, vnp_TxnRef: ['X1', 'X2'] })).toBe(false);
  });

  it('verify: không phân biệt hoa/thường của chữ ký và bỏ qua vnp_SecureHashType', () => {
    const good = signedCallback({ vnp_TxnRef: 'X1', vnp_Amount: '1000000' });
    expect(
      verifyVnpayQuery(config, {
        ...good,
        vnp_SecureHash: good.vnp_SecureHash.toUpperCase(),
        vnp_SecureHashType: 'HmacSHA512',
      }),
    ).toBe(true);
  });

  it('làm sạch OrderInfo và chuẩn hóa IP', () => {
    expect(sanitizeOrderInfo('Đơn #A1 & "Cà phê"')).toBe('Don A1 Ca phe');
    expect(normalizeClientIp('::1')).toBe('127.0.0.1');
    expect(normalizeClientIp('::ffff:10.0.0.5')).toBe('10.0.0.5');
    expect(normalizeClientIp('203.0.113.9, 10.0.0.1')).toBe('203.0.113.9');
    expect(normalizeClientIp(undefined)).toBe('127.0.0.1');
  });
});

describe('Chọn cổng thanh toán theo môi trường', () => {
  const saved = process.env.PAYMENT_PROVIDER;
  afterEach(() => {
    if (saved === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = saved;
  });

  it('mặc định là mock, bật vnpay thì mock tắt, giá trị lạ thì báo lỗi chứ không rơi về mock', () => {
    delete process.env.PAYMENT_PROVIDER;
    expect(getPaymentProvider()).toBe('mock');
    expect(isMockPaymentEnabled()).toBe(true);
    process.env.PAYMENT_PROVIDER = 'VNPAY';
    expect(getPaymentProvider()).toBe('vnpay');
    expect(isMockPaymentEnabled()).toBe(false);
    process.env.PAYMENT_PROVIDER = 'vnpai';
    expect(() => getPaymentProvider()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Service với DB giả trong bộ nhớ
// ---------------------------------------------------------------------------
type Row = Record<string, any>;

function makeFakePrisma(seed: { orders: Row[]; users: Row[]; payments?: Row[] }) {
  const db = {
    orders: seed.orders.map((o) => ({ ...o })),
    users: seed.users.map((u) => ({ ...u })),
    payments: (seed.payments ?? []).map((p) => ({ ...p })),
    loyalty: [] as Row[],
  };
  let seq = 0;
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('gt' in v) return row[k] && row[k] > v.gt;
        if ('not' in v) return row[k] !== v.not && row[k] !== undefined && row[k] !== null;
      }
      return row[k] === v;
    });

  const prisma: any = {
    _db: db,
    order: {
      findUnique: async ({ where }: Row) => db.orders.find((o) => o.id === where.id) ?? null,
      updateMany: async ({ where, data }: Row) => {
        const rows = db.orders.filter((o) => matches(o, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
    payment: {
      findUnique: async ({ where }: Row) =>
        db.payments.find((p) => (where.id ? p.id === where.id : p.txnRef === where.txnRef)) ?? null,
      findFirst: async ({ where }: Row) =>
        [...db.payments].reverse().find((p) => matches(p, where)) ?? null,
      create: async ({ data }: Row) => {
        const row = { id: `pay-${++seq}`, createdAt: new Date(), ...data };
        db.payments.push(row);
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        const rows = db.payments.filter((p) => matches(p, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: Row) => {
        const row = db.payments.find((p) => p.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    user: {
      findUnique: async ({ where }: Row) => db.users.find((u) => u.id === where.id) ?? null,
      update: async ({ where, data }: Row) => {
        const u = db.users.find((x) => x.id === where.id)!;
        if (data.loyaltyPoints?.increment) u.loyaltyPoints += data.loyaltyPoints.increment;
        return u;
      },
    },
    loyaltyTransaction: {
      create: async ({ data }: Row) => {
        db.loyalty.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(prisma),
  };
  return prisma;
}

describe('VnpayPaymentsService', () => {
  const customer = { id: 'u1', email: 'a@b.c', role: UserRole.CUSTOMER, fullName: 'A' };
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.PAYMENT_PROVIDER = 'vnpay';
    process.env.VNPAY_TMN_CODE = config.tmnCode;
    process.env.VNPAY_HASH_SECRET = SECRET;
    process.env.API_PUBLIC_URL = config.publicBaseUrl;
    process.env.FRONTEND_URL = config.frontendUrl;
    process.env.VNPAY_QR_TTL_MINUTES = '10';
  });
  afterEach(() => {
    process.env = { ...envBackup };
  });

  const baseOrder = (over: Row = {}) => ({
    id: 'o1',
    orderCode: '#AB12C',
    userId: 'u1',
    status: OrderStatus.PENDING,
    total: 50000,
    ...over,
  });
  const baseUser = (over: Row = {}) => ({ id: 'u1', role: UserRole.CUSTOMER, loyaltyPoints: 0, ...over });

  describe('createPayment', () => {
    it('tạo bản ghi PENDING kèm URL đã ký; gọi lại khi mã còn hạn thì trả đúng mã cũ', async () => {
      const prisma = makeFakePrisma({ orders: [baseOrder()], users: [baseUser()] });
      const service = new VnpayPaymentsService(prisma);

      const first = await service.createPayment(customer, 'o1', '::1');
      expect(first.amount).toBe(50000);
      expect(prisma._db.payments).toHaveLength(1);
      expect(prisma._db.payments[0]).toMatchObject({
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
        amount: 50000,
        txnRef: first.txnRef,
      });
      const q = Object.fromEntries(new URL(first.paymentUrl).searchParams.entries());
      expect(q.vnp_Amount).toBe('5000000');
      expect(verifyVnpayQuery(config, q)).toBe(true);

      const second = await service.createPayment(customer, 'o1', '::1');
      expect(second.txnRef).toBe(first.txnRef);
      expect(prisma._db.payments).toHaveLength(1);
    });

    it('mã đã hết hạn thì tạo mã mới', async () => {
      const prisma = makeFakePrisma({
        orders: [baseOrder()],
        users: [baseUser()],
        payments: [
          {
            id: 'old',
            orderId: 'o1',
            method: PaymentMethod.VNPAY,
            status: PaymentStatus.PENDING,
            amount: 50000,
            txnRef: 'OLD',
            paymentUrl: 'https://x',
            expiresAt: new Date(Date.now() - 1000),
            createdAt: new Date(Date.now() - 600000),
          },
        ],
      });
      const created = await new VnpayPaymentsService(prisma).createPayment(customer, 'o1');
      expect(created.txnRef).not.toBe('OLD');
      expect(prisma._db.payments).toHaveLength(2);
    });

    it('từ chối: không phải chủ đơn, đơn đã hủy, dưới 5.000đ, admin, hoặc provider đang là mock', async () => {
      const mk = (o: Row) => new VnpayPaymentsService(makeFakePrisma({ orders: [o], users: [baseUser()] }));
      await expect(mk(baseOrder({ userId: 'other' })).createPayment(customer, 'o1')).rejects.toThrow('không có quyền');
      await expect(mk(baseOrder({ status: OrderStatus.CANCELLED })).createPayment(customer, 'o1')).rejects.toThrow(
        'không còn ở trạng thái chờ thanh toán',
      );
      await expect(mk(baseOrder({ total: 4999 })).createPayment(customer, 'o1')).rejects.toThrow('5.000');
      await expect(
        mk(baseOrder()).createPayment({ ...customer, role: UserRole.ADMIN }, 'o1'),
      ).rejects.toThrow('quản trị');
      process.env.PAYMENT_PROVIDER = 'mock';
      await expect(mk(baseOrder()).createPayment(customer, 'o1')).rejects.toThrow('chưa được bật');
    });
  });

  describe('handleCallback', () => {
    const pendingPayment = (over: Row = {}) => ({
      id: 'p1',
      orderId: 'o1',
      method: PaymentMethod.VNPAY,
      status: PaymentStatus.PENDING,
      amount: 50000,
      txnRef: 'TXN1',
      errorMessage: null,
      ...over,
    });
    const callback = (over: Record<string, string> = {}) =>
      signedCallback({
        vnp_TxnRef: 'TXN1',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_TransactionNo: '14000001',
        ...over,
      });

    it('thanh toán thành công: đơn PAID, tích 5% điểm, giao dịch SUCCESS', async () => {
      const prisma = makeFakePrisma({
        orders: [baseOrder()],
        users: [baseUser()],
        payments: [pendingPayment()],
      });
      const result = await new VnpayPaymentsService(prisma).handleCallback(callback());

      expect(result).toMatchObject({ rspCode: '00', outcome: 'paid', orderId: 'o1' });
      expect(prisma._db.orders[0].status).toBe(OrderStatus.PAID);
      expect(prisma._db.payments[0]).toMatchObject({
        status: PaymentStatus.SUCCESS,
        transactionRef: '14000001',
        gatewayCode: '00',
      });
      expect(prisma._db.users[0].loyaltyPoints).toBe(2500);
      expect(prisma._db.loyalty).toHaveLength(1);
    });

    it('IPN gửi lại / Return đến sau IPN: không tích điểm lần hai, trả 02', async () => {
      const prisma = makeFakePrisma({
        orders: [baseOrder()],
        users: [baseUser()],
        payments: [pendingPayment()],
      });
      const service = new VnpayPaymentsService(prisma);
      await service.handleCallback(callback());
      const again = await service.handleCallback(callback());

      expect(again).toMatchObject({ rspCode: '02', outcome: 'paid' });
      expect(prisma._db.users[0].loyaltyPoints).toBe(2500);
      expect(prisma._db.loyalty).toHaveLength(1);
    });

    it('sai chữ ký (97), không có giao dịch (01), sai số tiền (04): không đổi trạng thái', async () => {
      const prisma = makeFakePrisma({
        orders: [baseOrder()],
        users: [baseUser()],
        payments: [pendingPayment()],
      });
      const service = new VnpayPaymentsService(prisma);

      expect(await service.handleCallback({ ...callback(), vnp_Amount: '100' })).toMatchObject({ rspCode: '97' });
      expect(await service.handleCallback(callback({ vnp_TxnRef: 'NOPE' }))).toMatchObject({ rspCode: '01' });
      expect(await service.handleCallback(callback({ vnp_Amount: '100' }))).toMatchObject({ rspCode: '04' });

      expect(prisma._db.orders[0].status).toBe(OrderStatus.PENDING);
      expect(prisma._db.payments[0].status).toBe(PaymentStatus.PENDING);
    });

    it('khách hủy trên VNPay (mã 24): giao dịch FAILED, đơn PAYMENT_FAILED để thanh toán lại', async () => {
      const prisma = makeFakePrisma({
        orders: [baseOrder()],
        users: [baseUser()],
        payments: [pendingPayment()],
      });
      const result = await new VnpayPaymentsService(prisma).handleCallback(
        callback({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }),
      );

      expect(result).toMatchObject({ rspCode: '00', outcome: 'failed' });
      expect(prisma._db.orders[0].status).toBe(OrderStatus.PAYMENT_FAILED);
      expect(prisma._db.payments[0].status).toBe(PaymentStatus.FAILED);
      expect(prisma._db.payments[0].errorMessage).toContain('hủy');
      expect(prisma._db.users[0].loyaltyPoints).toBe(0);
    });

    it('thanh toán xong sau khi thất bại trước đó: PAYMENT_FAILED → PAID', async () => {
      const prisma = makeFakePrisma({
        orders: [baseOrder({ status: OrderStatus.PAYMENT_FAILED })],
        users: [baseUser()],
        payments: [pendingPayment()],
      });
      const result = await new VnpayPaymentsService(prisma).handleCallback(callback());
      expect(result.outcome).toBe('paid');
      expect(prisma._db.orders[0].status).toBe(OrderStatus.PAID);
    });

    it('tiền về nhưng đơn đã hủy: không sống lại đơn, không tích điểm, ghi chú đối soát', async () => {
      const prisma = makeFakePrisma({
        orders: [baseOrder({ status: OrderStatus.CANCELLED })],
        users: [baseUser()],
        payments: [pendingPayment()],
      });
      const service = new VnpayPaymentsService(prisma);
      const result = await service.handleCallback(callback());

      expect(result).toMatchObject({ rspCode: '00', outcome: 'paid_unapplied' });
      expect(prisma._db.orders[0].status).toBe(OrderStatus.CANCELLED);
      expect(prisma._db.payments[0].status).toBe(PaymentStatus.SUCCESS);
      expect(prisma._db.payments[0].errorMessage).toContain('hoàn tiền thủ công');
      expect(prisma._db.users[0].loyaltyPoints).toBe(0);

      const replay = await service.handleCallback(callback());
      expect(replay).toMatchObject({ rspCode: '02', outcome: 'paid_unapplied' });
    });

    it('lỗi bất ngờ khi ghi nhận: trả 99 để VNPay gửi lại IPN', async () => {
      const prisma = makeFakePrisma({
        orders: [baseOrder()],
        users: [baseUser()],
        payments: [pendingPayment()],
      });
      prisma.$transaction = async () => {
        throw new Error('db down');
      };
      const result = await new VnpayPaymentsService(prisma).handleCallback(callback());
      expect(result).toMatchObject({ rspCode: '99' });
    });
  });
});
