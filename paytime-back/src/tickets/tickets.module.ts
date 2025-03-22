import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TicketsProcessor } from './tickets.processor';
import { StripeModule } from '../stripe/stripe.module';
import { TicketsGateway } from './tickets.gateway';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AuthSchema } from '../auth/Schema/Auth.schema';
import { Tickets, TicketsSchema } from './schema/ticket.schema';
import { TransactionSchema } from '../transaction/schema/transaction.schema';
import { TransactionModule } from 'src/transaction/transaction.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tickets.name, schema: TicketsSchema },
      { name: 'Auth', schema: AuthSchema },
      { name: "transaction", schema: TransactionSchema },
    ]),
    AuthModule,
    BullModule.registerQueue({
      name: 'tickets',
    }),
    StripeModule,
    forwardRef(() => TransactionModule),
  ],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsGateway, TicketsProcessor],
  exports: [TicketsService, MongooseModule],
})
export class TicketsModule {}
