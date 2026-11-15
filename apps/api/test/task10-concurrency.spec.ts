import { ConflictException } from '@nestjs/common';
import { OrderStatus, ProductSize } from '@prisma/client';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Task 10.3 - Đặt đơn đồng thời không bán vượt tồn kho.
 *
 * Prisma được giả lập trong bộ nhớ (cùng cách với task10-idempotency.spec.ts) nhưng giữ đúng ngữ nghĩa
 * quan trọng của DB: `updateMany` kiểm tra điều kiện `version` + `stock >= qty` và ghi trong MỘT bước
 * nguyên tử. Giữa `findUnique` và `updateMany` luôn có độ trễ ngẫu nhiên để các giao dịch thật sự
 * xen kẽ nhau, từ đó buộc cơ chế optimistic locking + retry của OrdersService phải hoạt động.
 */

interface ProductRow {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  station: string | null;
  stock: number;
  version: number;
}

interface OrderRow {
  id: string;
  orderCode: string;
  userId: string;
  status: OrderStatus;
  items: Array<{ productId: string; qty: number; productName: string }>;
  pointsUsed: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const randomDelay = () => sleep(Math.floor(Math.random() * 6));

function buildEnvironment(initialProducts: Array<Pick<ProductRow, 'id' | 'name' | 'stock'>>) {
  const products = new Map<string, ProductRow>();
  for (const p of initialProducts) {
    products.set(p.id, {
      id: p.id,
      name: p.name,
      price: 35000,
      isAvailable: true,
      station: null,
      stock: p.stock,
      version: 1,
    });
  }
  const orders = new Map<string, OrderRow>();

  const makeTx = (rollbackLog: Array<() => void>) => ({
    topping: {
      findMany: async () => [],
    },
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        await randomDelay();
        const row = products.get(where.id);
        return row ? { ...row } : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; version?: number; stock?: { gte: number } };
        data: {
          stock?: { decrement?: number; increment?: number };
          version?: { increment?: number };
        };
      }) => {
        await randomDelay();
        // Từ đây đến hết hàm là đồng bộ => tương đương một câu UPDATE nguyên tử có khóa dòng.
        const row = products.get(where.id);
        if (!row) return { count: 0 };
        if (where.version !== undefined && row.version !== where.version) return { count: 0 };
        if (where.stock?.gte !== undefined && row.stock < where.stock.gte) return { count: 0 };

        const stockDelta = (data.stock?.increment ?? 0) - (data.stock?.decrement ?? 0);
        const versionDelta = data.version?.increment ?? 0;
        row.stock += stockDelta;
        row.version += versionDelta;
        rollbackLog.push(() => {
          row.stock -= stockDelta;
          row.version -= versionDelta;
        });
        return { count: 1 };
      },
    },
    order: {
      count: async () => orders.size,
      create: async ({ data }: { data: Record<string, any> }) => {
        const id = `order-${orders.size + 1}-${Math.random().toString(36).slice(2, 8)}`;
        const row: OrderRow = {
          id,
          orderCode: data.orderCode,
          userId: data.userId,
          status: data.status,
          pointsUsed: data.pointsUsed ?? 0,
          items: data.items.create.map((i: any) => ({
            productId: i.productId,
            qty: i.qty,
            productName: i.productName,
          })),
        };
        orders.set(id, row);
        rollbackLog.push(() => orders.delete(id));
        return { ...row, payments: [] };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = orders.get(where.id);
        return row ? { ...row, items: row.items.map((i) => ({ ...i })) } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { status: OrderStatus } }) => {
        const row = orders.get(where.id)!;
        row.status = data.status;
        return { ...row, payments: [], user: null };
      },
    },
  });

  const prisma = {
    $transaction: jest.fn(async (callback: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      const rollbackLog: Array<() => void> = [];
      try {
        return await callback(makeTx(rollbackLog));
      } catch (error) {
        // Giao dịch lỗi => hoàn tác mọi thay đổi đã ghi trong giao dịch (giống ROLLBACK của DB).
        for (const undo of rollbackLog.reverse()) undo();
        throw error;
      }
    }),
  } as unknown as PrismaService;

  return { products, orders, service: new OrdersService(prisma) };
}

