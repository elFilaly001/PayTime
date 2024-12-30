import { Module, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthSchema } from './Schema/Auth.schema';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { KeyManagerService } from '../Helpers/KeyManager.helper';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Auth', schema: AuthSchema }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JWTHelperService,
    KeyManagerService,
    Logger
  ],
  exports: [AuthService],
})
export class AuthModule {}
