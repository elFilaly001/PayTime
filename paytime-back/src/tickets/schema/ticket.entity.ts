
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TicketDocument = HydratedDocument<Ticket>;


@Schema()
export class Ticket {
    @Prop({ required: true })
    loaner: Types.ObjectId;
}
