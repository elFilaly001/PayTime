import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(@Inject('STRIPE_API_KEY') private readonly apiKey: string) {
    this.stripe = new Stripe(this.apiKey, {
      apiVersion: '2025-02-24.acacia' as any,
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
    return await this.stripe.customers.create({
      email,
      name,
    });
  }
  async createPaymentToken(
    number: string,
    exp_month: string,
    exp_year: string,
    cvc: string
  ) : Promise<string> {
    try {
      const token = await this.stripe.tokens.create({
        card: {
          number,
          exp_month,
          exp_year,
          cvc,
        },
      });
      
      return token.id; // This will return something like 'tok_...'
    } catch (error) {
      throw new Error(`Failed to create token: ${error.message}`);
    }
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
    customerId: string,
    options?: { idempotencyKey?: string }
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: 'Loan Repayment',
    }, {
      idempotencyKey: options?.idempotencyKey
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

  // Process payment from loanee
  async processPayment(amount: number, currency: string, paymentMethodId: string, description: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      description
    });
  }

  // Send payout to loaner
  async sendPayout(amount: number, currency: string, destination: string, description: string): Promise<Stripe.Payout> {
    return this.stripe.payouts.create({
      amount: Math.round(amount * 100),
      currency,
      method: 'instant', // or 'standard' for non-instant transfers
      destination,
      description
    });
  }

  // Get or create bank account for user
  async getBankAccount(userId: string): Promise<string> {
    // In a real implementation, you'd store and retrieve bank accounts
    // For test mode, we can create a test bank account
    
    // This is just for testing - in production you'd retrieve from your database
    const testBankAccount = await this.stripe.accounts.createExternalAccount('acct_123', {
      external_account: {
        object: 'bank_account',
        country: 'US',
        currency: 'usd',
        account_holder_name: 'Test User',
        account_holder_type: 'individual',
        routing_number: '110000000', // Test routing number
        account_number: '000123456789' // Test account number
      }
    });
    
    return testBankAccount.id;
  }
}