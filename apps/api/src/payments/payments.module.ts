import { Module, OnModuleInit } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_GATEWAY } from './interfaces/payment-gateway.interface';
import { MockPaymentGateway } from './gateways/mock-payment.gateway';
import { VnpayController } from './vnpay/vnpay.controller';
import { VnpayPaymentsService } from './vnpay/vnpay-payments.service';
import { assertPaymentConfigValid } from './payment-config';

@Module({
  controllers: [PaymentsController, VnpayController],
  providers: [
    PaymentsService,
    VnpayPaymentsService,
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule implements OnModuleInit {
  // Cấu hình thanh toán sai (thiếu khóa VNPay, gõ sai PAYMENT_PROVIDER) thì dừng ngay khi khởi động.
  onModuleInit() {
    assertPaymentConfigValid();
  }
}
