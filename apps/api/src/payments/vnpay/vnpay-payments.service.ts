import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators';
import { assertTransition } from '../../orders/order-state-machine';
import { getPaymentProvider, getVnpayConfig } from '../payment-config';
import {
  buildVnpayPaymentUrl,
  describeVnpayFailure,
  formatVnpayDate,
  normalizeClientIp,
  verifyVnpayQuery,
} from './vnpay.client';

// VNPay chỉ nhận số tiền từ 5.000đ và dưới 1 tỷ đồng.
const VNPAY_MIN_AMOUNT = 5_000;
const VNPAY_MAX_AMOUNT = 999_999_999;
// Link còn dưới ngần này giây thì không tái sử dụng nữa (khách quét xong là hết hạn ngay).
const REUSE_MARGIN_MS = 30_000;

export type VnpayOutcome =
  | 'paid' // đã ghi nhận thanh toán và đơn chuyển PAID
  | 'failed' // VNPay báo thất bại/khách hủy
  | 'paid_unapplied' // tiền đã về nhưng đơn không còn ở trạng thái nhận thanh toán (đã hủy, đã trả trước đó)
  | 'invalid'; // chữ ký sai, không tìm thấy giao dịch hoặc sai số tiền

export interface VnpayCallbackResult {
  rspCode: '00' | '01' | '02' | '04' | '97' | '99';
  message: string;
  outcome: VnpayOutcome;
  orderId?: string;
}

function generateTxnRef(now: Date): string {
  // Chỉ gồm chữ/số để không phụ thuộc cách encode; ngẫu nhiên để không đoán được/không trùng.
  return `BL${formatVnpayDate(now)}${randomBytes(3).toString('hex').toUpperCase()}`;
}

@Injectable()
export class VnpayPaymentsService {
  private readonly logger = new Logger(VnpayPaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Tạo link/QR thanh toán cho một đơn
  // ---------------------------------------------------------------------------
  async createPayment(user: AuthenticatedUser, orderId: string, clientIp?: string) {
    if (getPaymentProvider() !== 'vnpay') {
      throw new BadRequestException('Cổng thanh toán VNPay chưa được bật trên máy chủ');
    }
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Tài khoản quản trị không dùng để thanh toán đơn hàng');
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng cần thanh toán');
    }
    if (order.userId !== user.id) {
      throw new ForbiddenException('Bạn không có quyền thanh toán cho đơn hàng này');
    }
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYMENT_FAILED) {
      throw new BadRequestException('Đơn hàng không còn ở trạng thái chờ thanh toán');
    }
    if (order.total < VNPAY_MIN_AMOUNT) {
      throw new BadRequestException(
        `VNPay chỉ nhận thanh toán từ ${VNPAY_MIN_AMOUNT.toLocaleString('vi-VN')}đ, đơn này là ${order.total.toLocaleString('vi-VN')}đ`,
      );
    }
    if (order.total > VNPAY_MAX_AMOUNT) {
      throw new BadRequestException('Số tiền vượt hạn mức tối đa của một giao dịch VNPay');
    }

    const config = getVnpayConfig();
    const now = new Date();

    // Đang có mã còn hạn cho đơn này: trả lại đúng mã đó để khách không bị tạo nhiều link song song.
    const reusable = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
        amount: order.total,
        expiresAt: { gt: new Date(now.getTime() + REUSE_MARGIN_MS) },
        paymentUrl: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (reusable?.paymentUrl && reusable.expiresAt && reusable.txnRef) {
      return this.toCreateResponse(order.id, reusable.txnRef, reusable.paymentUrl, reusable.expiresAt, order.total);
    }

