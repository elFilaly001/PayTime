import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type AuthDocument = Auth & HydratedDocument<Auth>;

// Create a separate schema for friend requests
@Schema({ _id: false })
export class FriendRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Auth' })
  from: MongooseSchema.Types.ObjectId;

  @Prop()
  Username: string;

  @Prop({ default: 'pending', enum: ['pending', 'accepted', 'rejected'] })
  status: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

const FriendRequestSchema = SchemaFactory.createForClass(FriendRequest);

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

  @Prop({
    type: [{
      userId: { type: Types.ObjectId, ref: 'Auth' },
      Username: { type: String },
      addedAt: { type: Date, default: Date.now }
    }],
    default: []
  })
  Friend_list: {
    userId: Types.ObjectId;
    Username: string;
    addedAt: Date;
  }[];

  @Prop({ type: [FriendRequestSchema], default: [] })
  Friend_requests: FriendRequest[];

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

  @Prop({ default: null })
  OTP?: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const AuthSchema = SchemaFactory.createForClass(Auth);