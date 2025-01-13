import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dtos/Auth.dto';
import { Exist } from '../Helpers/Exist.helper';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { MailHelper } from '../Helpers/Mail.helper';
import { ConfigService } from '@nestjs/config';
import { VerifyPassword } from '../Helpers/Auth.helper';
import { getCookie, setCookie } from '../Helpers/Cookies.helper';
import { Response, Request, request } from 'express';
import { Logger } from '@nestjs/common';
import { OTPHelper } from '../Helpers/OTP.helper';
import { RedisService } from '../redis/redis.service';
import { getDeviceInfo, isDeviceRecognized } from '../Helpers/Device.helper';
import { Redis } from 'ioredis';


@Injectable()
export class AuthService {

    private readonly logger = new Logger(AuthService.name);
    constructor(
        @InjectModel('Auth') private readonly AuthModel: any,
        private jwtHelper: JWTHelperService,
        private configService: ConfigService,
        private mailHelper: MailHelper,
        private otpHelper: OTPHelper,
        private redisService: RedisService


    ) {

        // this.mailHelper = new MailHelper(this.configService);

    }

    async Register(Data: RegisterDto, request: Request) {

        await Exist(this.AuthModel, { Username: Data.Username, Email: Data.Email }, false);

        try {

            const user = await this.AuthModel.create(Data);

            return {
                User: {
                    Username: user.Username,
                    Email: user.Email,
                    Role: user.Role,
                    isVerified: user.isVerified,
                    Friend_Code: user.Friend_Code,
                    Friend_list: user.Friend_list,
                    Friend_requests: user.Friend_requests
                }
            };

        } catch (error) {
            throw error;
        }
    }

    async Login(Data: LoginDto, res: Response, request: Request) {
        // Verify user exists in database
        const user = await Exist(this.AuthModel, { Email: Data.Email }, true);

        try {
            // Check if user is banned
            if (user.isBanned) {
                throw new BadRequestException('This account has been banned. Please contact support for more information.');
            }

            // Check if user is deleted
            if (user.isDeleted) {
                throw new BadRequestException('This account has been deleted.');
            }

            // Check password validity
            if (!VerifyPassword(Data.Password, user.Password)) {
                throw new BadRequestException('Invalid Password');
            }

            const deviceInfo = getDeviceInfo(request);
            
            // Always require OTP for unverified users
            if (!user.isVerified) {
                const otp = await this.otpHelper.generateOtp(user.id);
                await this.redisService.set(`otp:${user.id}`, otp);
                await this.mailHelper.sendOTPEmail(user.Email, otp);

                return {
                    requiresOTP: true,
                    userId: user.id,
                    message: 'Please verify your email. OTP has been sent to your email address.'
                };
            }

            // For verified users, check device recognition
            if (user.Devices && user.Devices.length > 0 && isDeviceRecognized(user, deviceInfo)) {
                // Generate tokens only for recognized devices
                const RefreshToken = await this.jwtHelper.createRefreshToken(user.id);
                const AccessToken = await this.jwtHelper.createAccessToken(user.id);

                setCookie(res, "refreshToken", RefreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 10 * 24 * 60 * 60 * 1000 // 10 days
                });

                return {
                    requiresOTP: false,
                    User: {
                        Username: user.Username,
                        Email: user.Email,
                        Role: user.Role,
                        isVerified: user.isVerified,
                        Friend_Code: user.Friend_Code,
                        Friend_list: user.Friend_list,
                        Friend_requests: user.Friend_requests
                    },
                    Access: AccessToken
                };
            }

            // For unrecognized devices, generate and send OTP
            const otp = await this.otpHelper.generateOtp(user.id);
            await this.redisService.set(`otp:${user.id}`, otp);
            await this.mailHelper.sendOTPEmail(user.Email, otp);

            // Return only the necessary information for OTP verification
            return {
                requiresOTP: true,
                userId: user.id,
                message: 'OTP has been sent to your email'
            };

        } catch (error) {
            throw error;
        }
    } 
    
    async RefreshToken(req: Request) {
        try {
            const RefreshToken = getCookie(req);
            const user = await this.jwtHelper.verifyToken(RefreshToken[1]);
            const AccessToken = await this.jwtHelper.createAccessToken(user);
            return { Access: AccessToken };
        } catch (error) {
            throw error;
        }
    }

    async verifyLoginOTP(userId: string, otp: string, deviceInfo: any) {
        const isValid = await this.otpHelper.verifyOtp(userId, otp);
        if (!isValid) {
            throw new BadRequestException('Invalid OTP');
        }

        // Add the device to user's devices list
        await this.AuthModel.findByIdAndUpdate(userId, {
            $push: {
                Devices: {
                    ...deviceInfo,
                    lastUsedAt: new Date()
                }
            }
        });

        // Generate tokens and complete login
        const RefreshToken = await this.jwtHelper.createRefreshToken(userId);
        const AccessToken = await this.jwtHelper.createAccessToken(userId);

        return {
            RefreshToken,
            AccessToken
        };
    }

    async verifyOtp(verifyOtpDto: VerifyOtpDto, res: Response, request: Request) {
        const session = await this.AuthModel.startSession();
        session.startTransaction();

        try {
            const { userId, otp } = verifyOtpDto;
            
            // Verify user exists
            const user = await this.AuthModel.findById(userId);
            if (!user) {
                throw new BadRequestException('User not found');
            }

            // Verify OTP
            const isValid = await this.redisService.verifyOtp(userId, otp);
            if (!isValid) {
                throw new BadRequestException('Invalid OTP');
            }

            // Add the device to user's devices list and update verification status
            const deviceInfo = getDeviceInfo(request);
            const updatedUser = await this.AuthModel.findByIdAndUpdate(
                userId,
                {
                    $push: {
                        Devices: {
                            ...deviceInfo,
                            lastUsedAt: new Date()
                        }
                    },
                    isVerified: true, // Set user as verified
                    lastLogin: new Date()
                },
                { session, new: true } // Return the updated document
            );

            // Generate tokens only after successful OTP verification
            const RefreshToken = await this.jwtHelper.createRefreshToken(userId);
            const AccessToken = await this.jwtHelper.createAccessToken(userId);

            // Set refresh token in HTTP-only cookie
            setCookie(res, "refreshToken", RefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 10 * 24 * 60 * 60 * 1000 // 10 days
            });

            await session.commitTransaction();
            session.endSession();

            return {
                User: {
                    Username: updatedUser.Username,
                    Email: updatedUser.Email,
                    Role: updatedUser.Role,
                    isVerified: updatedUser.isVerified, // This will now be true
                    Friend_Code: updatedUser.Friend_Code,
                    Friend_list: updatedUser.Friend_list,
                    Friend_requests: updatedUser.Friend_requests
                },
                Access: AccessToken
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }

}

