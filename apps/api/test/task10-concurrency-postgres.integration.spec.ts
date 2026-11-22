
import { ConflictException } from '@nestjs/common';
import {
  InventoryTxType,
  OrderStatus,
  ProductSize,
  PrismaClient,
} from '@prisma/client';

import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(30000);

describe('Task 10 - PostgreSQL concurrency integration test', () => {
  let prisma: PrismaClient;
  let ordersService: OrdersService;

  let userId: string;
  let productId: string;
  let ingredientId: string;
  let orderIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL chưa được thiết lập');
    }

    const parsedUrl = new URL(databaseUrl);

    // Chặn tuyệt đối việc chạy test nhầm vào Neon production.
    if (
      parsedUrl.hostname !== 'localhost' ||
      parsedUrl.port !== '5433' ||
      parsedUrl.pathname !== '/brewlite_concurrency_test'
    ) {
      throw new Error(
        'SAFETY CHECK: Test chỉ được chạy trên brewlite_concurrency_test tại localhost:5433',
      );
    }

    prisma = new PrismaClient();
    await prisma.$connect();

    ordersService = new OrdersService(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(async () => {
    if (!prisma) return;

    if (orderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    if (productId) {
      await prisma.recipe.deleteMany({
        where: { productId },
      });
    }

    if (ingredientId) {
      await prisma.inventoryTransaction.deleteMany({
        where: { ingredientId },
      });

      await prisma.ingredient.deleteMany({
        where: { id: ingredientId },
      });
    }

    if (productId) {
      await prisma.product.deleteMany({
        where: { id: productId },
      });
    }

    if (userId) {
      await prisma.user.deleteMany({
        where: { id: userId },
      });
    }

    userId = '';
    productId = '';
    ingredientId = '';
    orderIds = [];
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  async function createScenario(stock: number, numberOfOrders: number) {
    const suffix = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const user = await prisma.user.create({
      data: {
        email: `concurrency-${suffix}@test.local`,
        passwordHash: 'integration-test-hash',
        fullName: 'Concurrency Test User',
      },
    });

    userId = user.id;

    const product = await prisma.product.create({
      data: {
        name: 'Concurrency Test Coffee',
        description: 'Product used for PostgreSQL integration testing',
        category: 'Coffee',
        price: 30000,
        imageUrl: 'https://example.com/test.png',
      },
    });

    productId = product.id;

    const ingredient = await prisma.ingredient.create({
      data: {
        code: `ING-${suffix}`,
        name: 'Concurrency Test Ingredient',
        unit: 'g',
        currentStock: stock,
        minThreshold: 0,
        costPerUnit: 100,
      },
    });

    ingredientId = ingredient.id;

    await prisma.recipe.create({
      data: {
        productId: product.id,
        ingredientId: ingredient.id,
        quantityNeeded: 1,
      },
    });

    const createdOrderIds: string[] = [];

    for (let i = 0; i < numberOfOrders; i++) {
      const order = await prisma.order.create({
        data: {
          orderCode: `CT-${suffix}-${i}`,
          userId: user.id,
          status: OrderStatus.PAID,
          subtotal: 30000,
          total: 30000,
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              size: ProductSize.S,
              qty: 1,
              toppings: [],
              unitPrice: 30000,
              lineTotal: 30000,
            },
          },
        },
      });

      createdOrderIds.push(order.id);
    }

    orderIds = createdOrderIds;

    return {
      orderIds: createdOrderIds,
      ingredientId: ingredient.id,
    };
  }

  it('allows only 2 of 5 concurrent orders when stock is 2', async () => {
    const fixture = await createScenario(2, 5);

    const results = await Promise.allSettled(
      fixture.orderIds.map((orderId) =>
        ordersService.updateOrderStatus(orderId, {
          status: OrderStatus.PREPARING,
        }),
      ),
    );

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

    const finalIngredient = await prisma.ingredient.findUniqueOrThrow({
      where: { id: fixture.ingredientId },
    });

    const inventoryTransactions =
      await prisma.inventoryTransaction.count({
        where: {
          ingredientId: fixture.ingredientId,
          type: InventoryTxType.ORDER_DEDUCT,
        },
      });

    const processedItems = await prisma.orderItem.count({
      where: {
        orderId: { in: fixture.orderIds },
        inventoryDeducted: true,
      },
    });

    expect(successful).toHaveLength(2);
    expect(failed).toHaveLength(3);
    expect(conflictErrors).toHaveLength(3);

    expect(finalIngredient.currentStock).toBe(0);
    expect(finalIngredient.currentStock).toBeGreaterThanOrEqual(0);

    expect(inventoryTransactions).toBe(2);
    expect(processedItems).toBe(2);
  });

  it('rolls back the transaction when ingredient stock is insufficient', async () => {
    const fixture = await createScenario(0, 1);
    const orderId = fixture.orderIds[0];

    await expect(
      ordersService.updateOrderStatus(orderId, {
        status: OrderStatus.PREPARING,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    const ingredient = await prisma.ingredient.findUniqueOrThrow({
      where: { id: fixture.ingredientId },
    });

    const transactionCount =
      await prisma.inventoryTransaction.count({
        where: {
          ingredientId: fixture.ingredientId,
          orderId,
        },
      });

    expect(order.status).toBe(OrderStatus.PAID);
    expect(order.items[0].inventoryDeducted).toBe(false);
    expect(ingredient.currentStock).toBe(0);
    expect(transactionCount).toBe(0);
  });
});
