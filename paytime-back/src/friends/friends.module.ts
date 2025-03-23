import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FriendsService } from './friends.service';
import { FriendsGateway } from './friends.gateway';
import { FriendsController } from './friends.controller';
import { AuthSchema } from '../auth/Schema/Auth.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Auth', schema: AuthSchema }]),
    AuthModule,
  ],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsGateway],
  exports: [FriendsService, FriendsGateway],
})
export class FriendsModule {}