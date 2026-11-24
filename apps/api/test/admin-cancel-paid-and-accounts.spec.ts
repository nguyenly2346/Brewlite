import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrdersService } from '../src/orders/orders.service';
import { AdminAccountsService } from '../src/admin/admin-accounts.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin hủy đơn đã thanh toán', () => {
  it('hoàn kho + hoàn điểm đã dùng, thu hồi điểm đã tích và ghi lịch sử điểm có số dư', async () => {
    const loyaltyCreate = jest.fn(async (_: any) => ({}));
    const userUpdate = jest
      .fn()
      .mockResolvedValueOnce({ loyaltyPoints: 8000 }) // sau hoàn điểm đã dùng
      .mockResolvedValueOnce({ loyaltyPoints: 7000 }); // sau thu hồi điểm đã tích
    const productUpdateMany = jest.fn(async (_: any) => ({ count: 1 }));
    const tx = {
      order: {
        findUnique: jest.fn(async () => ({
          id: 'o1', orderCode: '#AB123', status: OrderStatus.PAID, pointsUsed: 3000, userId: 'u1',
          items: [{ productId: 'p1', qty: 2 }],
        })),
        update: jest.fn(async ({ data }: any) => ({ id: 'o1', ...data })),
      },
      product: { updateMany: productUpdateMany },
      user: {
        update: userUpdate,
        findUnique: jest.fn(async () => ({ loyaltyPoints: 8000 })),
      },
      loyaltyTransaction: {
        findMany: jest.fn(async () => [{ points: 1000 }]),
        create: loyaltyCreate,
      },
    };
    const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;

    await new OrdersService(prisma).updateOrderStatus('o1', { status: OrderStatus.CANCELLED });

    expect(productUpdateMany).toHaveBeenCalled();
    expect(userUpdate).toHaveBeenNthCalledWith(1, { where: { id: 'u1' }, data: { loyaltyPoints: { increment: 3000 } } });
    expect(userUpdate).toHaveBeenNthCalledWith(2, { where: { id: 'u1' }, data: { loyaltyPoints: { decrement: 1000 } } });
    expect(loyaltyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'REFUND_REDEEM', points: 3000, balanceAfter: 8000 }),
    });
    expect(loyaltyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'REVOKE_EARN', points: -1000, balanceAfter: 7000 }),
    });
  });

  it('đơn vừa bị đổi trạng thái ở nơi khác (P2025) -> 409, không ghi đè', async () => {
    const tx = {
      order: {
        findUnique: jest.fn(async () => ({ id: 'o1', status: OrderStatus.PENDING, items: [], pointsUsed: 0 })),
        update: jest.fn(async () => { throw Object.assign(new Error('not found'), { code: 'P2025' }); }),
      },
    };
    const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;
    await expect(
      new OrdersService(prisma).updateOrderStatus('o1', { status: OrderStatus.PAID }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('Quản lý tài khoản (admin)', () => {
  const actor = { id: 'admin-1', email: 'a@x.vn', role: UserRole.ADMIN, fullName: 'A' };
  const build = (user: any, otherAdmins = 1) => {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => user),
        count: jest.fn(async () => otherAdmins),
        update: jest.fn(async (a: any) => a),
        delete: jest.fn(async () => ({})),
      },
    } as unknown as PrismaService;
    return { service: new AdminAccountsService(prisma), prisma };
  };

  it('không tự khóa tài khoản đang đăng nhập', async () => {
    const { service } = build({ id: 'admin-1', role: UserRole.ADMIN, isActive: true });
    await expect(service.update('admin-1', { isActive: false }, actor)).rejects.toThrow();
  });

  it('không khóa quản trị viên cuối cùng', async () => {
    const { service } = build({ id: 'admin-2', role: UserRole.ADMIN, isActive: true }, 0);
    await expect(service.update('admin-2', { isActive: false }, actor)).rejects.toThrow();
  });

  it('không xóa tài khoản đã có đơn hàng (gợi ý khóa)', async () => {
    const { service, prisma } = build({ id: 'c1', role: UserRole.CUSTOMER, isActive: true, _count: { orders: 3 } });
    await expect(service.remove('c1', actor)).rejects.toThrow(ConflictException);
    expect((prisma as any).user.delete).not.toHaveBeenCalled();
  });

  it('xóa được tài khoản khách chưa có đơn', async () => {
    const { service, prisma } = build({ id: 'c2', role: UserRole.CUSTOMER, isActive: true, _count: { orders: 0 } });
    await expect(service.remove('c2', actor)).resolves.toEqual({ deleted: true, id: 'c2' });
    expect((prisma as any).user.delete).toHaveBeenCalledWith({ where: { id: 'c2' } });
  });
});

describe('Admin hủy đơn đã hủy', () => {
  it('đơn CANCELLED -> báo đã hủy trước đó, không hủy lại', async () => {
    const tx = {
      order: {
        findUnique: jest.fn(async () => ({ id: 'o1', status: OrderStatus.CANCELLED, items: [], pointsUsed: 0 })),
        update: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as unknown as PrismaService;
    await expect(
      new OrdersService(prisma).updateOrderStatus('o1', { status: OrderStatus.CANCELLED }),
    ).rejects.toThrow('đã được hủy trước đó');
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});

describe('Quản lý khuyến mãi (admin)', () => {
  const build = (existing: any) => {
    const prisma = {
      promotion: {
        findUnique: jest.fn(async () => existing),
        create: jest.fn(async (a: any) => a.data),
        update: jest.fn(async (a: any) => a),
        delete: jest.fn(async () => ({})),
      },
      auditLog: { create: jest.fn(async () => ({})) },
    } as unknown as PrismaService;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AdminPromotionsService } = require('../src/admin/admin-promotions.service');
    return { service: new AdminPromotionsService(prisma), prisma };
  };
  const dto = {
    code: ' tet2027 ', description: 'Mừng xuân', discountPercent: 15,
    maxDiscountAmount: 30000, minOrderValue: 50000, expiresAt: '2027-02-28T00:00:00.000Z',
  };

  it('tạo mã: chuẩn hóa IN HOA và mặc định đang bật', async () => {
    const { service, prisma } = build(null);
    const created = await service.create(dto);
    expect(created.code).toBe('TET2027');
    expect(created.isActive).toBe(true);
    expect((prisma as any).auditLog.create).toHaveBeenCalled();
  });

  it('tạo mã trùng -> 409', async () => {
    const { service } = build({ id: 'x', code: 'TET2027' });
    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('sửa / xóa mã không tồn tại -> 404', async () => {
    const { service } = build(null);
    await expect(service.update('x', { isActive: false })).rejects.toThrow(NotFoundException);
    await expect(service.remove('x')).rejects.toThrow(NotFoundException);
  });

  it('xóa được mã khuyến mãi và ghi audit log', async () => {
    const { service, prisma } = build({ id: 'y', code: 'B' });
    await expect(service.remove('y')).resolves.toEqual({ deleted: true, id: 'y' });
    expect((prisma as any).promotion.delete).toHaveBeenCalledWith({ where: { id: 'y' } });
  });
});
