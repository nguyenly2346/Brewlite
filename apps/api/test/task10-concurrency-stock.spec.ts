
import { ConflictException } from '@nestjs/common';
import {
  OrderStatus,
  InventoryTxType,
} from '@prisma/client';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Task 10 - Concurrent inventory stock control', () => {
  let ordersService: OrdersService;

  let stock: number;
  let deductedOrders: Set<string>;
  let orderStatuses: Map<string, OrderStatus>;
  let inventoryTransactions: number;

  beforeEach(() => {
    stock = 2;
    deductedOrders = new Set<string>();
    orderStatuses = new Map<string, OrderStatus>();
    inventoryTransactions = 0;

    for (let i = 1; i <= 5; i++) {
      orderStatuses.set(`order-${i}`, OrderStatus.PAID);
    }

    // Mock transaction có rollback và tuần tự hóa thao tác ghi.
    let transactionQueue = Promise.resolve();

    const mockPrisma = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => {
        const previous = transactionQueue;

        let release!: () => void;
        transactionQueue = new Promise<void>((resolve) => {
          release = resolve;
        });

        await previous;

        // Mỗi transaction làm việc trên bản sao dữ liệu.
        let localStock = stock;
        const localDeducted = new Set(deductedOrders);
        const localStatuses = new Map(orderStatuses);
        let localTransactions = inventoryTransactions;

        const tx = {
          order: {
            findUnique: jest.fn(async ({ where }: any) => {
              const status = localStatuses.get(where.id);

              if (!status) return null;

              return {
                id: where.id,
                orderCode: where.id,
                userId: 'user-1',
                status,
                pointsUsed: 0,
                items: [
                  {
                    id: `item-${where.id}`,
                    productId: 'product-1',
                    productName: 'Test Coffee',
                    qty: 1,
                    inventoryDeducted: localDeducted.has(where.id),
                  },
                ],
              };
            }),

            update: jest.fn(async ({ where, data }: any) => {
              localStatuses.set(where.id, data.status);

              return {
                id: where.id,
                status: data.status,
              };
            }),
          },

          orderItem: {
            updateMany: jest.fn(async ({ where }: any) => {
              const orderId = where.id.replace('item-', '');

              if (localDeducted.has(orderId)) {
                return { count: 0 };
              }

              localDeducted.add(orderId);
              return { count: 1 };
            }),
          },

          recipe: {
            findMany: jest.fn(async () => [
              {
                id: 'recipe-1',
                productId: 'product-1',
                ingredientId: 'ingredient-1',
                quantityNeeded: 1,
              },
            ]),
          },

          ingredient: {
            updateMany: jest.fn(async ({ where, data }: any) => {
              if (
                where.id !== 'ingredient-1' ||
                localStock < where.currentStock.gte
              ) {
                return { count: 0 };
              }

              localStock -= data.currentStock.decrement;
              return { count: 1 };
            }),

            findUnique: jest.fn(async () => ({
              id: 'ingredient-1',
              currentStock: localStock,
            })),
          },

          inventoryTransaction: {
            create: jest.fn(async () => {
              localTransactions++;
              return { id: 'inventory-tx' };
            }),
          },
        };

        try {
          const result = await callback(tx);

          // Chỉ commit khi transaction thành công.
          stock = localStock;
          deductedOrders = localDeducted;
          orderStatuses = localStatuses;
          inventoryTransactions = localTransactions;

          return result;
        } finally {
          release();
        }
      }),
    };

    ordersService = new OrdersService(
      mockPrisma as unknown as PrismaService,
    );
  });

  it('allows only 2 of 5 concurrent orders when stock is 2', async () => {
    const requests = Array.from({ length: 5 }, (_, index) =>
      ordersService.updateOrderStatus(`order-${index + 1}`, {
        status: OrderStatus.PREPARING,
      }),
    );

    const results = await Promise.allSettled(requests);

    const successful = results.filter(
      (result) => result.status === 'fulfilled',
    );

    const failed = results.filter(
      (result) => result.status === 'rejected',
    );

    const conflictErrors = failed.filter(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof ConflictException &&
        result.reason.getStatus() === 409,
    );

    expect(successful).toHaveLength(2);
    expect(failed).toHaveLength(3);
    expect(conflictErrors).toHaveLength(3);

    expect(stock).toBe(0);
    expect(inventoryTransactions).toBe(2);
  });

  it('does not deduct stock twice for an already processed order item', async () => {
    const first = await ordersService.updateOrderStatus('order-1', {
      status: OrderStatus.PREPARING,
    });

    expect(first.status).toBe(OrderStatus.PREPARING);
    expect(stock).toBe(1);
  });
});
