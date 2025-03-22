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
import { Payments, PaymentsSchema } from '../payment/schema/payment.schema';
import { Auth, AuthSchema } from 'src/auth/Schema/Auth.schema';
import { TicketsModule } from '../tickets/tickets.module';
import { TransactionGateway } from './transaction.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Tickets.name, schema: TicketsSchema },
      { name: "Auth", schema: AuthSchema },
      { name: Payments.name, schema: PaymentsSchema },
    ]),
    BullModule.registerQueue({
      name: 'transactions',
    }),
    StripeModule,
    AuthModule,
    ConfigModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => TicketsModule),
  ],
  controllers: [TransactionController],
  providers: [TransactionService, TransactionGateway],
  exports: [TransactionService, MongooseModule],
})
export class TransactionModule { }
