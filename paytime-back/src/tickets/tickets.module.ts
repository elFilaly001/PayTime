import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TicketsProcessor } from './tickets.processor';
import { StripeModule } from '../stripe/stripe.module';
import { TicketsGateway } from './tickets.gateway';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AuthSchema } from '../auth/Schema/Auth.schema';
import { TicketsSchema } from './schema/ticket.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Tickets', schema: TicketsSchema }]),
    MongooseModule.forFeature([{ name: 'Auth', schema: AuthSchema }]),
    AuthModule,
    BullModule.registerQueue({
      name: 'tickets',
    }),
    StripeModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsGateway, TicketsService, TicketsProcessor],
  exports: [TicketsService],
})
export class TicketsModule {}
