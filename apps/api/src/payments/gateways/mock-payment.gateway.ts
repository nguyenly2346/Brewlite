
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentMethod } from '@prisma/client';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  async charge(
    amount: number,
    method: PaymentMethod,
    simulateFailure = false,
  ) {
    if (amount <= 0) {
      return {
        success: false,
        errorMessage: 'Số tiền thanh toán không hợp lệ',
      };
    }

    if (simulateFailure) {
      return {
        success: false,
        errorMessage: 'Giao dịch bị từ chối bởi cổng thanh toán',
      };
    }

    return {
      success: true,
      transactionRef: randomUUID(),
    };
  }
}
