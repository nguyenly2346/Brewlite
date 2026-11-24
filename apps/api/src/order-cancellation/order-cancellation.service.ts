
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators';
import { assertTransition } from '../orders/order-state-machine';

@Injectable()
export class OrderCancellationService {
  constructor(private readonly prisma: PrismaService) {}

  async cancelOrder(orderId: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true, items: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      // Kiểm tra quyền sở hữu đơn hàng
      if (order.userId !== user.id) {
        throw new ForbiddenException(
          'Bạn không có quyền hủy đơn hàng này',
        );
      }

      // Đơn đã hủy thì không được hủy lại.
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          'Đơn hàng đã được hủy trước đó, không thể hủy lại',
        );
      }

      // Khách chỉ được hủy khi quầy chưa nhận pha chế:
      // chưa thanh toán (PENDING / PAYMENT_FAILED) hoặc đã thanh toán nhưng quầy chưa nhận (PAID).
      const cancellableStatuses: OrderStatus[] = [
        OrderStatus.PENDING,
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.PAID,
      ];
      if (!cancellableStatuses.includes(order.status)) {
        throw new BadRequestException(
          'Quầy đã nhận pha chế hoặc đơn đã hoàn tất, không thể hủy đơn hàng',
        );
      }

      const wasPaid = order.status === OrderStatus.PAID;

      assertTransition(order.status, OrderStatus.CANCELLED);

      // Cập nhật có điều kiện để chống hai yêu cầu hủy đồng thời
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          userId: user.id,
          status: order.status,
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: 'Khách hàng yêu cầu hủy đơn',
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'Đơn hàng đã được xử lý bởi yêu cầu khác',
        );
      }

      // Hoàn lại tồn kho đã giữ chỗ khi tạo đơn.
      for (const item of order.items) {
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.qty }, version: { increment: 1 } },
        });
      }

      // Hoàn điểm tích lũy đã sử dụng
      if (order.pointsUsed > 0) {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            loyaltyPoints: {
              increment: order.pointsUsed,
            },
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            userId: user.id,
            orderId: order.id,
            points: order.pointsUsed,
            balanceAfter: updatedUser.loyaltyPoints,
            type: 'REFUND_REDEEM',
            description: `Hoàn ${order.pointsUsed} điểm do hủy đơn ${order.orderCode}`,
          },
        });
      }

      // Đơn đã thanh toán: thu hồi điểm 5% đã tích cho đơn này.
      if (wasPaid) {
        const earnedRows = await tx.loyaltyTransaction.findMany({
          where: { orderId: order.id, type: 'EARN' },
        });
        const earned = earnedRows.reduce((sum, r) => sum + r.points, 0);
        if (earned > 0) {
          const owner = await tx.user.findUnique({ where: { id: user.id } });
          const revoke = Math.min(earned, owner?.loyaltyPoints ?? 0);
          if (revoke > 0) {
            const afterRevoke = await tx.user.update({
              where: { id: user.id },
              data: { loyaltyPoints: { decrement: revoke } },
            });
            await tx.loyaltyTransaction.create({
              data: {
                userId: user.id,
                orderId: order.id,
                points: -revoke,
                balanceAfter: afterRevoke.loyaltyPoints,
                type: 'REVOKE_EARN',
                description: `Thu hồi ${revoke} điểm đã tích do hủy đơn ${order.orderCode}`,
              },
            });
          }
        }
      }

      const cancelled = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          payments: true,
        },
      });

      // Hệ thống chưa có tài khoản ví/thẻ thật của khách nên việc hoàn tiền chỉ mang tính
      // thông báo (mô phỏng), không phát sinh giao dịch thật.
      const refund = wasPaid
        ? {
            amount: order.total,
            simulated: true,
            message: `Đã ghi nhận hoàn ${order.total.toLocaleString('vi-VN')}đ cho đơn ${order.orderCode}. Tiền sẽ về phương thức thanh toán ban đầu trong 1-3 ngày làm việc.`,
          }
        : null;

      return { ...cancelled, refund };
    });
  }
}
