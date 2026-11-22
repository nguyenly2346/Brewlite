/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsService } from '../src/payments/payments.service';
import { PromotionsService } from '../src/promotions/promotions.service';
import { MockPaymentGateway } from '../src/payments/gateways/mock-payment.gateway';
import { CreateOrderDto } from '../src/orders/orders.dto';
import { ProcessPaymentDto } from '../src/payments/payments.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthenticatedUser } from '../src/common/decorators';

const FUTURE = new Date(Date.now() + 24 * 3600 * 1000);
const PAST = new Date(Date.now() - 24 * 3600 * 1000);

const BREWLITE10 = {
  code: 'BREWLITE10',
  description: 'Giảm 10%',
  isActive: true,
  expiresAt: FUTURE,
  minOrderValue: 40000,
  discountPercent: 10,
  maxDiscountAmount: 20000,
};
const CHAOBANMOI = {
  ...BREWLITE10,
  code: 'CHAOBANMOI',
  minOrderValue: 80000,
  discountPercent: 20,
  maxDiscountAmount: 30000,
};

const customer: AuthenticatedUser = {
  id: 'u-customer',
  email: 'khachhang@brewlite.vn',
  role: UserRole.CUSTOMER,
  fullName: 'Khách',
} as AuthenticatedUser;
const admin: AuthenticatedUser = { ...customer, id: 'u-admin', role: UserRole.ADMIN } as AuthenticatedUser;

/* ------------------------------------------------------------------ */
/* Helper: OrdersService với Prisma giả                                */
/* ------------------------------------------------------------------ */
function makeOrders(
  opts: { products?: Record<string, any>; toppings?: any[]; promo?: any; user?: any; reserve?: (call: number) => number } = {},
) {
  let reserveCalls = 0;
  // updateMany giữ chỗ tồn kho: count = 1 là thành công, 0 là xung đột version
  const productUpdateMany = jest.fn(async (_: any) => ({ count: opts.reserve ? opts.reserve(++reserveCalls) : 1 }));
  const userUpdate = jest.fn(async (_: any) => ({}));
  const loyaltyCreate = jest.fn(async (_: any) => ({}));
  const promoFind = jest.fn(async (_: any) => opts.promo ?? null);
  const tx = {
    topping: { findMany: jest.fn(async (_: any) => opts.toppings ?? []) },
    product: {
      findUnique: jest.fn(async ({ where }: any) => opts.products?.[where.id] ?? null),
      updateMany: productUpdateMany,
    },
    promotion: { findUnique: promoFind },
    user: { findUnique: jest.fn(async (_: any) => opts.user ?? null), update: userUpdate },
    order: {
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }: any) => ({ id: 'order-1', ...data })),
    },
    loyaltyTransaction: { create: loyaltyCreate },
  };
  const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;
  return { service: new OrdersService(prisma), userUpdate, loyaltyCreate, promoFind, productUpdateMany };
}

const PRODUCTS = {
  p30: { id: 'p30', name: 'Cà phê sữa', price: 30000, isAvailable: true, stock: 100, version: 1 },
  p50: { id: 'p50', name: 'Latte', price: 50000, isAvailable: true, stock: 100, version: 1 },
  off: { id: 'off', name: 'Hết hàng', price: 30000, isAvailable: false, stock: 100, version: 1 },
};
const item = (productId: string, size: any, qty: number, toppingIds: string[] = []) => ({
  productId, size, qty, toppingIds,
});
const lines = (order: any) => order.items.create as any[];

