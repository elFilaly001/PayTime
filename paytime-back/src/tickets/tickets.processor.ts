import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TicketsService } from './tickets.service';

@Processor('tickets')
export class TicketsProcessor {
  private readonly logger = new Logger(TicketsProcessor.name);

  constructor(private readonly ticketsService: TicketsService) {}

  @Process('process-ticket')
  async handleProcessTicket(job: Job<any>) {
    this.logger.log(`Processing ticket job ${job.id} for ticket: ${job.data.ticketId}`);
    
    try {
      await this.ticketsService.processOverdueTicket(job.data.ticketId);
      this.logger.log(`Successfully processed ticket job ${job.id}`);
    } catch (error) {
      this.logger.error(`Error processing ticket job ${job.id}: ${error.message}`, error.stack);
      throw error; // Rethrow to let Bull handle the failure
    }
  }

  @Process('check-overdue-tickets')
  async handleCheckOverdueTickets(job: Job<any>) {
    this.logger.log(`Running scheduled overdue tickets check (job ${job.id})`);
    
    try {
      const result = await this.ticketsService.checkForOverdueTickets();
      this.logger.log(`Completed overdue tickets check: ${result.processed} tickets processed`);
    } catch (error) {
      this.logger.error(`Error during overdue tickets check: ${error.message}`, error.stack);
      throw error;
    }
  }
}