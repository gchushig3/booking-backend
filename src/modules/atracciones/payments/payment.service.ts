import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_PROVIDER, PaymentProvider, PaymentRequest } from './payment-provider.interface';

@Injectable()
export class PaymentService {
  constructor(@Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider) {}
  process(request: PaymentRequest) { return this.provider.charge(request); }
}
