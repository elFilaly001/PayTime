import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional, IsBoolean, IsDate, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';

export class CreateTicketDto {
  @IsMongoId()
  loaner: string;

  @IsNumber()
  amount: number;
  
  @IsString()
  Type: string;
  
  @IsString()
  @IsOptional()
  Place : string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;
  
  @IsString()
  @IsOptional()
  userId?: string;
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