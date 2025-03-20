import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';

import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { Transaction, TransactionSchema } from './schema/transaction.schema';
import { Tickets, TicketsSchema } from '../tickets/schema/ticket.schema';
import { StripeModule } from '../stripe/stripe.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentModule } from '../payment/payment.module';
import { PaymentsSchema } from '../payment/schema/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Tickets.name, schema: TicketsSchema },
      // { name: 'Payments', schema: PaymentsSchema },
    ]),
    BullModule.registerQueue({
      name: 'transactions',
    }),
    StripeModule,
    AuthModule,
    ConfigModule,
    forwardRef(() => PaymentModule), // Use forwardRef here
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService, MongooseModule], // Export MongooseModule to share models
})
export class TransactionModule { }
