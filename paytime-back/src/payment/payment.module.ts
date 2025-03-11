import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Payments, PaymentsSchema } from './schema/payment.schema';
import { Transaction, TransactionSchema } from '../transaction/schema/transaction.schema';
import { StripeModule } from '../stripe/stripe.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payments.name, schema: PaymentsSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    StripeModule.forRootAsync(),
    AuthModule
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
