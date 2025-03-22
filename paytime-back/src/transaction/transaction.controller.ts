import { Controller, Post, Body, UseGuards, Request, Get, Param, BadRequestException } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('pay-cash/:ticketId')
  @UseGuards(AuthGuard)
  async payCash(@Param('ticketId') ticketId: string, @Request() req) {
    return this.transactionService.payWithCash(ticketId, req.user.id);
  }

  @Post('pay-card/:ticketId')
  @UseGuards(AuthGuard)
  async payCard(@Param('ticketId') ticketId: string, @Request() req) {
    return this.transactionService.payWithCard(ticketId, req.user.id , "MANUAL_CARD");
  }
  
  @Get('ticket/:ticketId')
  @UseGuards(AuthGuard)
  async getTransactionsByTicket(@Param('ticketId') ticketId: string) {
    return this.transactionService.getTransactionsByTicketId(ticketId);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getTransaction(@Param('id') id: string) {
    return this.transactionService.getTransactionById(id);
  }

  @Get()
  @UseGuards(AuthGuard)
  async getTransactions(@Request() req) {
    return this.transactionService.getDetailedTransactionsByUser(req.user.id);
  }
}
