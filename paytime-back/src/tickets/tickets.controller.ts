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
  Logger
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
    this.logger.debug(`Creating ticket - user: ${req.user}, dto: ${JSON.stringify(createTicketDto)}`);

    if (!req.user) {
      throw new BadRequestException('Authentication failed: User not found in request');
    }
    

    return this.ticketsService.createTicket(req.user.id, createTicketDto);
  }

  @Get()
  async getTickets(
    @Req() req: RequestWithUser,
  ) {
    if (!req.user.id) {
      throw new BadRequestException('User ID is required');
    }
    return this.ticketsService.getTicketsByUser(req.user.id,);
  }

  @Get(':id')
  async getTicketById(@Param('id') id: string) {
    return this.ticketsService.getTicketById(id);
  }


}
