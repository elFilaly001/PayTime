import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AuthSchema } from '../auth/Schema/Auth.schema';
import { TicketsSchema } from './schema/ticket.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: "Tickets", schema: TicketsSchema }]),
    MongooseModule.forFeature([{ name: 'Auth', schema: AuthSchema }]),
    AuthModule
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService]
})
export class TicketsModule { }
