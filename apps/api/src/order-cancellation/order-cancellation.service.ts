
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

      // Chỉ cho phép khách hàng hủy đơn chưa thanh toán
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.PAYMENT_FAILED
      ) {
        throw new BadRequestException(
          'Không thể hủy đơn hàng ở trạng thái hiện tại',
        );
      }

      // Không hủy nếu đã có giao dịch thanh toán thành công
      if (order.payments.some((p) => p.status === 'SUCCESS')) {
        throw new BadRequestException(
          'Đơn hàng đã thanh toán, cần xử lý hoàn tiền riêng',
        );
      }

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

      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          payments: true,
        },
      });
    });
  }
}
