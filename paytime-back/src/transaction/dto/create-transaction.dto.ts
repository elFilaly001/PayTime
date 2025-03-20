import { IsMongoId, IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';

export enum PaymentMethodEnum {
  MANUAL_CARD = 'MANUAL_CARD',
  AUTOMATIC_CARD = 'AUTO_CARD',
  CASH = 'CASH'
}

export class CreateTransactionDto {
  @IsNotEmpty()
  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @IsNotEmpty()
  @IsMongoId()
  ticketId: string;  // Changed to required since we need the ticket info

  @IsOptional()
  @IsString()
  stripePaymentMethodId?: string;  // For card payments

  @IsOptional()
  @IsString()
  description?: string;
}