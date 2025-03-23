  export class CreatePaymentIdDto{
   costumerId : string
   paymentMethodId: string
   holderName : string
   brand : string
   last4 : string
   exp_month : string
   exp_year : string
  }
  
  export class ProcessPaymentDto {
    amount: number;
    currency: string;
    paymentMethodId: string;
    customerId: string;
  }

export class ProcessLoanRepaymentDto {
  amount: number;
  senderId: string;
  receiverId: string;
  loanId: string;
  paymentMethodId: string;
  customerId: string;
}

export class RecordCashPaymentDto {
  amount: number;
  senderId: string;
  receiverId: string;
  loanId: string;
  meetingLocation?: string;
  meetingDate?: Date;
}