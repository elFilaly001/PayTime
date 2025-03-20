import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionStatus } from './schema/transaction.schema';
import { Payments } from '../payment/schema/payment.schema'; 
import { Tickets } from '../tickets/schema/ticket.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Tickets.name) private ticketModel: Model<Tickets>,
    @InjectModel('Payments') private paymentModel: Model<Payments>, 
    private configService: ConfigService
  ) {}

  async payWithCash(ticketId: string, userId: string) {
    // Find the ticket
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    
    // Check if user is loanee (the person who should pay)
    if (ticket.loanee.toString() !== userId) {
      throw new BadRequestException('Only the loanee can make a payment');
    }
    
    
    const transaction = await this.transactionModel.create({
      ticketId: new Types.ObjectId(ticketId),
      paymentMethod: 'CASH',
      status: TransactionStatus.COMPLETED
    });
    
    // Update ticket status
    await this.ticketModel.updateOne(
      { _id: ticket._id },
      {
        status: 'PAYED',
        paidAt: new Date()
      }
    );
    
    return transaction;
  }
  
  async payWithCard(ticketId: string, userId: string) {
    // Find the ticket
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    
    // Check if user is loanee
    if (ticket.loanee.toString() !== userId) {
      throw new BadRequestException('Only the loanee can make a payment');
    }
      
    // Look for the stripe customer ID in payment documents
    const paymentMethods = await this.paymentModel.find({ 
      userId: new Types.ObjectId(userId)
    });
    
    if (paymentMethods.length === 0) {
      throw new BadRequestException('No payment methods found for this user');
    }
    
    // Find default payment method
    const defaultPaymentMethod = paymentMethods.find(pm => pm.isDefault === true);
    if (!defaultPaymentMethod) {
      throw new BadRequestException('No default payment method found');
    }
    
    // Create transaction record
    const transaction = await this.transactionModel.create({
      ticketId: new Types.ObjectId(ticketId),
      paymentMethod: 'CARD', // Using either 'MANUAL_CARD' or 'AUTO_CARD' based on ticket.Type
      paymentId: defaultPaymentMethod._id,
      status: TransactionStatus.COMPLETED,
      stripePaymentMethodId: defaultPaymentMethod.stripePaymentMethodId
    });
    
    // Update ticket status
    await this.ticketModel.updateOne(
      { _id: ticket._id },
      {
        status: 'PAYED',
        paidAt: new Date(),
        paymentId: defaultPaymentMethod._id
      }
    );
    
    return transaction;
  }
  
  async getTransactionsByTicketId(ticketId: string) {
    return this.transactionModel.find({ ticketId }).sort({ createdAt: -1 }).exec();
  }
  
  async getTransactionById(id: string) {
    const transaction = await this.transactionModel.findById(id).exec();
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }
}