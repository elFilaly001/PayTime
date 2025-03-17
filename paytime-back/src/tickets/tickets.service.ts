import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tickets } from './schema/ticket.schema';
import { Transaction } from '../transaction/schema/transaction.schema';
import { StripeService } from '../stripe/stripe.service';
import { CreateTicketDto, ProcessAutomaticPaymentDto, ProcessManualPaymentDto } from './dto/create-ticket.dto';
import { Payments } from '../payment/schema/payment.schema';
import { Logger } from '@nestjs/common';
import { Request } from 'express';
import { Auth } from '../auth/Schema/Auth.schema';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel('Tickets') private ticketModel: Model<Tickets>,
    @InjectModel('Auth') private authModel: Model<Auth>,
    private stripeService: StripeService
  ) { }


  async createTicket(userId: any, createTicketDto: CreateTicketDto): Promise<Tickets> {
    try {
      
      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid or missing user ID');
      }
      
      if (!createTicketDto.loaner || !Types.ObjectId.isValid(createTicketDto.loaner)) {
        throw new BadRequestException('Invalid or missing loaner ID');
      }
      
      const loaneeIdObj = new Types.ObjectId(userId);
      const loanerIdObj = new Types.ObjectId(createTicketDto.loaner);
      
      const loanee = await this.authModel.findById(loaneeIdObj);
      if (!loanee) {
        throw new BadRequestException('User not found');
      }
      const friendList = loanee.Friend_list || [];
      
      const isFriend = friendList.some(friend => 
        friend && friend._id && friend._id.toString() === loanerIdObj.toString()
      );
      
      if (!isFriend) {
        throw new BadRequestException('Loaner is not in your friend list');
      }

      // Create the ticket with the correct field names from the schema
      const newTicket = new this.ticketModel({
        amount: createTicketDto.amount,
        loanee: loaneeIdObj,
        loaner: loanerIdObj,
        status: 'PENDING',
        Type: createTicketDto.Type,
        Place: createTicketDto.Place
      });

      const savedTicket = await newTicket.save();
      
      return savedTicket;
    } catch (error) {
      this.logger.error(`Error creating ticket: ${error.message}`);
      throw error instanceof BadRequestException 
        ? error 
        : new BadRequestException(`Failed to create ticket: ${error.message}`);
    }
  }


  async getTicketsByUser(userId: string, type?: string, status?: string): Promise<Tickets[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      const query: any = {
        $or: [
          { loaner: new Types.ObjectId(userId) },
          { loanee: new Types.ObjectId(userId) }
        ]
      };

      if (type && ['CASH', 'CARD'].includes(type)) {
        query.Type = type;
      }

      if (status && ['PENDING', 'PAYED', 'FAILED', 'OVERDUE'].includes(status)) {
        query.status = status;
      }

      const tickets = await this.ticketModel.find(query)
        .sort({ Time: -1 })
        .exec();

      this.logger.log(`Found ${tickets.length} tickets`);
      return tickets;
    } catch (error) {
      this.logger.error(`Error fetching tickets: ${error.message}`);
      throw new BadRequestException(`Failed to fetch tickets: ${error.message}`);
    }
  }


  async getTicketById(ticketId: string): Promise<Tickets> {
    try {
      if (!Types.ObjectId.isValid(ticketId)) {
        throw new BadRequestException('Invalid ticket ID');
      }

      const ticket = await this.ticketModel.findById(new Types.ObjectId(ticketId)).exec();

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      return ticket;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch ticket: ${error.message}`);
    }
  }

}