import { Logger } from '@nestjs/common';
import { Queue } from 'bull';

export class SchedulerHelper {
  private static readonly logger = new Logger(SchedulerHelper.name);
  static async scheduleJob<T>(
    queue: Queue, 
    jobName: string, 
    payload: T, 
    dueDate?: Date, 
    options?: any
  ): Promise<void> {
    const now = new Date();
    const executionDate = dueDate || now;
    const delay = Math.max(0, executionDate.getTime() - now.getTime());
    
    this.logger.debug(`Preparing to schedule job "${jobName}" with payload: ${JSON.stringify(payload)}`);
    
    const jobOptions = {
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000 // 1 minute
      },
      removeOnComplete: true,
      removeOnFail: false,
      ...options
    };

    const job = await queue.add(jobName, payload, jobOptions);
    
    this.logger.log(`Successfully scheduled job "${jobName}" (ID: ${job.id}) for execution at ${executionDate.toISOString()}, delay: ${delay}ms`);
  }

  static isOverdue<T>(item: T, datePropertyName: keyof T, statusPropertyName?: keyof T, pendingStatus?: any): boolean {
    const now = new Date();
    const dueDate = item[datePropertyName];
    
    if (!(dueDate instanceof Date)) {
      this.logger.debug(`Item property ${String(datePropertyName)} is not a Date: ${dueDate}`);
      return false;
    }
    
    const isOverdue = statusPropertyName && pendingStatus 
      ? item[statusPropertyName] === pendingStatus && dueDate < now
      : dueDate < now;
    
    this.logger.debug(`Checking if item is overdue: ${isOverdue} (dueDate: ${dueDate.toISOString()})`);
    return isOverdue;
  }

  static async cleanupQueue(queue: Queue): Promise<void> {
    this.logger.debug(`Starting cleanup of queue: ${queue.name}`);
    
    // Get queue statistics before cleanup
    const jobCounts = await queue.getJobCounts();
    this.logger.log(`Queue state before cleanup - waiting: ${jobCounts.waiting}, active: ${jobCounts.active}, delayed: ${jobCounts.delayed}, failed: ${jobCounts.failed}`);
    
    // Clear all existing jobs to start fresh
    await queue.clean(0, 'delayed');
    await queue.clean(0, 'wait');
    await queue.clean(0, 'active');
    await queue.clean(0, 'completed');
    await queue.clean(0, 'failed');
    
    // Remove existing repeat jobs
    const repeatableJobs = await queue.getRepeatableJobs();
    this.logger.debug(`Found ${repeatableJobs.length} repeatable jobs to remove`);
    
    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key);
      this.logger.debug(`Removed repeatable job with key: ${job.key}`);
    }

    const afterCounts = await queue.getJobCounts();
    this.logger.log(`Queue "${queue.name}" cleaned up successfully. Remaining jobs - waiting: ${afterCounts.waiting}, active: ${afterCounts.active}, delayed: ${afterCounts.delayed}, failed: ${afterCounts.failed}`);
  }
}