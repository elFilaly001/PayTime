import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tickets } from './schema/ticket.schema';
import { StripeService } from '../stripe/stripe.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { Logger } from '@nestjs/common';
import { Auth } from '../auth/Schema/Auth.schema';
import { SchedulerHelper } from '../Helpers/scheduler.helper';
import { TicketsGateway } from './tickets.gateway';
import { TransactionService } from '../transaction/transaction.service';
import { Payments } from '../payment/schema/payment.schema';


@Injectable()
export class TicketsService implements OnModuleInit {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel('Tickets') private ticketModel: Model<Tickets>,
    @InjectModel('Auth') private authModel: Model<Auth>,
    @InjectModel('Payments') private PaymentModel: Model<Payments>,
    @InjectQueue('tickets') private ticketsQueue: Queue,
    @Inject(forwardRef(() => TicketsGateway))
    private ticketsGateway: TicketsGateway,
    private TransactionService: TransactionService
  ) { }

  async onModuleInit() {
    this.logger.log('Initializing TicketsService module...');
    
    try {
      this.logger.debug('Cleaning up existing queue jobs');
      await SchedulerHelper.cleanupQueue(this.ticketsQueue);
      
      this.logger.debug('Setting up periodic check for overdue tickets');
      await this.ticketsQueue.add('check-overdue-tickets', {}, {
        repeat: { 
          every: 60 * 60 * 1000, // 1 hour
        },
        removeOnComplete: true,
        removeOnFail: false,
        backoff: {
          type: 'exponential',
          delay: 60000
        }
      });
      
      this.logger.log('Successfully initialized Bull queue for ticket processing');
      
      // Reschedule all pending tickets
      this.logger.debug('Starting to reschedule all pending tickets');
      await this.rescheduleAllPendingTickets();
      this.logger.log('Module initialization completed successfully');
    } catch (error) {
      this.logger.error(`Error during module initialization: ${error.message}`, error.stack);
    }
  }

  async rescheduleAllPendingTickets() {
    try {
      this.logger.debug('Fetching all pending tickets from database');
      const pendingTickets = await this.ticketModel.find({ status: 'PENDING' });
      this.logger.log(`Found ${pendingTickets.length} pending tickets to reschedule`);
      
      let scheduledCount = 0;
      let errorCount = 0;
      
      for (const ticket of pendingTickets) {
        if (ticket.dueDate) {
          try {
            this.logger.debug(`Scheduling ticket ${ticket._id} due on ${ticket.dueDate}`);
            // Use SchedulerHelper to schedule ticket processing
            await SchedulerHelper.scheduleJob(
              this.ticketsQueue, 
              'process-ticket', 
              { ticketId: ticket._id.toString() },
              new Date(ticket.dueDate) // Ensure it's a Date object
            );
            scheduledCount++;
          } catch (err) {
            errorCount++;
            this.logger.error(`Failed to schedule ticket ${ticket._id}: ${err.message}`);
          }
        } else {
          this.logger.warn(`Ticket ${ticket._id} has no due date, skipping scheduling`);
        }
      }
      
      this.logger.log(`Rescheduling summary: ${scheduledCount} tickets scheduled successfully, ${errorCount} errors`);
    } catch (error) {
      this.logger.error(`Error rescheduling tickets: ${error.message}`, error.stack);
    }
  }

  async createTicket(userId: any, createTicketDto: CreateTicketDto): Promise<Tickets> {
    this.logger.debug(`Creating ticket - userId: ${userId}, amount: ${createTicketDto.amount}, type: ${createTicketDto.Type}`);
    
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
      const loaner = await this.authModel.findById(loanerIdObj);
      if (!loanee) {
        throw new BadRequestException('User not found');
      }
      const friendList = loanee.Friend_list || [];
      
      const friend = friendList.find(friend => 
        friend && friend._id && friend._id.toString() === loanerIdObj.toString()
      );
      
      if (!friend) {
        throw new BadRequestException('Loaner is not in your friend list');
      }
      
      const loanerName = friend.Username
      
      const dueDate = createTicketDto.dueDate ? new Date(createTicketDto.dueDate) : 
                      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const loaneePaymentMethod = await this.PaymentModel.find({ stripeCustomerId : loanee.StripeCostumer });
      const loanerPaymentMethod = await this.PaymentModel.find({ stripeCustomerId : loaner.StripeCostumer });

      if (createTicketDto.Type === "AUTO_CARD" && (loaneePaymentMethod.length === 0 || loanerPaymentMethod.length === 0)) {
        throw new BadRequestException('No payment method found for loaner or loanee');
      }
      
      const newTicket = new this.ticketModel({
        amount: createTicketDto.amount,
        loanee: loaneeIdObj,
        loaneeName: loanee.Username,
        loaner: loanerIdObj,
        loanerName: loanerName,
        status: 'PENDING',
        Type: createTicketDto.Type,
        Place: createTicketDto.Place,
        dueDate: dueDate
      });

      const savedTicket = await newTicket.save();
      await SchedulerHelper.scheduleJob(
        this.ticketsQueue,
        'process-ticket',
        { ticketId: savedTicket._id.toString() },
        savedTicket.dueDate
      );
      
      return savedTicket;
    } catch (error) {
      this.logger.error(`Error creating ticket: ${error.message}`, error.stack);
      throw error instanceof BadRequestException 
        ? error 
        : new BadRequestException(`Failed to create ticket: ${error.message}`);
    }
  }

  // Process overdue tickets
  async processOverdueTicket(ticketId: string): Promise<void> {
    
    try {
      const ticket = await this.getTicketById(ticketId);
      this.logger.debug(`Retrieved ticket ${ticketId} - status: ${ticket.status}, dueDate: ${new Date(ticket.dueDate)}`);
      
      if (!ticket) {
        this.logger.error(`Ticket ${ticketId} not found`);
        return;
      }

      if (ticket.status !== 'PENDING') {
        this.logger.log(`Ticket ${ticketId} is not pending (status: ${ticket.status}), skipping processing`);
        return;
      }
      
      const now = new Date();
      const dueDate = new Date(ticket.dueDate);
      
      this.logger.debug(`Comparing dates - Current: ${now.toISOString()}, Due: ${dueDate.toISOString()}`);
      
      const isOverdue = dueDate < now;
      
      if (!isOverdue) {
        this.logger.log(`Ticket ${ticketId} is not yet overdue, dueDate: ${dueDate}, skipping processing`);
        return;
      }
      
      this.logger.log(`Ticket ${ticketId} is overdue. Due date was ${dueDate.toLocaleString()}. Marking as OVERDUE status`);

      if (ticket.Type === "AUTO_CARD") {
        try {
          const newTransaction = await this.TransactionService.payWithCard(
            ticketId, 
            ticket.loanee.toString(),
            "AUTO_CARD"
          );
      
          if (newTransaction) {
            // Update ticket to PAID status
            const updateData = { 
              status: 'PAID', // Consistent naming
              updatedAt: new Date(),
              paidAt: new Date(),
              paymentId: newTransaction.paymentId
            };
        
            const updatedTicket = await this.ticketModel.findByIdAndUpdate(
              ticketId, 
              updateData, 
              { new: true }
            ).exec();
            
            if (!updatedTicket) {
              this.logger.error(`Failed to update ticket ${ticketId}`);
              return;
            }
            
            this.ticketsGateway.broadcastTicketStatusUpdate(updatedTicket);
            return;
          }
        } catch (error) {
          this.logger.error(`Failed to process AUTO_CARD payment: ${error.message}`);
          // Continue to mark as OVERDUE if payment fails
        }
      }
      
      // If AUTO_CARD processing fails or not AUTO_CARD, mark as OVERDUE
      const updateData = { 
        status: 'OVERDUE',
        updatedAt: new Date()
      };

      const updatedTicket = await this.ticketModel.findByIdAndUpdate(
        ticketId, 
        updateData, 
        { new: true }
      ).exec();
      
      if (!updatedTicket) {
        this.logger.error(`Failed to update ticket ${ticketId}`);
        return;
      }
      this.logger.log(`Successfully marked ticket ${ticketId} as overdue`);
      this.ticketsGateway.broadcastTicketStatusUpdate(updatedTicket);
      
      // Send notification to all parties via WebSocket
      this.logger.log(`Broadcasting overdue status for ticket ${ticketId} to involved parties`);
      
      
    } catch (error) {
      this.logger.error(`Error processing overdue ticket ${ticketId}: ${error.message}`, error.stack);
    }
  }

  // Add this method to manually check for overdue tickets
  async checkForOverdueTickets() {
    this.logger.log('Performing manual check for overdue tickets');
    
    try {
      const now = new Date();
      
      // Find pending tickets that are past their due date
      const overdueTickets = await this.ticketModel.find({
        status: 'PENDING',
        dueDate: { $lt: now }
      }).exec();
      
      this.logger.log(`Found ${overdueTickets.length} overdue tickets to process`);
      
      for (const ticket of overdueTickets) {
        await this.processOverdueTicket(ticket._id.toString());
      }
      
      return { processed: overdueTickets.length };
    } catch (error) {
      this.logger.error(`Error checking for overdue tickets: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to check for overdue tickets: ${error.message}`);
    }
  }

  async getTicketsByUser(userId: string): Promise<Tickets[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      const query = {
        $or: [
          { loaner: new Types.ObjectId(userId) },
          { loanee: new Types.ObjectId(userId) }
        ]
      };
      
      // Use createdAt or appropriate timestamp field for sorting
      const tickets = await this.ticketModel.find(query)
        .sort({ createdAt: -1 })
        .exec();
      
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