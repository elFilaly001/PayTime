import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dtos/Auth.dto';
import { Exist } from '../Helpers/Exist.helper';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { MailHelper } from '../Helpers/Mail.helper';
import { ConfigService } from '@nestjs/config';
import { HashPassword, VerifyPassword } from '../Helpers/Auth.helper';
import { getCookie, setCookie } from '../Helpers/Cookies.helper';
import { Response, Request, request } from 'express';
import { Logger } from '@nestjs/common';
import { OTPHelper } from '../Helpers/OTP.helper';
import { RedisService } from '../redis/redis.service';
import { getDeviceInfo, isDeviceRecognized } from '../Helpers/Device.helper';
import { StripeService } from 'src/stripe/stripe.service';
import { Redis } from 'ioredis';
import Stripe from 'stripe';


@Injectable()
export class AuthService {

    private readonly logger = new Logger(AuthService.name);
    constructor(
        @InjectModel('Auth') private readonly AuthModel: any,
        private jwtHelper: JWTHelperService,
        private configService: ConfigService,
        private mailHelper: MailHelper,
        private otpHelper: OTPHelper,
        private redisService: RedisService,
        private stripeService: StripeService
    ) {}

    async Register(Data: RegisterDto) {
        // Check username and email 
        await Exist(this.AuthModel, { Username: Data.Username }, false);
        await Exist(this.AuthModel, { Email: Data.Email }, false);

        //create a trasaction session 
        const transactionSession = await this.AuthModel.startSession()
        transactionSession.startTransaction()

        try {

            //create a stripe costumer
            const stripeCostumer = await this.stripeService.createCustomer(Data.Email , Data.Username);

            const newData = {...Data , StripeCostumer: stripeCostumer.id}

            this.logger.debug(newData)

            const user = await this.AuthModel.create(newData);

            this.logger.debug(user)

            await transactionSession.commitTransaction();
            transactionSession.endSession();
            return {
                User: {
                    Username: user.Username,
                    Email: user.Email,
                    Custumer : stripeCostumer.id,
                    Role: user.Role,
                    isVerified: user.isVerified,
                    Friend_Code: user.Friend_Code,
                    Friend_list: user.Friend_list,
                    Friend_requests: user.Friend_requests
                },
                message: "User created successfully"
            };
        } catch (error) {
            await transactionSession.abortTransaction()
            transactionSession.endSession();
            throw error;
        }
    }

    async Login(Data: LoginDto, res: Response, request: Request) {
        // Verify user exists in database
        const user = await Exist(this.AuthModel, { Email: Data.Email }, true);

        try {
            // Check if user is banned
            if (user.isBanned) {
                throw new UnauthorizedException('This account has been banned. Please contact support for more information.');
            }
            
            // Check if user is deleted
            if (user.isDeleted) {
                throw new UnauthorizedException('This account has been deleted.');
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
                        id: user._id,
                        Username: user.Username,
                        Email: user.Email,
                        Role: user.Role,
                        isVerified: user.isVerified,
                        Friend_Code: user.Friend_Code,
                        Friend_list: user.Friend_list,
                        Friend_requests: user.Friend_requests,
                        StripeCostumer: user.StripeCostumer
                    },
                    Access: AccessToken,
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
            if (!RefreshToken) {
                throw new NotFoundException('Refresh token not found');
            }
            const user = await this.jwtHelper.verifyToken(RefreshToken[1]);
            if (!user) {
                throw new UnauthorizedException('Invalid or expired refresh token');
            }
            const AccessToken = await this.jwtHelper.createAccessToken(user);
            return { Access: AccessToken };
        } catch (error) {
            throw error;
        }
    }

    async verifyOtp(verifyOtpDto: VerifyOtpDto, res: Response, request: Request) {
        const session = await this.AuthModel.startSession();
        session.startTransaction();

        try {
            const { userId, otp } = verifyOtpDto;
            
            // Verify user exists
            const user = await this.AuthModel.findById(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Verify OTP
            const isValid = await this.redisService.verifyOtp(userId, otp);
            if (!isValid) {
                throw new UnauthorizedException('Invalid OTP');
            }

            // Add the device to user's devices list
            const deviceInfo = getDeviceInfo(request);
            const updates: any = {
                $push: {
                    Devices: {
                        ...deviceInfo,
                        lastUsedAt: new Date()
                    }
                },
                lastLogin: new Date()
            };

            // Only update isVerified if user isn't already verified
            if (!user.isVerified) {
                updates.isVerified = true;
            }

            const updatedUser = await this.AuthModel.findByIdAndUpdate(
                userId,
                updates,
                { session, new: true }
            );

            // Generate tokens
            const RefreshToken = await this.jwtHelper.createRefreshToken(userId);
            const AccessToken = await this.jwtHelper.createAccessToken(userId);

            // Set refresh token in HTTP-only cookie
            setCookie(res, "refreshToken", RefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 10 * 24 * 60 * 60 * 1000
            });

            await session.commitTransaction();
            session.endSession();

            return {
                User: {
                    id: userId,
                    Username: updatedUser.Username,
                    Email: updatedUser.Email,
                    Role: updatedUser.Role,
                    isVerified: updatedUser.isVerified,
                    Friend_Code: updatedUser.Friend_Code,
                    Friend_list: updatedUser.Friend_list,
                    Friend_requests: updatedUser.Friend_requests
                },
                Access: AccessToken,
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }


    async sendResetPasswordEmail(email: string) {
        try {
            const user = await this.AuthModel.findOne({ Email: email });
            if (!user) {
                throw new NotFoundException('User not found');
            }
            const resetPasswordToken = await this.jwtHelper.createResetPasswordToken(user.id);
            await this.mailHelper.sendResetPasswordEmail(email, resetPasswordToken);
            return { message: 'Reset password email sent', token: resetPasswordToken };
        } catch (error) {
            throw error;
        }
    }


    async resetPassword(token: string, password: string) {
        try {
            const user = await this.jwtHelper.verifyToken(token);
            const hashedPassword = HashPassword(password);
            const updatedUser = await this.AuthModel.findByIdAndUpdate(user, { Password: hashedPassword });
            if (!updatedUser) {
                throw new NotFoundException('User not found');
            }
            return { message: 'Password reset successful' };
        } catch (error) {
            throw error;
        }
    }


    async logout(res: Response) {
        res.clearCookie('refreshToken');
        return { message: 'Logged out successfully' };
    }
}

