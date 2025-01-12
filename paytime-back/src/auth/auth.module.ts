import { Module, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthSchema } from './Schema/Auth.schema';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { KeyManagerService } from '../Helpers/KeyManager.helper';
import { RedisModule } from 'src/redis/redis.module';
import { MailHelper } from 'src/Helpers/Mail.helper';
import { OTPHelper } from 'src/Helpers/OTP.helper';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Auth', schema: AuthSchema }]),
    RedisModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JWTHelperService,
    KeyManagerService,
    MailHelper,
    OTPHelper,
    Logger
  ],
  exports: [AuthService],
})
export class AuthModule {}
