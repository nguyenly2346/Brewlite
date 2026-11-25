import { Body, Controller, ForbiddenException, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './payments.dto';
import { JwtAuthGuard } from '../common/guards';
import { AuthenticatedUser, CurrentUser } from '../common/decorators';
import { isMockPaymentEnabled } from './payment-config';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async processPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProcessPaymentDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Tài khoản quản trị không dùng để thanh toán đơn hàng');
    }
    // Khi đã bật cổng thật, endpoint mock phải đóng: nếu không, ai cũng tự đánh dấu đơn là đã trả tiền.
    if (!isMockPaymentEnabled()) {
      throw new ForbiddenException('Thanh toán mô phỏng đã tắt, vui lòng thanh toán qua VNPay');
    }
    return this.paymentsService.processPayment(user, dto, headerIdempotencyKey);
  }
}
