import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessPaymentDto } from './payments.dto';
import { assertTransition } from '../orders/order-state-machine';
import { AuthenticatedUser } from '../common/decorators';
import {PAYMENT_GATEWAY,PaymentGateway,} from './interfaces/payment-gateway.interface';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) 
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async processPayment(
    user: AuthenticatedUser,
    dto: ProcessPaymentDto,
    headerIdempotencyKey?: string,
  ) {
    const idempotencyKey = (headerIdempotencyKey || dto.idempotencyKey || '').trim();
    if (!idempotencyKey) {
      throw new BadRequestException('Thiếu khóa chống trùng lặp giao dịch (Idempotency-Key)');
    }

    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
      include: {
        order: {
          include: {
            items: true,
            payments: true,
          },
        },
      },
    });

    if (existingPayment) {
      return {
        payment: existingPayment,
        order: existingPayment.order,
        idempotentReplay: true,
        pointsEarned:
          existingPayment.status === PaymentStatus.SUCCESS && user.role === UserRole.CUSTOMER
            ? Math.floor(existingPayment.amount * 0.05)
            : 0,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const recheckPayment = await tx.payment.findUnique({
        where: { idempotencyKey },
        include: {
          order: {
            include: {
              items: true,
              payments: true,
            },
          },
        },
      });

      if (recheckPayment) {
        return {
          payment: recheckPayment,
          order: recheckPayment.order,
          idempotentReplay: true,
          pointsEarned:
            recheckPayment.status === PaymentStatus.SUCCESS && user.role === UserRole.CUSTOMER
              ? Math.floor(recheckPayment.amount * 0.05)
              : 0,
        };
      }

      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng cần thanh toán');
      }

      if (user.role !== UserRole.ADMIN && order.userId !== user.id) {
        throw new ForbiddenException('Bạn không có quyền thanh toán cho đơn hàng này');
      }

      const gatewayResult = await this.paymentGateway.charge(
        order.total,
        dto.method,
        dto.simulateFailure,
      );

      if (!gatewayResult.success) {
        assertTransition(order.status, OrderStatus.PAYMENT_FAILED);

        const failedPayment = await tx.payment.create({
          data: {
            orderId: order.id,
            idempotencyKey,
            amount: order.total,
            method: dto.method,
            status: PaymentStatus.FAILED,
            errorMessage:
              gatewayResult.errorMessage || 'Giao dịch thanh toán thất bại',
          },
        });

        const updatedOrder = await this.updateOrderStatusGuarded(
          tx,
          order.id,
          order.status,
          OrderStatus.PAYMENT_FAILED,
        );

        return {
          payment: failedPayment,
          order: updatedOrder,
          idempotentReplay: false,
          pointsEarned: 0,
        };
      }

      assertTransition(order.status, OrderStatus.PAID);

      const successPayment = await tx.payment.create({
        data: {
          orderId: order.id,
          idempotencyKey,
          amount: order.total,
          method: dto.method,
          status: PaymentStatus.SUCCESS,
        },
      });

      const updatedOrder = await this.updateOrderStatusGuarded(
        tx,
        order.id,
        order.status,
        OrderStatus.PAID,
      );

      const pointsEarned =
        user.role === UserRole.CUSTOMER ? Math.floor(order.total * 0.05) : 0;
      if (pointsEarned > 0) {
        const earnedUser = await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPoints: { increment: pointsEarned },
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            points: pointsEarned,
            balanceAfter: earnedUser?.loyaltyPoints ?? 0,
            type: 'EARN',
            description: `Tích điểm hoàn 5% hóa đơn thanh toán đơn hàng ${order.orderCode}`,
          },
        });
      }

      return {
        payment: successPayment,
        order: updatedOrder,
        idempotentReplay: false,
        pointsEarned,
      };
    });
  }

  // Cập nhật có điều kiện theo trạng thái đã đọc: nếu đơn vừa bị hủy/đổi ở tab khác thì
  // báo xung đột và rollback thay vì ghi đè (tránh đơn đã hủy lại thành PAID).
  private async updateOrderStatusGuarded(
    tx: any,
    orderId: string,
    expectedStatus: OrderStatus,
    nextStatus: OrderStatus,
  ) {
    try {
      return await tx.order.update({
        where: { id: orderId, status: expectedStatus },
        data: { status: nextStatus },
        include: {
          items: true,
          payments: true,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2025') {
        throw new ConflictException('Đơn hàng vừa được cập nhật bởi thao tác khác, vui lòng tải lại');
      }
      throw error;
    }
  }
}
