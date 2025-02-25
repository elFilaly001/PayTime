import { SchemaFactory } from "@nestjs/mongoose";
import { Schema } from "@nestjs/mongoose";
import { Prop } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";


export type PaymentsDocument = HydratedDocument<Payments>;

@Schema()
export class Payments {
  @Prop({ required: true })
  stripeCustomerId: string;

  @Prop({ required: true })
  stripePaymentMethodId: string;

  @Prop({ required: true })
  holderName: string;

  @Prop({ required: true })
  last4: string;

  @Prop({ required: true })
  cardBrand: string;
  
  @Prop({ required: true })
  expiryMonth: number;
  
  @Prop({ required: true })
  expiryYear: number;
  
  @Prop({ required: true })
  isDefault: boolean;
  
}
export const PaymentsSchema = SchemaFactory.createForClass(Payments);