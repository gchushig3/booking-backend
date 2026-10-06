import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { PaymentProvider, PaymentRequest, PaymentResult } from './payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async charge(request: PaymentRequest): Promise<PaymentResult> {
    const transactionHash = createHash('sha256').update(`${randomUUID()}:${request.amount}`).digest('hex');
    if (process.env.MOCK_PAYMENT_RESULT?.toUpperCase() === 'FAILED') {
      return { status: 'FAILED', transactionHash, reason: 'Mock payment declined' };
    }
    return { status: 'SUCCESS', transactionHash };
  }
}
