import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StripeService } from '../stripe/stripe.service';
import { Payments } from './schema/payment.schema';
import { Transaction } from '../transaction/schema/transaction.schema';

@Injectable()
export class PaymentService {
  constructor(
    private stripeService: StripeService,
    @InjectModel('Payments') private paymentModel: Model<Payments>,
    @InjectModel('Transaction') private transactionModel: Model<Transaction>
  ) {}

  async processLoanRepayment(
    amount: number,
    senderId: string,
    receiverId: string,
    loanId: string,
    paymentMethodId: string,
    customerId: string
  ) {
    const session = await this.paymentModel.startSession();
    session.startTransaction();

    try {
      // Process the payment through Stripe
      const paymentIntent = await this.stripeService.processLoanRepayment(
        amount,
        'usd',
        paymentMethodId,
        customerId
      );

      // Create payment record
      const payment = await this.paymentModel.create({
        userId: senderId,
        stripeCustomerId: customerId,
        stripePaymentMethodId: paymentMethodId,
        amount: amount,
        status: paymentIntent.status,
        stripePaymentIntentId: paymentIntent.id
      });

      // Create transaction record
      const transaction = await this.transactionModel.create({
        senderId,
        receiverId,
        amount,
        status: 'COMPLETED',
        type: 'REPAYMENT',
        paymentMethod: 'STRIPE',
        paymentId: payment._id,
        metadata: {
          loanId,
          description: 'Loan repayment'
        }
      });

      await session.commitTransaction();
      return { payment, transaction };
    } catch (error) {
      await session.abortTransaction();
      throw new BadRequestException(error.message);
    } finally {
      session.endSession();
    }
  }

  async recordCashPayment(
    amount: number,
    senderId: string,
    receiverId: string,
    loanId: string,
    meetingLocation?: string,
    meetingDate?: Date
  ) {
    try {
      const transaction = await this.transactionModel.create({
        senderId,
        receiverId,
        amount,
        status: 'CASH_PENDING_CONFIRMATION',
        type: 'REPAYMENT',
        paymentMethod: 'CASH',
        metadata: {
          loanId,
          description: 'Cash payment for loan repayment',
          meetingLocation,
          meetingDate
        }
      });

      return transaction;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async addCreditCard(
    userId: string,
    customerId: string,
    paymentMethodId: string
  ) {
    try {
      // Attach payment method to customer in Stripe
      const paymentMethod = await this.stripeService.attachPaymentMethod(
        customerId,
        paymentMethodId
      );

      // Get card details from the payment method
      const card = paymentMethod.card;

      // Create payment method record in database
      const payment = await this.paymentModel.create({
        userId,
        stripeCustomerId: customerId,
        stripePaymentMethodId: paymentMethodId,
        last4: card.last4,
        cardBrand: card.brand,
        expiryMonth: card.exp_month,
        expiryYear: card.exp_year,
        isDefault: false,
        isActive: true
      });

      // If this is the first card, make it default
      const cardCount = await this.paymentModel.countDocuments({ userId });
      if (cardCount === 1) {
        await this.setDefaultCard(userId, payment._id.toString());
      }

      return payment;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async deleteCreditCard(userId: string, paymentId: string) {
    try {
      const payment = await this.paymentModel.findOne({ 
        _id: paymentId,
        userId 
      });

      if (!payment) {
        throw new NotFoundException('Payment method not found');
      }

      // Detach payment method from Stripe
      await this.stripeService.detachPaymentMethod(payment.stripePaymentMethodId);

      // If this was the default card, set another card as default
      if (payment.isDefault) {
        const anotherCard = await this.paymentModel.findOne({ 
          userId,
          _id: { $ne: paymentId },
          isActive: true
        });
        if (anotherCard) {
          await this.setDefaultCard(userId, anotherCard._id.toString());
        }
      }

      // Soft delete the payment method
      await this.paymentModel.findByIdAndUpdate(paymentId, {
        isActive: false
      });

      return { message: 'Payment method deleted successfully' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  private async setDefaultCard(userId: string, paymentId: string) {
    // Remove default flag from all other cards
    await this.paymentModel.updateMany(
      { userId },
      { isDefault: false }
    );

    // Set the new default card
    await this.paymentModel.findByIdAndUpdate(paymentId, {
      isDefault: true
    });
  }

  async setupCardForUser(
    userId: string,
    email: string,
    name: string,
    paymentMethodId: string  // Get this from Stripe Elements on frontend
  ) {
    try {
      // 1. Create or get Stripe customer
      const customer = await this.stripeService.createCustomer(email, name);

      // 2. Attach payment method to customer
      const paymentMethod = await this.stripeService.attachPaymentMethod(
        customer.id,
        paymentMethodId
      );

      // 3. Store only non-sensitive data
      const payment = await this.paymentModel.create({
        userId,
        stripeCustomerId: customer.id,
        stripePaymentMethodId: paymentMethodId,
        last4: paymentMethod.card.last4,          // Last 4 digits only
        cardBrand: paymentMethod.card.brand,      // e.g., 'visa'
        expiryMonth: paymentMethod.card.exp_month,
        expiryYear: paymentMethod.card.exp_year,
        isDefault: false,
        isActive: true
      });

      return payment;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}