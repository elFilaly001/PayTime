import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionStatus } from './schema/transaction.schema';
import { Payments } from '../payment/schema/payment.schema'; 
import { Tickets } from '../tickets/schema/ticket.schema';
import { ConfigService } from '@nestjs/config';
import { Auth } from 'src/auth/Schema/Auth.schema';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<Transaction>,
    @InjectModel(Tickets.name) private readonly ticketModel: Model<Tickets>,
    @InjectModel(Payments.name) private readonly paymentsModel: Model<Payments>,
    @InjectModel('Auth') private readonly authModel: Model<Auth>,
    private readonly configService: ConfigService
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
  
  async payWithCard(ticketId: string, userId: string , paymentMethod : string) {

    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    
    // Check if user is loanee
    if (ticket.loanee.toString() !== userId) {
      throw new BadRequestException('Only the loanee can make a payment');
    }

    if (ticket.status === 'PAYED') {
      throw new BadRequestException('Ticket already payed');
    }
    
    const user = await this.authModel.findById(userId); 


    const paymentMethods = await this.paymentsModel.find({ 
      stripeCustomerId: user.StripeCostumer
    });
    
    if (paymentMethods.length === 0) {
      await this.transactionModel.create({
        ticketId: new Types.ObjectId(ticketId),
        paymentMethod: paymentMethod,
        status: TransactionStatus.FAILED,
        errorMessage: 'No payment methods found for this user'
      });
      throw new BadRequestException('No payment methods found for this user');
    }
    
    const defaultPaymentMethod = paymentMethods.find(pm => pm.isDefault === true);
    if (!defaultPaymentMethod) {
      throw new BadRequestException('No default payment method found');
    }
    
    // Create transaction record
    const transaction = await this.transactionModel.create({
      ticketId: new Types.ObjectId(ticketId),
      paymentMethod: paymentMethod ,
      paymentId: defaultPaymentMethod._id,
      status: TransactionStatus.COMPLETED,
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

  async getDetailedTransactionsByUser(userId: string) {
    const userObj = new Types.ObjectId(userId);
    
    // Find all tickets where the user is either loaner or loanee
    const tickets = await this.ticketModel.find({
      $or: [
        { loanee: userObj },
        { loaner: userObj }
      ]
    });
    
    if (tickets.length === 0) {
      return [];
    }
    
    const ticketIds = tickets.map(t => t._id);
    
 
    const transactions = await this.transactionModel
      .find({ ticketId: { $in: ticketIds } })
      .sort({ createdAt: -1 })
      .exec();
    
    const ticketMap = tickets.reduce((map, ticket) => {
      map[ticket._id.toString()] = ticket;
      return map;
    }, {});
    
    
    const detailedTransactions = transactions.map(transaction => {
      const ticket = ticketMap[transaction.ticketId.toString()];
      const isLoaner = ticket.loaner.toString() === userId;
      
      return {
        transaction: {
          _id: transaction._id,
          status: transaction.status,
          paymentMethod: transaction.paymentMethod,
        },
        ticket: {
          _id: ticket._id,
          amount: ticket.amount,
          type: ticket.Type,
          place: ticket.Place,
          dueDate: ticket.dueDate,
          paidAt: ticket.paidAt,
          status: ticket.status
        },
        counterparty: {
          id: isLoaner ? ticket.loanee : ticket.loaner,
          name: isLoaner ? ticket.loaneeName : ticket.loanerName,
          role: isLoaner ? 'loanee' : 'loaner'
        },
        userRole: isLoaner ? 'loaner' : 'loanee',
        direction: isLoaner ? 'outgoing' : 'incoming'
      };
    });
    
    return detailedTransactions;
  }
}