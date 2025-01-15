import { SchemaFactory } from "@nestjs/mongoose";
import { Schema } from "@nestjs/mongoose";
import { Prop } from "@nestjs/mongoose";
import { HydratedDocument , Schema as MongooseSchema } from "mongoose";


export type PaymentsDocument = HydratedDocument<Payments>;

@Schema()
export class Payments {
    @Prop({ required: true })
    userId: string;
  
    @Prop({ required: true })
    stripeCustomerId: string;
  
    @Prop({ required: true })
    stripePaymentMethodId: string;
  
    // Store only last 4 digits for display purposes
    @Prop({ required: true })
    last4: string;
  
    @Prop({ required: true })
    cardBrand: string;  // visa, mastercard, etc.
  
    @Prop({ required: true })
    expiryMonth: number;
  
    @Prop({ required: true })
    expiryYear: number;
  
    @Prop({ default: false })
    isDefault: boolean;
  
    @Prop({ default: true })
    isActive: boolean;
  }
export const PaymentsSchema = SchemaFactory.createForClass(Payments);