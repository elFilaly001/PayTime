import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';


export type AuthDocument = HydratedDocument<Auth>;

@Schema()

export class Auth {
  @Prop({ required: true, unique: true })
  Username: string;

  @Prop({ required: true, unique: true })
  Email: string;

  @Prop({ required: true })
  Password: string;

  @Prop({ required: true })
  Region: string;

  @Prop({ required: true, unique: true })
  Friend_Code: string;

  @Prop()
  Friend_list: Array<string>;

  @Prop()
  Friend_requests: Array<string>;

  @Prop({ required: true, default: "User" })
  Role: string;

  @Prop({ required: true, default: false })
  isVerified: boolean;

  @Prop({ required: true, default: false })
  isBanned: boolean;

  @Prop({ required: true, default: false })
  isDeleted: boolean;

  @Prop({ required: true, default: null })
  StripeCostumer: string | null;

  @Prop({ default: null })
  deletedAt: Date | null;

  @Prop({ required: true, default: Date.now })
  lastLogin: Date;

  @Prop({
    type: [
      {
        cpu: { type: String, required: true },
        os: { type: String, required: true },
        browser: { type: String, required: true },
        engine: { type: String, required: true },
        lastUsedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  Devices: Array<{
    cpu: string;
    engine: string;
    os: string;
    browser: string;
    lastUsedAt: Date;
  }>;

}


export const AuthSchema = SchemaFactory.createForClass(Auth);