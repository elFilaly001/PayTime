import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';


export type AuthDocument = HydratedDocument<Auth>;

@Schema()

export class Auth {
    @Prop({ required: true , unique: true})
    Username: string;

    @Prop({required: true, unique: true})
    Email: string;
    
    @Prop({required: true})
    Password: string;

    @Prop({required: true , unique: true})
    Friend_Code: string;

    @Prop()
    Friend_list: Array<string>;

    @Prop()
    Friend_requests: Array<string>;

    @Prop({required: true , default: "User"})
    Role: string;

    @Prop({required: true , default: false})
    isVerified: boolean;
}


export const AuthSchema = SchemaFactory.createForClass(Auth);