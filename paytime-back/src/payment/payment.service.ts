import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StripeService } from '../stripe/stripe.service';
import { Payments } from './schema/payment.schema';
import { Transaction } from '../transaction/schema/transaction.schema';
import { CreatePaymentIdDto } from './dto/create-payment.dto';

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

  async addCard(Payment: CreatePaymentIdDto) {
    try {
      // Create payment method record in database
      const payment = await this.paymentModel.create({
        stripeCustomerId: Payment.costumerId,
        stripePaymentMethodId: Payment.paymentMethodId,
        holderName: Payment.holderName,
        last4: Payment.last4,
        cardBrand: Payment.brand,
        expiryMonth: Payment.exp_month,
        expiryYear: Payment.exp_year,
        isDefault: false,
      });

      // If this is the first card, make it default
      const cardCount = await this.paymentModel.countDocuments({ stripeCustomerId: Payment.costumerId });
      if (cardCount === 1) {
        await this.setDefaultCard(Payment.costumerId, payment._id.toString());
      }

      return payment;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async deleteCreditCard(Id: string) {
    try {

      const payment = await this.paymentModel.findById(Id);

      if (!payment) {
        throw new NotFoundException(`Payment method with ID ${Id} not found`);
      }if (payment.isDefault) {
        throw new BadRequestException('Cannot delete default payment method');
      }
      await this.paymentModel.findByIdAndDelete(Id);
      return { message: 'Payment method deleted successfully' };
      
      
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }


  async GetUserCards(costumerId:string) {
    try {
      const cards = await this.paymentModel.find({ stripeCustomerId: costumerId });
      return cards;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async setDefaultCard(customerId: string, Id: string) {
    try {
      // First, set all cards for this customer to non-default
      await this.paymentModel.updateMany(
        { stripeCustomerId: customerId },
        { isDefault: false }
      );
      
      // Then set the specified card as default
      const updatedCard = await this.paymentModel.findByIdAndUpdate(
        Id,
        { isDefault: true },
        { new: true } 
      );
      
      if (!updatedCard) {
        throw new NotFoundException(`Payment method with ID ${Id} not found`);
      }
      
      return updatedCard;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
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