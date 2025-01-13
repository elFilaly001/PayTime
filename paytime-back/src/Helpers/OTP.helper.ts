import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OTPHelper {

    constructor(private readonly redisService: RedisService) {}

    async generateOtp(userId: string) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP
        await this.redisService.storeOtp(userId, otp);
        return otp ;
    }

    async verifyOtp(userId: string, otp: string) {
        const storedOtp = await this.redisService.getOtp(userId);
        return storedOtp === otp;
    }
}