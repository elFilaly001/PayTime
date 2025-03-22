import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Get,
  Put,
  Query,
  BadRequestException,
  Req,
  Logger,
  Patch
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  ProcessAutomaticPaymentDto,
  ProcessManualPaymentDto
} from './dto/create-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { Types } from 'mongoose';

interface RequestWithUser extends Request {
  user: {
    username: string;
    [key: string]: any;
  }
}

@Controller('tickets')
@UseGuards(AuthGuard)
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsService) { }

  @Post()
  async createTicket(@Req() req: RequestWithUser, @Body() createTicketDto: CreateTicketDto) {
    this.logger.debug(`Creating ticket - user: ${req.user.username}, userId: ${req.user.id}, amount: ${createTicketDto.amount}, type: ${createTicketDto.Type}`);

    if (!req.user) {
      throw new BadRequestException('Authentication failed: User not found in request');
    }
    
    const result = await this.ticketsService.createTicket(req.user.id, createTicketDto);
    // this.logger.log(`Ticket created successfully - ID: ${result._id}, due date: ${result.dueDate}`);
    return result;
  }

  @Get()
  async getTickets(@Req() req: RequestWithUser) {
    this.logger.debug(`Fetching tickets for user: ${req.user.username}, userId: ${req.user.id}`);
    
    if (!req.user.id) {
      throw new BadRequestException('User ID is required');
    }
    
    const tickets = await this.ticketsService.getTicketsByUser(req.user.id);
    this.logger.log(`Retrieved ${tickets.length} tickets for user ${req.user.id}`);
    return tickets;
  }

  @Get(':id')
  async getTicketById(@Param('id') id: string) {
    this.logger.debug(`Fetching ticket details for ticket ID: ${id}`);
    
    const ticket = await this.ticketsService.getTicketById(id);
    this.logger.log(`Retrieved ticket ${id} - status: ${ticket.status}, amount: ${ticket.amount}`);
    return ticket;
  }

  @Patch('check-overdue')
  @UseGuards(AuthGuard)
  async checkOverdueTickets() {
    this.logger.log('Manual check for overdue tickets triggered');
    return this.ticketsService.checkForOverdueTickets();
  }
}
