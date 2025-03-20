import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Payments, PaymentsSchema } from './schema/payment.schema';
import { StripeModule } from '../stripe/stripe.module';
import { TransactionModule } from '../transaction/transaction.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Payments', schema: PaymentsSchema }, 
    ]),
    StripeModule.forRootAsync(),
    forwardRef(() => TransactionModule),
    AuthModule
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService, MongooseModule],
})
export class PaymentModule { }
