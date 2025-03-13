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
  Req
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  ProcessAutomaticPaymentDto,
  ProcessManualPaymentDto
} from './dto/create-ticket.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

// Define the same interface here or consider moving it to a shared types file
interface RequestWithUser extends Request {
  user: {
    username: string;
    [key: string]: any;
  }
}


@Controller('tickets')
@UseGuards(AuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) { }

  @Post()
  async createTicket(@Req() req: RequestWithUser, @Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.createTicket(req.user.id, createTicketDto);
  }

  @Get()
  async getTickets(
    @Query('user') userId: string,
    @Query('type') type: string,
    @Query('status') status: string
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.ticketsService.getTicketsByUser(userId, type, status);
  }

  @Get(':id')
  async getTicketById(@Param('id') id: string) {
    return this.ticketsService.getTicketById(id);
  }


}
