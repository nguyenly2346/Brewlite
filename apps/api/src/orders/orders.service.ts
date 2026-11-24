import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { BarStation, InventoryTxType, OrderStatus, ProductSize, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { assertTransition } from './order-state-machine';
import { AuthenticatedUser } from '../common/decorators';

// Bảng ký tự bỏ các ký tự dễ nhầm (0/O, 1/I): 32^5 ≈ 33,5 triệu mã khác nhau.
const ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateOrderCode(): string {
  let code = '#';
  for (let i = 0; i < 5; i++) {
    code += ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)];
  }
  return code;
}

function isOrderCodeCollision(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: unknown } } | null;
  if (!e || e.code !== 'P2002') return false;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes('orderCode') : String(target ?? '').includes('orderCode');
}

const SIZE_UPCHARGE: Record<ProductSize, number> = {
  [ProductSize.S]: 0,
  [ProductSize.M]: 6000,
  [ProductSize.L]: 12000,
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống');
    }

    // Mỗi lần thất bại do xung đột version chỉ xảy ra khi có giao dịch khác vừa trừ kho thành công,
    // nên số lần thử lại cần lớn hơn số giao dịch tranh chấp đồng thời trên cùng một sản phẩm.
    const MAX_RETRIES = 10;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const allToppingIds = Array.from(
            new Set(dto.items.flatMap((i) => i.toppingIds ?? [])),
          );

          const toppingsMap = new Map<string, { id: string; name: string; price: number }>();
          if (allToppingIds.length > 0) {
            const toppings = await tx.topping.findMany({
              where: { id: { in: allToppingIds }, isAvailable: true },
            });
            for (const t of toppings) {
              toppingsMap.set(t.id, { id: t.id, name: t.name, price: t.price });
            }
          }

          const preparedItems: Array<{
            productId: string;
            productName: string;
            size: ProductSize;
            qty: number;
            sugarLevel?: string;
            iceLevel?: string;
            itemNote?: string;
            station?: BarStation;
            toppings: Array<{ id: string; name: string; price: number }>;
            unitPrice: number;
            lineTotal: number;
          }> = [];

          let subtotal = 0;

          for (const item of dto.items) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });

            if (!product || !product.isAvailable) {
              throw new BadRequestException('Sản phẩm không tồn tại hoặc đang tạm ngưng phục vụ');
            }

            // Giữ chỗ tồn kho bằng optimistic locking: chỉ trừ khi version chưa đổi và stock còn đủ.
            // updateMany là một câu UPDATE nguyên tử trong DB nên không thể bán vượt tồn kho.
            if (product.stock < item.qty) {
              throw new ConflictException(
                `Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.stock})`,
              );
            }
            const reserved = await tx.product.updateMany({
              where: {
                id: product.id,
                version: product.version,
                stock: { gte: item.qty },
              },
              data: {
                stock: { decrement: item.qty },
                version: { increment: 1 },
              },
            });
            if (reserved.count === 0) {
              const latest = await tx.product.findUnique({ where: { id: product.id } });
              if (!latest || !latest.isAvailable || latest.stock < item.qty) {
                throw new ConflictException(
                  `Sản phẩm "${product.name}" không đủ tồn kho (còn ${latest?.stock ?? 0})`,
                );
              }
              throw new ConflictException(`OPT_LOCK_CONFLICT: ${product.id}`);
            }

            const selectedToppings = (item.toppingIds ?? []).map((tid) => {
              const found = toppingsMap.get(tid);
              if (!found) {
                throw new BadRequestException('Topping đã chọn không hợp lệ');
              }
              return found;
            });

            const toppingsPrice = selectedToppings.reduce((sum, t) => sum + t.price, 0);
            const sizePrice = SIZE_UPCHARGE[item.size] ?? 0;
            const unitPrice = product.price + sizePrice + toppingsPrice;
            const lineTotal = unitPrice * item.qty;

            subtotal += lineTotal;

            preparedItems.push({
              productId: product.id,
              productName: product.name,
              size: item.size,
              qty: item.qty,
              ...(item.sugarLevel ? { sugarLevel: item.sugarLevel } : {}),
              ...(item.iceLevel ? { iceLevel: item.iceLevel } : {}),
              ...(item.itemNote ? { itemNote: item.itemNote } : {}),
              ...(product.station ? { station: product.station } : {}),
              toppings: selectedToppings,
              unitPrice,
              lineTotal,
            });
          }

          let discountAmount = 0;
          let appliedCode: string | null = null;

          if (dto.promotionCode && dto.promotionCode.trim() !== '') {
            const normalizedCode = dto.promotionCode.trim().toUpperCase();
            const promo = await tx.promotion.findUnique({
              where: { code: normalizedCode },
            });

            if (!promo || !promo.isActive) {
              throw new NotFoundException('Mã khuyến mãi không tồn tại hoặc đã ngừng áp dụng');
            }

            if (promo.expiresAt.getTime() < Date.now()) {
              throw new BadRequestException('Mã khuyến mãi đã hết hạn sử dụng');
            }

            if (subtotal < promo.minOrderValue) {
              throw new BadRequestException(
                `Đơn hàng tối thiểu ${promo.minOrderValue.toLocaleString('vi-VN')}đ mới được áp dụng mã ${promo.code}`,
              );
            }

            const rawDiscount = Math.floor((subtotal * promo.discountPercent) / 100);
            discountAmount = Math.min(rawDiscount, promo.maxDiscountAmount);
            appliedCode = promo.code;
          }

          const afterPromo = Math.max(0, subtotal - discountAmount);
          let pointsUsed = 0;
          let balanceAfterRedeem = 0;
          let pointsDiscountAmount = 0;

          const requestedPoints = Math.floor(Number(dto.pointsUsed || 0));
          if (requestedPoints > 0 && tx.user) {
            const buyer = await tx.user.findUnique({ where: { id: userId } });
            if (buyer && buyer.role === UserRole.CUSTOMER && buyer.loyaltyPoints > 0) {
              pointsUsed = Math.min(requestedPoints, buyer.loyaltyPoints, afterPromo);
              pointsDiscountAmount = pointsUsed;
              if (pointsUsed > 0) {
                const updatedBuyer = await tx.user.update({
                  where: { id: buyer.id },
                  data: {
                    loyaltyPoints: { decrement: pointsUsed },
                  },
                });
                balanceAfterRedeem = updatedBuyer?.loyaltyPoints ?? 0;
              }
            }
          }

          const total = Math.max(0, afterPromo - pointsDiscountAmount);
          const orderCode = generateOrderCode();

          const createdOrder = await tx.order.create({
            data: {
              orderCode,
              userId,
              status: OrderStatus.PENDING,
              ...(dto.pickupMethod ? { pickupMethod: dto.pickupMethod } : {}),
              ...(dto.customerNote ? { customerNote: dto.customerNote } : {}),
              subtotal,
              discountAmount,
              pointsUsed,
              pointsDiscountAmount,
              total,
              promotionCode: appliedCode,
              items: {
                create: preparedItems,
              },
            },
            include: {
              items: true,
              payments: true,
            },
          });

          if (pointsUsed > 0 && tx.loyaltyTransaction) {
            await tx.loyaltyTransaction.create({
              data: {
                userId,
                orderId: createdOrder.id,
                points: -pointsUsed,
                balanceAfter: balanceAfterRedeem,
                type: 'REDEEM',
                description: `Dùng ${pointsUsed.toLocaleString('vi-VN')} điểm giảm giá cho đơn ${orderCode}`,
              },
            });
          }

          return createdOrder;
        });
      } catch (error) {
        const isLockConflict =
          error instanceof ConflictException && error.message.includes('OPT_LOCK_CONFLICT');
        // Trùng mã đơn (hiếm): sinh mã khác và thử lại toàn bộ giao dịch.
        if (!isLockConflict && !isOrderCodeCollision(error)) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 5 * attempt + Math.floor(Math.random() * 15)),
        );
      }
    }

    throw new ConflictException(
      'Sản phẩm không đủ tồn kho hoặc đang có giao dịch đồng thời, vui lòng thử lại',
    );
  }

  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrderById(orderId: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            loyaltyPoints: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (user.role !== UserRole.ADMIN && order.userId !== user.id) {
      throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');
    }

    return order;
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      assertTransition(order.status, dto.status);

      if (dto.status === OrderStatus.CANCELLED) {
        // Hoàn lại tồn kho đã giữ chỗ khi tạo đơn.
        if (tx.product) {
          for (const item of order.items) {
            await tx.product.updateMany({
              where: { id: item.productId },
              data: {
                stock: { increment: item.qty },
                version: { increment: 1 },
              },
            });
          }
        }
        if (order.pointsUsed && order.pointsUsed > 0 && tx.user) {
          const refunded = await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: { increment: order.pointsUsed },
            },
          });
          if (tx.loyaltyTransaction) {
            await tx.loyaltyTransaction.create({
              data: {
                userId: order.userId,
                orderId: order.id,
                points: order.pointsUsed,
                balanceAfter: refunded?.loyaltyPoints ?? 0,
                type: 'REFUND_REDEEM',
                description: `Hoàn ${order.pointsUsed} điểm do hủy đơn ${order.orderCode}`,
              },
            });
          }
        }

        // Đơn đã thanh toán (PAID): thu hồi điểm 5% đã tích cho đơn này (không hoàn tiền).
        if (order.status === OrderStatus.PAID && tx.user && tx.loyaltyTransaction?.findMany) {
          const earnedRows = await tx.loyaltyTransaction.findMany({
            where: { orderId: order.id, type: 'EARN' },
          });
          const earned = earnedRows.reduce((sum: number, r: { points: number }) => sum + r.points, 0);
          if (earned > 0) {
            const owner = await tx.user.findUnique({ where: { id: order.userId } });
            const revoke = Math.min(earned, owner?.loyaltyPoints ?? 0);
            if (revoke > 0) {
              const afterRevoke = await tx.user.update({
                where: { id: order.userId },
                data: { loyaltyPoints: { decrement: revoke } },
              });
              await tx.loyaltyTransaction.create({
                data: {
                  userId: order.userId,
                  orderId: order.id,
                  points: -revoke,
                  balanceAfter: afterRevoke?.loyaltyPoints ?? 0,
                  type: 'REVOKE_EARN',
                  description: `Thu hồi ${revoke} điểm đã tích do hủy đơn ${order.orderCode}`,
                },
              });
            }
          }
        }
      }

      
      if (dto.status === OrderStatus.PREPARING && tx.recipe && tx.ingredient) {
        for (const item of order.items) {
          if (!item.inventoryDeducted) {
            // Đánh dấu OrderItem đã được xử lý để tránh trừ kho hai lần.
            const claimedItem = await tx.orderItem.updateMany({
              where: {
                id: item.id,
                inventoryDeducted: false,
              },
              data: {
                inventoryDeducted: true,
                kdsStartedAt: new Date(),
              },
            });

            // Đơn hàng đã được xử lý bởi giao dịch khác.
            if (claimedItem.count === 0) {
              continue;
            }

            const recipes = await tx.recipe.findMany({
              where: { productId: item.productId },
            });

            for (const r of recipes) {
              const deductAmount = r.quantityNeeded * item.qty;

              // Chỉ trừ kho nếu số lượng hiện tại đủ đáp ứng.
              const result = await tx.ingredient.updateMany({
                where: {
                  id: r.ingredientId,
                  currentStock: { gte: deductAmount },
                },
                data: {
                  currentStock: { decrement: deductAmount },
                },
              });

              // Không đủ nguyên liệu: rollback toàn bộ transaction.
              if (result.count === 0) {
                throw new ConflictException(
                  `Không đủ nguyên liệu để pha "${item.productName}" cho đơn ${order.orderCode}`,
                );
              }

              const updatedIng = await tx.ingredient.findUnique({
                where: { id: r.ingredientId },
              });

              if (!updatedIng) {
                throw new NotFoundException('Không tìm thấy nguyên liệu');
              }

              await tx.inventoryTransaction.create({
                data: {
                  ingredientId: r.ingredientId,
                  orderId: order.id,
                  type: InventoryTxType.ORDER_DEDUCT,
                  quantityChange: -deductAmount,
                  balanceAfter: updatedIng.currentStock,
                  reason: `Trừ kho tự động theo BOM cho đơn ${order.orderCode} (${item.qty}x ${item.productName})`,
                  performedBy: 'KDS Barista',
                },
              });
            }
          }
        }
      }

      if (dto.status === OrderStatus.READY && tx.orderItem) {
        await tx.orderItem.updateMany({
          where: { orderId: order.id },
          data: { kdsReadyAt: new Date() },
        });
      }

      if (dto.status === OrderStatus.COMPLETED && tx.orderItem) {
        await tx.orderItem.updateMany({
          where: { orderId: order.id },
          data: { servedAt: new Date() },
        });
      }

      // Chỉ cập nhật khi trạng thái chưa bị giao dịch khác (thanh toán/hủy) đổi, tránh ghi đè.
      try {
        return await tx.order.update({
        where: { id: order.id, status: order.status },
        data: {
          status: dto.status,
          ...(dto.cancelReason ? { cancelReason: dto.cancelReason } : {}),
        },
        include: {
          items: true,
          payments: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
        });
      } catch (error) {
        if ((error as { code?: string })?.code === 'P2025') {
          throw new ConflictException('Đơn hàng vừa được cập nhật bởi thao tác khác, vui lòng tải lại');
        }
        throw error;
      }
    });
  }
}
