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
import { StripeModule } from 'src/stripe/stripe.module';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Auth', schema: AuthSchema }]),
    RedisModule,
    StripeModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JWTHelperService,
    KeyManagerService,
    MailHelper,
    OTPHelper,
    Logger,
    AuthGuard
  ],
  exports: [
    AuthService,
    AuthGuard,
    JWTHelperService,
    KeyManagerService
  ],
})
export class AuthModule {}