const orderDto = (productId: string, qty = 1) => ({
  items: [{ productId, size: ProductSize.M, qty }],
});

describe('Task 10.3 - Đặt đơn đồng thời không vượt tồn kho (optimistic locking)', () => {
  it('10 khách cùng đặt 1 ly khi tồn kho chỉ còn 5 => đúng 5 đơn thành công, 5 đơn bị 409, tồn kho về 0', async () => {
    const { service, products, orders } = buildEnvironment([
      { id: 'prod-1', name: 'Cà Phê Sữa Đá Sài Gòn', stock: 5 },
    ]);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => service.createOrder(`user-${i + 1}`, orderDto('prod-1'))),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(5);
    expect(rejected).toHaveLength(5);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(ConflictException);
      expect((r.reason as ConflictException).message).toContain('không đủ tồn kho');
    }

    const product = products.get('prod-1')!;
    expect(product.stock).toBe(0);
    expect(product.version).toBe(1 + 5); // mỗi lần trừ kho thành công tăng version đúng 1
    expect(orders.size).toBe(5);
  });

  it('đơn nhiều ly: tồn kho 7, 6 khách cùng đặt 2 ly => tối đa 3 đơn thành công và tồn kho không bao giờ âm', async () => {
    const { service, products, orders } = buildEnvironment([
      { id: 'prod-2', name: 'Bạc Xỉu Đá Hạt Dẻ', stock: 7 },
    ]);

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => service.createOrder(`user-${i + 1}`, orderDto('prod-2', 2))),
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    expect(successCount).toBe(3);

    const product = products.get('prod-2')!;
    expect(product.stock).toBe(1);
    expect(product.stock).toBeGreaterThanOrEqual(0);
    expect(product.stock + successCount * 2).toBe(7); // bảo toàn: còn lại + đã bán = ban đầu
    expect(orders.size).toBe(successCount);
  });

  it('tải cao: 30 đơn đồng thời, tồn kho 20 => không bán vượt, không âm, mọi lỗi đều là 409', async () => {
    const { service, products, orders } = buildEnvironment([
      { id: 'prod-3', name: 'Americano Đá Nguyên Bản', stock: 20 },
    ]);

    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) => service.createOrder(`user-${i + 1}`, orderDto('prod-3'))),
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(successCount).toBeLessThanOrEqual(20);
    expect(successCount).toBeGreaterThan(0);
    for (const r of rejected) expect(r.reason).toBeInstanceOf(ConflictException);

    const product = products.get('prod-3')!;
    expect(product.stock).toBeGreaterThanOrEqual(0);
    expect(product.stock + successCount).toBe(20);
    expect(orders.size).toBe(successCount);
  });

  it('đơn có nhiều dòng: một dòng hết hàng => hủy cả giao dịch, tồn kho dòng còn lại không bị trừ', async () => {
    const { service, products, orders } = buildEnvironment([
      { id: 'prod-A', name: 'Món A', stock: 5 },
      { id: 'prod-B', name: 'Món B', stock: 1 },
    ]);

    await expect(
      service.createOrder('user-1', {
        items: [
          { productId: 'prod-A', size: ProductSize.S, qty: 2 },
          { productId: 'prod-B', size: ProductSize.S, qty: 3 },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(products.get('prod-A')!.stock).toBe(5);
    expect(products.get('prod-A')!.version).toBe(1);
    expect(products.get('prod-B')!.stock).toBe(1);
    expect(orders.size).toBe(0);
  });

  it('hủy đơn hoàn lại đúng số lượng tồn kho đã giữ chỗ', async () => {
    const { service, products } = buildEnvironment([
      { id: 'prod-4', name: 'Cappuccino Kem Mịn', stock: 5 },
    ]);

    const order = await service.createOrder('user-1', orderDto('prod-4', 3));
    expect(products.get('prod-4')!.stock).toBe(2);

    await service.updateOrderStatus(order.id, { status: OrderStatus.CANCELLED });
    expect(products.get('prod-4')!.stock).toBe(5);
  });
});
