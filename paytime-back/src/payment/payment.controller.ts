import { Controller, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ProcessLoanRepaymentDto, RecordCashPaymentDto } from './dto/create-payment.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('card')
  async addCreditCard(
    @Body() body: { userId: string; customerId: string; paymentMethodId: string }
  ) {
    return this.paymentService.addCreditCard(
      body.userId,
      body.customerId,
      body.paymentMethodId
    );
  }

  @Delete('card/:userId/:paymentId')
  async deleteCreditCard(
    @Param('userId') userId: string,
    @Param('paymentId') paymentId: string
  ) {
    return this.paymentService.deleteCreditCard(userId, paymentId);
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
