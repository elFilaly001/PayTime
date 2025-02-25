import { Controller, Post, Delete, Body, Param, UseGuards, Get, Put } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ProcessLoanRepaymentDto, RecordCashPaymentDto , CreatePaymentIdDto } from './dto/create-payment.dto';
import { get } from 'http';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('addCard')
  async addCard(
    @Body() card: CreatePaymentIdDto
  ) {
    return this.paymentService.addCard(card);
  }


  @Get('cards/:costumerId')
  async GetUserCards(@Param('costumerId') costumerId: string) {
    return this.paymentService.GetUserCards(costumerId);
  }


  @Put('default/:customerId/:paymentId')
  async setDefaultCard(
    @Param('customerId') customerId: string,
    @Param('paymentId') Id: string
  ) {
    return this.paymentService.setDefaultCard(customerId, Id);
  }

  @Delete(':Id')
  async deleteCreditCard(
    @Param('Id') Id: string,
  ) {
    return this.paymentService.deleteCreditCard(Id);
  }

  @Post('loan-repayment')
  async processLoanRepayment(@Body() processLoanRepaymentDto: ProcessLoanRepaymentDto) {
    return this.paymentService.processLoanRepayment(
      processLoanRepaymentDto.amount,
      processLoanRepaymentDto.senderId,
      processLoanRepaymentDto.receiverId,
      processLoanRepaymentDto.loanId,
      processLoanRepaymentDto.paymentMethodId,
      processLoanRepaymentDto.customerId,
    );
  }

  @Post('cash-payment')
  async recordCashPayment(@Body() recordCashPaymentDto: RecordCashPaymentDto) {
    return this.paymentService.recordCashPayment(
      recordCashPaymentDto.amount,
      recordCashPaymentDto.senderId,
      recordCashPaymentDto.receiverId,
      recordCashPaymentDto.loanId,
      recordCashPaymentDto.meetingLocation,
      recordCashPaymentDto.meetingDate,
    );
  }
}