    const txnRef = generateTxnRef(now);
    const expiresAt = new Date(now.getTime() + config.qrTtlMinutes * 60 * 1000);
    const paymentUrl = buildVnpayPaymentUrl(config, {
      txnRef,
      amountVnd: order.total,
      orderInfo: `Thanh toan don hang ${order.orderCode.replace('#', '')} Brewlite`,
      ipAddr: normalizeClientIp(clientIp),
      createdAt: now,
      expiresAt,
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        idempotencyKey: `vnpay-${txnRef}`,
        amount: order.total,
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
        txnRef,
        expiresAt,
        paymentUrl,
      },
    });

    return this.toCreateResponse(order.id, txnRef, paymentUrl, expiresAt, order.total);
  }

  private toCreateResponse(orderId: string, txnRef: string, paymentUrl: string, expiresAt: Date, amount: number) {
    return { orderId, txnRef, paymentUrl, expiresAt: expiresAt.toISOString(), amount };
  }

  // ---------------------------------------------------------------------------
  // Xử lý kết quả VNPay gửi về (IPN server-to-server hoặc Return qua trình duyệt)
  // Cả hai đi chung một đường: chữ ký hợp lệ là bằng chứng, và chỉ ghi nhận đúng một lần.
  // ---------------------------------------------------------------------------
  async handleCallback(query: Record<string, unknown>): Promise<VnpayCallbackResult> {
    if (getPaymentProvider() !== 'vnpay') {
      return { rspCode: '99', message: 'VNPay chưa được bật', outcome: 'invalid' };
    }
    const config = getVnpayConfig();

    if (!verifyVnpayQuery(config, query)) {
      return { rspCode: '97', message: 'Invalid signature', outcome: 'invalid' };
    }

    const txnRef = String(query.vnp_TxnRef ?? '');
    const payment = txnRef
      ? await this.prisma.payment.findUnique({ where: { txnRef } })
      : null;
    if (!payment) {
      return { rspCode: '01', message: 'Order not found', outcome: 'invalid' };
    }

    if (Number(query.vnp_Amount) !== payment.amount * 100) {
      this.logger.warn(`VNPay ${txnRef}: sai số tiền (nhận ${String(query.vnp_Amount)}, cần ${payment.amount * 100})`);
      return { rspCode: '04', message: 'Invalid amount', outcome: 'invalid', orderId: payment.orderId };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return {
        rspCode: '02',
        message: 'Order already confirmed',
        outcome: this.outcomeOfSettledPayment(payment.status, payment.errorMessage),
        orderId: payment.orderId,
      };
    }

    const responseCode = String(query.vnp_ResponseCode ?? '');
    const transactionStatus = String(query.vnp_TransactionStatus ?? '');
    const gatewaySuccess = responseCode === '00' && transactionStatus === '00';
    const gatewayTxnNo = query.vnp_TransactionNo ? String(query.vnp_TransactionNo) : null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // "Giành quyền" xử lý: chỉ một trong IPN/Return/IPN gửi lại thắng, những lần sau count = 0.
        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.PENDING },
          data: {
            status: gatewaySuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
            gatewayCode: responseCode || null,
            transactionRef: gatewayTxnNo,
            paidAt: gatewaySuccess ? new Date() : null,
            errorMessage: gatewaySuccess ? null : describeVnpayFailure(responseCode),
          },
        });
        if (claimed.count === 0) {
          const latest = await tx.payment.findUnique({ where: { id: payment.id } });
          return {
            rspCode: '02' as const,
            message: 'Order already confirmed',
            outcome: this.outcomeOfSettledPayment(latest?.status, latest?.errorMessage),
            orderId: payment.orderId,
          };
        }

        const order = await tx.order.findUnique({ where: { id: payment.orderId } });
        if (!order) {
          return { rspCode: '01' as const, message: 'Order not found', outcome: 'invalid' as const };
        }
        const payable =
          order.status === OrderStatus.PENDING || order.status === OrderStatus.PAYMENT_FAILED;

        if (!gatewaySuccess) {
          if (order.status === OrderStatus.PENDING) {
            assertTransition(order.status, OrderStatus.PAYMENT_FAILED);
            await tx.order.updateMany({
              where: { id: order.id, status: OrderStatus.PENDING },
              data: { status: OrderStatus.PAYMENT_FAILED },
            });
          }
          return {
            rspCode: '00' as const,
            message: 'Confirm Success',
            outcome: 'failed' as const,
            orderId: order.id,
          };
        }

        if (!payable) {
          // Tiền đã về nhưng đơn đã hủy hoặc đã được thanh toán bằng giao dịch khác.
          // Không đụng vào đơn; ghi chú để người vận hành đối soát và hoàn tiền thủ công.
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              errorMessage: `Đã nhận tiền nhưng đơn đang ở trạng thái ${order.status}; cần đối soát/hoàn tiền thủ công`,
            },
          });
          this.logger.warn(`VNPay ${txnRef}: nhận tiền cho đơn ${order.orderCode} đang ${order.status}`);
          return {
            rspCode: '00' as const,
            message: 'Confirm Success',
            outcome: 'paid_unapplied' as const,
            orderId: order.id,
          };
        }

        assertTransition(order.status, OrderStatus.PAID);
        const moved = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: { status: OrderStatus.PAID },
        });
        if (moved.count === 0) {
          // Đơn vừa bị hủy/đổi trạng thái ở thao tác khác ngay giữa chừng.
          await tx.payment.update({
            where: { id: payment.id },
            data: { errorMessage: 'Đã nhận tiền nhưng đơn vừa đổi trạng thái; cần đối soát/hoàn tiền thủ công' },
          });
          return {
            rspCode: '00' as const,
            message: 'Confirm Success',
            outcome: 'paid_unapplied' as const,
            orderId: order.id,
          };
        }

        // Tích điểm 5% giống luồng thanh toán cũ (chỉ khách hàng, không tích cho admin).
        const owner = await tx.user.findUnique({ where: { id: order.userId } });
        const pointsEarned = owner?.role === UserRole.CUSTOMER ? Math.floor(order.total * 0.05) : 0;
        if (pointsEarned > 0) {
          const earnedUser = await tx.user.update({
            where: { id: order.userId },
            data: { loyaltyPoints: { increment: pointsEarned } },
          });
          await tx.loyaltyTransaction.create({
            data: {
              userId: order.userId,
              orderId: order.id,
              points: pointsEarned,
              balanceAfter: earnedUser.loyaltyPoints,
              type: 'EARN',
              description: `Tích điểm hoàn 5% hóa đơn thanh toán đơn hàng ${order.orderCode}`,
            },
          });
        }

        return {
          rspCode: '00' as const,
          message: 'Confirm Success',
          outcome: 'paid' as const,
          orderId: order.id,
        };
      });
    } catch (error) {
      this.logger.error(`VNPay ${txnRef}: lỗi khi ghi nhận kết quả`, error instanceof Error ? error.stack : String(error));
      // 99 để VNPay gửi lại IPN sau; giao dịch đã rollback nên vẫn ở trạng thái PENDING.
      return { rspCode: '99', message: 'Unknown error', outcome: 'invalid', orderId: payment.orderId };
    }
  }

  private outcomeOfSettledPayment(
    status: PaymentStatus | undefined,
    errorMessage: string | null | undefined,
  ): VnpayOutcome {
    if (status === PaymentStatus.SUCCESS) {
      return errorMessage ? 'paid_unapplied' : 'paid';
    }
    return 'failed';
  }
}
