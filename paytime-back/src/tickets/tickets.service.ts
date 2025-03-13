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
      if (!Types.ObjectId.isValid(createTicketDto.loaner)) {
        throw new BadRequestException('Invalid loaner ID');
      }

      // Convert userId to ObjectId if it's not already one
      let userIdObj;
      try {
        userIdObj = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
      } catch (error) {
        throw new BadRequestException('Invalid user ID format');
      }

      const user = await this.authModel.findById(userId);
      const UserFriends = user.Friend_list;

      if (!UserFriends.some(friend => friend._id.equals(createTicketDto.loaner))) {
        throw new BadRequestException('Loaner and loanee are not friends');
      }

      // Create ticket with consistent ObjectId format for both fields
      const newTicket = new this.ticketModel({
        loaner: new Types.ObjectId(createTicketDto.loaner),
        loanee: userIdObj,
        amount: createTicketDto.amount,
        Type: createTicketDto.Type,
        Time: createTicketDto.scheduledTime || new Date(),
        status: 'PENDING',
        Place: createTicketDto.Place
      });

      this.logger.log(`Creating ticket with loaner: ${newTicket.loaner} and loanee: ${newTicket.loanee}`);
      const createdTicket = await newTicket.save();

      return createdTicket;
    } catch (error) {
      this.logger.error(`Error creating ticket: ${error.message}`);
      throw new BadRequestException(`Failed to create ticket: ${error.message}`);
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

      this.logger.log(`Query: ${JSON.stringify(query)}`);

      // Execute the query
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

  // /**
  //  * Get a ticket by its ID
  //  */
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