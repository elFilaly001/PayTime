// Create in src/tickets/dto/ticket.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional, IsBoolean, IsDate } from 'class-validator';
import { Types } from 'mongoose';

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  loaner: Types.ObjectId;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsEnum(['CASH', 'CARD'])
  Type: string;

  @IsNotEmpty()
  @IsString()
  Place: string;

  @IsOptional()
  @IsDate()
  scheduledTime?: Date;

  @IsOptional()
  @IsBoolean()
  createTransaction?: boolean;
}

export class ProcessAutomaticPaymentDto {
  @IsNotEmpty()
  @IsString()
  ticketId: string;

  @IsNotEmpty()
  @IsString()
  paymentMethodId: string;

  @IsNotEmpty()
  @IsString()
  customerId: string;
}

export class ProcessManualPaymentDto {
  @IsNotEmpty()
  @IsString()
  ticketId: string;

  @IsOptional()
  @IsString()
  meetingLocation?: string;

  @IsOptional()
  @IsDate()
  meetingDate?: Date;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  autoConfirm?: boolean;
}