/* ------------------------------------------------------------------ */
describe('Tính giá đơn hàng (OrdersService.createOrder)', () => {
  it.each([
    ['S', 30000],
    ['M', 36000],
    ['L', 42000],
  ])('size %s -> đơn giá %i', async (size, expected) => {
    const { service } = makeOrders({ products: PRODUCTS });
    const order: any = await service.createOrder(customer.id, { items: [item('p30', size, 1)] } as any);
    expect(lines(order)[0].unitPrice).toBe(expected);
    expect(order.subtotal).toBe(expected);
    expect(order.total).toBe(expected);
    expect(order.status).toBe(OrderStatus.PENDING);
  });

  it('cộng topping và nhân số lượng: (30k + 6k size M + 5k + 7k) x 2 = 96k', async () => {
    const { service } = makeOrders({
      products: PRODUCTS,
      toppings: [
        { id: 't1', name: 'Trân châu', price: 5000 },
        { id: 't2', name: 'Pudding', price: 7000 },
      ],
    });
    const order: any = await service.createOrder(customer.id, { items: [item('p30', 'M', 2, ['t1', 't2'])] } as any);
    expect(lines(order)[0].unitPrice).toBe(48000);
    expect(lines(order)[0].lineTotal).toBe(96000);
    expect(order.subtotal).toBe(96000);
  });

  it('tổng nhiều món: 30k (S x1) + 42k x 2 (L) = 114k', async () => {
    const { service } = makeOrders({ products: PRODUCTS });
    const order: any = await service.createOrder(customer.id, {
      items: [item('p30', 'S', 1), item('p30', 'L', 2)],
    } as any);
    expect(order.subtotal).toBe(114000);
  });

  it('giỏ hàng rỗng -> BadRequest', async () => {
    const { service } = makeOrders({ products: PRODUCTS });
    await expect(service.createOrder(customer.id, { items: [] } as any)).rejects.toThrow(BadRequestException);
  });

  it('sản phẩm không tồn tại -> BadRequest', async () => {
    const { service } = makeOrders({ products: PRODUCTS });
    await expect(
      service.createOrder(customer.id, { items: [item('khong-co', 'S', 1)] } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('sản phẩm tạm ngưng (isAvailable=false) -> BadRequest', async () => {
    const { service } = makeOrders({ products: PRODUCTS });
    await expect(service.createOrder(customer.id, { items: [item('off', 'S', 1)] } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('topping không hợp lệ -> BadRequest', async () => {
    const { service } = makeOrders({ products: PRODUCTS, toppings: [] });
    await expect(
      service.createOrder(customer.id, { items: [item('p30', 'S', 1, ['t-sai'])] } as any),
    ).rejects.toThrow(BadRequestException);
  });
});

/* ------------------------------------------------------------------ */
describe('Voucher khi tạo đơn', () => {
  const create = (promo: any, qty: number, code = 'BREWLITE10', productId = 'p50') => {
    const ctx = makeOrders({ products: PRODUCTS, promo });
    return { ...ctx, run: () => ctx.service.createOrder(customer.id, { items: [item(productId, 'S', qty)], promotionCode: code } as any) };
  };

  it('BREWLITE10, đơn 100k -> giảm 10k, total 90k', async () => {
    const order: any = await create(BREWLITE10, 2).run();
    expect(order.discountAmount).toBe(10000);
    expect(order.total).toBe(90000);
    expect(order.promotionCode).toBe('BREWLITE10');
  });

  it('BREWLITE10, đơn 500k -> chạm trần 20k', async () => {
    const order: any = await create(BREWLITE10, 10).run();
    expect(order.discountAmount).toBe(20000);
    expect(order.total).toBe(480000);
  });

  it('đúng ngưỡng tối thiểu 40k vẫn được áp (đơn 40k -> giảm 4k)', async () => {
    const ctx = makeOrders({ products: { p40: { id: 'p40', name: 'X', price: 40000, isAvailable: true, stock: 100, version: 1 } }, promo: BREWLITE10 });
    const order: any = await ctx.service.createOrder(customer.id, { items: [item('p40', 'S', 1)], promotionCode: 'BREWLITE10' } as any);
    expect(order.discountAmount).toBe(4000);
  });

  it('dưới ngưỡng 40k (đơn 30k) -> BadRequest', async () => {
    await expect(create(BREWLITE10, 1, 'BREWLITE10', 'p30').run()).rejects.toThrow(BadRequestException);
  });

  it('CHAOBANMOI, đơn 100k -> giảm 20k', async () => {
    const order: any = await create(CHAOBANMOI, 2, 'CHAOBANMOI').run();
    expect(order.discountAmount).toBe(20000);
  });

  it('CHAOBANMOI, đơn 250k -> chạm trần 30k', async () => {
    const order: any = await create(CHAOBANMOI, 5, 'CHAOBANMOI').run();
    expect(order.discountAmount).toBe(30000);
  });

  it('CHAOBANMOI, đơn 50k (< 80k) -> BadRequest', async () => {
    await expect(create(CHAOBANMOI, 1, 'CHAOBANMOI').run()).rejects.toThrow(BadRequestException);
  });

  it('mã không tồn tại -> NotFound', async () => {
    await expect(create(null, 2, 'SAIMA').run()).rejects.toThrow(NotFoundException);
  });

  it('mã đã ngừng áp dụng (isActive=false) -> NotFound', async () => {
    await expect(create({ ...BREWLITE10, isActive: false }, 2).run()).rejects.toThrow(NotFoundException);
  });

  it('mã hết hạn -> BadRequest', async () => {
    await expect(create({ ...BREWLITE10, expiresAt: PAST }, 2).run()).rejects.toThrow(BadRequestException);
  });

  it('mã được chuẩn hóa: " brewlite10 " -> "BREWLITE10"', async () => {
    const ctx = create(BREWLITE10, 2, '  brewlite10 ');
    await ctx.run();
    expect(ctx.promoFind).toHaveBeenCalledWith({ where: { code: 'BREWLITE10' } });
  });
});

/* ------------------------------------------------------------------ */
describe('PromotionsService.applyPromotion (POST /promotions/apply)', () => {
  const makePromo = (promo: any) =>
    new PromotionsService({ promotion: { findUnique: jest.fn(async () => promo) } } as unknown as PrismaService);

  it('trả đủ discountAmount và finalTotal', async () => {
    const r = await makePromo(BREWLITE10).applyPromotion({ code: 'brewlite10', subtotal: 100000 });
    expect(r.discountAmount).toBe(10000);
    expect(r.finalTotal).toBe(90000);
  });

  it('làm tròn xuống: 45.555đ x 10% = 4.555đ', async () => {
    const r = await makePromo(BREWLITE10).applyPromotion({ code: 'BREWLITE10', subtotal: 45555 });
    expect(r.discountAmount).toBe(4555);
  });

  it('chạm trần', async () => {
    const r = await makePromo(BREWLITE10).applyPromotion({ code: 'BREWLITE10', subtotal: 1000000 });
    expect(r.discountAmount).toBe(20000);
    expect(r.finalTotal).toBe(980000);
  });

  it('39.999 -> BadRequest, 40.000 -> OK', async () => {
    await expect(makePromo(BREWLITE10).applyPromotion({ code: 'BREWLITE10', subtotal: 39999 })).rejects.toThrow(BadRequestException);
    await expect(makePromo(BREWLITE10).applyPromotion({ code: 'BREWLITE10', subtotal: 40000 })).resolves.toBeDefined();
  });

  it('mã sai / hết hạn', async () => {
    await expect(makePromo(null).applyPromotion({ code: 'X', subtotal: 100000 })).rejects.toThrow(NotFoundException);
    await expect(makePromo({ ...BREWLITE10, expiresAt: PAST }).applyPromotion({ code: 'BREWLITE10', subtotal: 100000 })).rejects.toThrow(BadRequestException);
  });
});

/* ------------------------------------------------------------------ */
describe('Điểm thưởng - DÙNG điểm khi tạo đơn (1 điểm = 1đ)', () => {
  const buyer = (points: number, role: UserRole = UserRole.CUSTOMER) => ({ id: customer.id, role, loyaltyPoints: points });
  const run = (user: any, requested: number, qty: number, promo?: any) => {
    const ctx = makeOrders({ products: PRODUCTS, user, promo });
    const dto: any = { items: [item('p50', 'S', qty)], pointsUsed: requested };
    if (promo) dto.promotionCode = promo.code;
    return { ...ctx, promise: ctx.service.createOrder(customer.id, dto) as Promise<any> };
  };

  it('dùng 20.000 điểm cho đơn 100k -> total 80k, trừ điểm, ghi giao dịch REDEEM', async () => {
    const c = run(buyer(50000), 20000, 2);
    const order = await c.promise;
    expect(order.pointsUsed).toBe(20000);
    expect(order.pointsDiscountAmount).toBe(20000);
    expect(order.total).toBe(80000);
    expect(c.userUpdate).toHaveBeenCalledWith({ where: { id: customer.id }, data: { loyaltyPoints: { decrement: 20000 } } });
    expect(c.loyaltyCreate.mock.calls[0][0].data).toMatchObject({ points: -20000, type: 'REDEEM' });
  });

  it('không vượt số dư: có 500 điểm, xin 20.000 -> chỉ dùng 500', async () => {
    const order = await run(buyer(500), 20000, 2).promise;
    expect(order.pointsUsed).toBe(500);
    expect(order.total).toBe(99500);
  });

  it('không vượt giá trị đơn: đơn 50k, xin 80.000, có 100.000 -> dùng 50.000, total 0', async () => {
    const order = await run(buyer(100000), 80000, 1).promise;
    expect(order.pointsUsed).toBe(50000);
    expect(order.total).toBe(0);
  });

  it('kết hợp voucher + điểm: 100k - 10k voucher - 5k điểm = 85k', async () => {
    const order = await run(buyer(50000), 5000, 2, BREWLITE10).promise;
    expect(order.discountAmount).toBe(10000);
    expect(order.pointsUsed).toBe(5000);
    expect(order.total).toBe(85000);
  });

  it('không xin điểm (0) -> không trừ, không ghi giao dịch', async () => {
    const c = run(buyer(50000), 0, 2);
    const order = await c.promise;
    expect(order.pointsUsed).toBe(0);
    expect(c.userUpdate).not.toHaveBeenCalled();
    expect(c.loyaltyCreate).not.toHaveBeenCalled();
  });

  it('tài khoản ADMIN không được dùng điểm', async () => {
    const c = run(buyer(50000, UserRole.ADMIN), 20000, 2);
    const order = await c.promise;
    expect(order.pointsUsed).toBe(0);
    expect(c.userUpdate).not.toHaveBeenCalled();
  });

  it('hủy đơn (PENDING -> CANCELLED) hoàn lại điểm đã dùng', async () => {
    const userUpdate = jest.fn(async (_: any) => ({}));
    const tx = {
      order: {
        findUnique: jest.fn(async () => ({ id: 'o1', status: OrderStatus.PENDING, pointsUsed: 3000, userId: customer.id, items: [] })),
        update: jest.fn(async ({ data }: any) => ({ id: 'o1', ...data })),
      },
      user: { update: userUpdate },
    };
    const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;
    await new OrdersService(prisma).updateOrderStatus('o1', { status: OrderStatus.CANCELLED });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: customer.id }, data: { loyaltyPoints: { increment: 3000 } } });
  });

  it('chuyển trạng thái sai (PENDING -> READY) -> BadRequest', async () => {
    const tx = {
      order: { findUnique: jest.fn(async () => ({ id: 'o1', status: OrderStatus.PENDING, items: [] })), update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;
    await expect(new OrdersService(prisma).updateOrderStatus('o1', { status: OrderStatus.READY })).rejects.toThrow(BadRequestException);
  });
});

/* ------------------------------------------------------------------ */
describe('Điểm thưởng - TÍCH điểm khi thanh toán (5% hóa đơn) và thanh toán lỗi', () => {
  function makePayments(order: any, gateway: any = new MockPaymentGateway()) {
    const userUpdate = jest.fn(async (_: any) => ({}));
    const loyaltyCreate = jest.fn(async (_: any) => ({}));
    const tx = {
      payment: {
        findUnique: jest.fn(async (_: any) => null),
        create: jest.fn(async ({ data }: any) => ({ id: 'pay-1', ...data })),
      },
      order: {
        findUnique: jest.fn(async ({ where }: any) => (where.id === order.id ? { ...order } : null)),
        update: jest.fn(async ({ data }: any) => ({ ...order, ...data })),
      },
      user: { update: userUpdate },
      loyaltyTransaction: { create: loyaltyCreate },
    };
    const prisma = { payment: tx.payment, $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;
    return { service: new PaymentsService(prisma, gateway), userUpdate, loyaltyCreate };
  }
  const orderOf = (total: number, status: OrderStatus = OrderStatus.PENDING, userId = customer.id) => ({
    id: 'o1', orderCode: '#1', userId, status, total, items: [],
  });
  const pay = (dto: Partial<ProcessPaymentDto> = {}) => ({ orderId: 'o1', method: PaymentMethod.WALLET, ...dto }) as ProcessPaymentDto;

  it.each([
    [85000, 4250],
    [999, 49],   // làm tròn xuống
    [19, 0],     // dưới 20đ -> 0 điểm
  ])('đơn %i -> tích %i điểm', async (total, expected) => {
    const c = makePayments(orderOf(total));
    const r = await c.service.processPayment(customer, pay(), 'key-1');
    expect(r.pointsEarned).toBe(expected);
    if (expected > 0) {
      expect(c.userUpdate).toHaveBeenCalledWith({ where: { id: customer.id }, data: { loyaltyPoints: { increment: expected } } });
      expect(c.loyaltyCreate).toHaveBeenCalledTimes(1);
    } else {
      expect(c.userUpdate).not.toHaveBeenCalled();
    }
    expect(r.order.status).toBe(OrderStatus.PAID);
    expect(r.payment.status).toBe(PaymentStatus.SUCCESS);
  });

  it('ADMIN thanh toán -> không tích điểm', async () => {
    const c = makePayments(orderOf(85000));
    const r = await c.service.processPayment(admin, pay(), 'key-2');
    expect(r.pointsEarned).toBe(0);
    expect(c.userUpdate).not.toHaveBeenCalled();
  });

  it('mô phỏng lỗi -> payment FAILED, đơn PAYMENT_FAILED, không tích điểm', async () => {
    const c = makePayments(orderOf(85000));
    const r = await c.service.processPayment(customer, pay({ simulateFailure: true }), 'key-3');
    expect(r.payment.status).toBe(PaymentStatus.FAILED);
    expect(r.order.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(r.pointsEarned).toBe(0);
    expect(c.userUpdate).not.toHaveBeenCalled();
  });

  it('đơn PAYMENT_FAILED có thể thanh toán lại thành công', async () => {
    const c = makePayments(orderOf(85000, OrderStatus.PAYMENT_FAILED));
    const r = await c.service.processPayment(customer, pay(), 'key-4');
    expect(r.order.status).toBe(OrderStatus.PAID);
  });

  it('thiếu Idempotency-Key (hoặc chỉ toàn khoảng trắng) -> BadRequest', async () => {
    const c = makePayments(orderOf(85000));
    await expect(c.service.processPayment(customer, pay(), undefined)).rejects.toThrow(BadRequestException);
    await expect(c.service.processPayment(customer, pay(), '   ')).rejects.toThrow(BadRequestException);
  });

  it('key lấy được từ body khi không có header', async () => {
    const c = makePayments(orderOf(85000));
    const r = await c.service.processPayment(customer, pay({ idempotencyKey: 'body-key' }), undefined);
    expect(r.payment.idempotencyKey).toBe('body-key');
  });

  it('đơn không tồn tại -> NotFound', async () => {
    const c = makePayments(orderOf(85000));
    await expect(c.service.processPayment(customer, pay({ orderId: 'khong-co' }), 'key-5')).rejects.toThrow(NotFoundException);
  });

  it('thanh toán đơn của người khác -> Forbidden', async () => {
    const c = makePayments(orderOf(85000, OrderStatus.PENDING, 'nguoi-khac'));
    await expect(c.service.processPayment(customer, pay(), 'key-6')).rejects.toThrow(ForbiddenException);
  });

  it('cổng thanh toán từ chối -> payment FAILED kèm thông báo của cổng, không tích điểm', async () => {
    const gateway = { charge: jest.fn(async () => ({ success: false, errorMessage: 'Thẻ hết hạn' })) };
    const c = makePayments(orderOf(85000), gateway);
    const r = await c.service.processPayment(customer, pay(), 'key-gw');
    expect(gateway.charge).toHaveBeenCalledWith(85000, PaymentMethod.WALLET, undefined);
    expect(r.payment.status).toBe(PaymentStatus.FAILED);
    expect(r.payment.errorMessage).toBe('Thẻ hết hạn');
    expect(r.order.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(c.userUpdate).not.toHaveBeenCalled();
  });

  it('simulateFailure được chuyển xuống cổng thanh toán', async () => {
    const gateway = { charge: jest.fn(async () => ({ success: false, errorMessage: 'x' })) };
    const c = makePayments(orderOf(85000), gateway);
    await c.service.processPayment(customer, pay({ simulateFailure: true }), 'key-gw2');
    expect(gateway.charge).toHaveBeenCalledWith(85000, PaymentMethod.WALLET, true);
  });

  it.each([OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.COMPLETED])(
    'thanh toán đơn đã %s với key mới -> BadRequest (không trừ tiền 2 lần)',
    async (status) => {
      const c = makePayments(orderOf(85000, status));
      await expect(c.service.processPayment(customer, pay(), 'key-7')).rejects.toThrow(BadRequestException);
      expect(c.userUpdate).not.toHaveBeenCalled();
    },
  );
});

/* ------------------------------------------------------------------ */
describe('Giữ chỗ tồn kho khi tạo đơn (optimistic locking)', () => {
  const run = (ctx: ReturnType<typeof makeOrders>, qty = 2) =>
    ctx.service.createOrder(customer.id, { items: [item('p30', 'S', qty)] } as any) as Promise<any>;

  it('giữ chỗ đúng điều kiện (id + version + stock đủ), trừ stock và tăng version', async () => {
    const ctx = makeOrders({ products: PRODUCTS });
    await run(ctx, 3);
    expect(ctx.productUpdateMany).toHaveBeenCalledWith({
      where: { id: 'p30', version: 1, stock: { gte: 3 } },
      data: { stock: { decrement: 3 }, version: { increment: 1 } },
    });
  });

  it('tồn kho không đủ -> ConflictException, không giữ chỗ', async () => {
    const ctx = makeOrders({ products: { p30: { ...PRODUCTS.p30, stock: 1 } } });
    await expect(run(ctx, 2)).rejects.toThrow(ConflictException);
    expect(ctx.productUpdateMany).not.toHaveBeenCalled();
  });

  it('xung đột version lần đầu -> tự thử lại và đặt đơn thành công', async () => {
    const ctx = makeOrders({ products: PRODUCTS, reserve: (n) => (n === 1 ? 0 : 1) });
    const order = await run(ctx);
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(ctx.productUpdateMany).toHaveBeenCalledTimes(2);
  });

  it('xung đột liên tục -> ConflictException sau 10 lần thử', async () => {
    const ctx = makeOrders({ products: PRODUCTS, reserve: () => 0 });
    await expect(run(ctx)).rejects.toThrow(ConflictException);
    expect(ctx.productUpdateMany).toHaveBeenCalledTimes(10);
  });

  it('hủy đơn hoàn lại tồn kho đã giữ chỗ', async () => {
    const productUpdateMany = jest.fn(async (_: any) => ({ count: 1 }));
    const tx = {
      order: {
        findUnique: jest.fn(async () => ({
          id: 'o1', status: OrderStatus.PENDING, pointsUsed: 0, userId: customer.id,
          items: [{ productId: 'p30', qty: 2 }],
        })),
        update: jest.fn(async ({ data }: any) => ({ id: 'o1', ...data })),
      },
      product: { updateMany: productUpdateMany },
    };
    const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;
    await new OrdersService(prisma).updateOrderStatus('o1', { status: OrderStatus.CANCELLED });
    expect(productUpdateMany).toHaveBeenCalledWith({
      where: { id: 'p30' },
      data: { stock: { increment: 2 }, version: { increment: 1 } },
    });
  });
});

/* ------------------------------------------------------------------ */
describe('Validation DTO (nguồn của lỗi 400)', () => {
  const errs = (cls: any, plain: any) => validate(plainToInstance(cls, plain));

  it('CreateOrderDto hợp lệ', async () => {
    expect(await errs(CreateOrderDto, { items: [{ productId: 'p1', size: 'M', qty: 1 }] })).toHaveLength(0);
  });
  it('items rỗng / thiếu -> lỗi', async () => {
    expect((await errs(CreateOrderDto, { items: [] })).length).toBeGreaterThan(0);
    expect((await errs(CreateOrderDto, {})).length).toBeGreaterThan(0);
  });
  it('qty = 0 hoặc không phải số nguyên -> lỗi', async () => {
    expect((await errs(CreateOrderDto, { items: [{ productId: 'p1', size: 'M', qty: 0 }] })).length).toBeGreaterThan(0);
    expect((await errs(CreateOrderDto, { items: [{ productId: 'p1', size: 'M', qty: 1.5 }] })).length).toBeGreaterThan(0);
  });
  it('size ngoài S/M/L -> lỗi', async () => {
    expect((await errs(CreateOrderDto, { items: [{ productId: 'p1', size: 'XL', qty: 1 }] })).length).toBeGreaterThan(0);
  });
  it('pointsUsed âm -> lỗi', async () => {
    expect((await errs(CreateOrderDto, { items: [{ productId: 'p1', size: 'S', qty: 1 }], pointsUsed: -1 })).length).toBeGreaterThan(0);
  });
  it('ProcessPaymentDto: method CASH -> lỗi, WALLET/CARD -> hợp lệ, thiếu orderId -> lỗi', async () => {
    expect((await errs(ProcessPaymentDto, { orderId: 'o1', method: 'CASH' })).length).toBeGreaterThan(0);
    expect(await errs(ProcessPaymentDto, { orderId: 'o1', method: 'WALLET' })).toHaveLength(0);
    expect(await errs(ProcessPaymentDto, { orderId: 'o1', method: 'CARD' })).toHaveLength(0);
    expect((await errs(ProcessPaymentDto, { method: 'WALLET' })).length).toBeGreaterThan(0);
  });
});
