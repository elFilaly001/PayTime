import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tickets', required: true })
  ticketId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['MANUAL_CARD', 'AUTO_CARD', 'CASH'] })
  paymentMethod: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment' })
  paymentId: MongooseSchema.Types.ObjectId;
  
  @Prop({ required: true,  default: TransactionStatus.PENDING })
  status: string;
  
  
  @Prop({ required: false })
  description: string;
  
  @Prop({ required: false })
  errorMessage: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
