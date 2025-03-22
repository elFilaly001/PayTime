import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {

    constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

    async set(key: string, value: string): Promise<void> {
        await this.redisClient.set(key, value);
    }

    async get(key: string): Promise<string | null> {
        return await this.redisClient.get(key);
    }

    async storeOtp(userId: string, otp: string): Promise<void> {
        const key = `otp:${userId}`;
        await this.redisClient.set(key, otp, 'EX', 300); // 5 minutes expiry
        console.log(`OTP stored for user ${userId}: ${otp}`);
      }
    
      // Retrieve OTP from Redis
      async getOtp(userId: string): Promise<string | null> {
        const key = `otp:${userId}`;
        const otp = await this.redisClient.get(key);
        console.log(`Retrieved OTP for user ${userId}: ${otp}`);
        return otp;
      }
    
      // Verify OTP
      async verifyOtp(userId: string, otp: string): Promise<boolean> {
        const storedOtp = await this.getOtp(userId);
        if (storedOtp === otp) {
          // Delete OTP after successful verification
          await this.redisClient.del(`otp:${userId}`);
          return true;
        }
        return false;
      }
}
    