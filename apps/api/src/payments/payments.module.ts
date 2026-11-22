
import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_GATEWAY } from './interfaces/payment-gateway.interface';
import { MockPaymentGateway } from './gateways/mock-payment.gateway';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
