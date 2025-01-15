import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(@Inject('STRIPE_API_KEY') private readonly apiKey: string) {
    this.stripe = new Stripe(this.apiKey, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  async createPaymentIntent(amount: number, currency: string, customerId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      customer: customerId,
      payment_method_types: ['card'],
    });
  }

  async createCustomer(email: string, name: string): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      name,
    });
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  async processLoanRepayment(
    amount: number, 
    currency: string, 
    paymentMethodId: string, 
    customerId: string
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: 'Loan Repayment',
    });
  }

  async refundPayment(paymentIntentId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
    });
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }
}