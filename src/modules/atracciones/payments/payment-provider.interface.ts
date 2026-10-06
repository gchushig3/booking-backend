export type PaymentResult =
  | { status: 'SUCCESS'; transactionHash: string }
  | { status: 'FAILED'; transactionHash: string; reason: string };

export interface PaymentRequest {
  amount: number;
  method: 'CREDIT_CARD' | 'PAYPAL';
  cardholder?: string;
  lastFour?: string;
}

export interface PaymentProvider {
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
