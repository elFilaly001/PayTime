                          import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as mongoose from 'mongoose';

export type TicketDocument = HydratedDocument<Tickets>;


@Schema()
export class Tickets {
    @Prop({ required: true })
    loaner: Types.ObjectId;

    @Prop({ required: true })
    loanee: Types.ObjectId;

    @Prop({ required: true })
    amount: number;

    @Prop({ required: true , enum: ["CASH", "CARD"]})
    Type: string

    @Prop({ required: true , default : Date.now()})
    Time: Date;

    @Prop({ required: true, enum: ['PENDING', 'PAYED', 'FAILED' , "OVERDUE"] , default : "PENDING"})
    status: string;

    @Prop({ required: true })
    Place : string

}

export const TicketsSchema = SchemaFactory.createForClass(Tickets);