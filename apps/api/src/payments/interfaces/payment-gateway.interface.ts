
import { PaymentMethod } from '@prisma/client';

export interface PaymentGateway {
  charge(
    amount: number,
    method: PaymentMethod,
    simulateFailure?: boolean,
  ): Promise<{
    success: boolean;
    transactionRef?: string;
    errorMessage?: string;
  }>;
}

export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

