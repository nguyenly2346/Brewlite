import { BadRequestException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrderCancellationService } from './order-cancellation.service';
import { PrismaService } from '../prisma/prisma.service';

const user = { id: 'u1', email: 'a@x.vn', role: UserRole.CUSTOMER, fullName: 'A' };

function build(order: any) {
  const tx = {
    order: {
      findUnique: jest.fn(async () => order),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    product: { updateMany: jest.fn(async () => ({ count: 1 })) },
    promotion: { updateMany: jest.fn(async () => ({ count: 1 })) },
    user: {
      update: jest.fn(async () => ({ loyaltyPoints: 5000 })),
      findUnique: jest.fn(async () => ({ loyaltyPoints: 5000 })),
    },
    loyaltyTransaction: {
      findMany: jest.fn(async () => [{ points: 500 }]),
      create: jest.fn(async () => ({})),
    },
  };
  const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;
  return { service: new OrderCancellationService(prisma), tx };
}

const baseOrder = {
  id: 'o1',
  orderCode: '#AB123',
  userId: 'u1',
  total: 10000,
  pointsUsed: 0,
  promotionCode: null,
  payments: [],
  items: [{ productId: 'p1', qty: 2 }],
};

describe('OrderCancellationService', () => {
  it('đơn chưa thanh toán -> hủy được, không có thông báo hoàn tiền', async () => {
    const { service } = build({ ...baseOrder, status: OrderStatus.PENDING });
    const result: any = await service.cancelOrder('o1', user);
    expect(result.refund).toBeNull();
  });

  it('đơn đã thanh toán (PAID) -> vẫn hủy được, hoàn kho, thu hồi điểm và trả thông báo hoàn tiền mô phỏng', async () => {
    const { service, tx } = build({
      ...baseOrder,
      status: OrderStatus.PAID,
      payments: [{ status: 'SUCCESS' }],
    });
    const result: any = await service.cancelOrder('o1', user);

    expect(tx.order.updateMany).toHaveBeenCalled();
    expect(tx.product.updateMany).toHaveBeenCalled();
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'REVOKE_EARN', points: -500 }),
    });
    expect(result.refund).toEqual(
      expect.objectContaining({ amount: 10000, simulated: true }),
    );
  });

  it('đơn đã hủy -> không cho hủy lại', async () => {
    const { service, tx } = build({ ...baseOrder, status: OrderStatus.CANCELLED });
    await expect(service.cancelOrder('o1', user)).rejects.toThrow(BadRequestException);
    await expect(service.cancelOrder('o1', user)).rejects.toThrow('đã được hủy trước đó');
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it.each([OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED])(
    'đơn %s -> khách không được hủy',
    async (status) => {
      const { service } = build({ ...baseOrder, status });
      await expect(service.cancelOrder('o1', user)).rejects.toThrow(BadRequestException);
    },
  );
});
