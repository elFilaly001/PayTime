import { Schema , Prop , SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument , Schema as MongooseSchema } from "mongoose";


export type TransactionDocument = HydratedDocument<Transaction>;


@Schema()
export class Transaction {
    @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  receiverId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ 
    type: String, 
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CASH_PENDING_CONFIRMATION'],
    default: 'PENDING'
  })
  status: string;

  @Prop({ 
    type: String, 
    enum: ['LOAN', 'REPAYMENT', 'REFUND', 'CASH_PAYMENT'],
    required: true 
  })
  type: string;

  @Prop({ 
    type: String, 
    enum: ['STRIPE', 'CASH'],
    required: true
  })
  paymentMethod: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment' })
  paymentId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: {
    loanId?: string;
    description?: string;
    notes?: string;
    meetingLocation?: string;
    meetingDate?: Date;
    confirmationNotes?: string;
  };

  @Prop()
  error?: string;

}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
