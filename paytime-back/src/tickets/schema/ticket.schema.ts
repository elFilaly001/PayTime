import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as mongoose from 'mongoose';

export type TicketDocument = HydratedDocument<Tickets>;


@Schema()
export class Tickets {
    @Prop({ required: true })
    loaner: Types.ObjectId;

    @Prop({ required: true })
    loanerName: string;

    @Prop({ required: true })
    loanee: Types.ObjectId;

    @Prop({ required: true })
    loaneeName: string;

    @Prop({ required: true })
    amount: number;

    @Prop({ required: true , enum: ["CASH", "MANUAL_CARD" , "AUTO_CARD"]})
    Type: string

    @Prop({ required: true, enum: ['PENDING', 'PAID', 'FAILED' , "OVERDUE"] , default : "PENDING"})
    status: string;

    @Prop({ required: true })
    Place : string

    @Prop({ default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
    dueDate: Date;

    @Prop()
    paymentId: string;

    @Prop()
    paidAt: Date;
}

export const TicketsSchema = SchemaFactory.createForClass(Tickets);