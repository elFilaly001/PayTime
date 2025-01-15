import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule ,ConfigService } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { AdminsModule } from './admins/admins.module';
import { ModeratorsModule } from './moderators/moderators.module';
import { TickestModule } from './tickest/tickest.module';
import { TransactionModule } from './transaction/transaction.module';
import { PaymentModule } from './payment/payment.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        return {
          uri: configService.get<string>('MONGO_URI'),
        };
      },
      inject: [ConfigService],
    }),
    AuthModule , AuthModule, RedisModule, AdminsModule, ModeratorsModule, TickestModule, TransactionModule, PaymentModule, 
    StripeModule.forRootAsync()
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
