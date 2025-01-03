import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RegisterDto, LoginDto } from './dtos/Auth.dto';
import { Exist } from 'src/Helpers/Exist.helper';
import { JWTHelperService } from 'src/Helpers/JWT.helpers';
import  {MailHelper}  from 'src/Helpers/Mail.helper';
import { ConfigService } from '@nestjs/config';
import {VerifyPassword} from 'src/Helpers/Auth.helper';
import { getCookie, setCookie } from 'src/Helpers/Cookies.helper';
import { Response, Request } from 'express';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {

    private readonly logger = new Logger(AuthService.name);
    constructor(
        @InjectModel('Auth') private readonly AuthModel: any,
        private jwtHelper: JWTHelperService,
        private configService: ConfigService


    ) {}
    
    async Register(Data: RegisterDto) {

        await Exist(this.AuthModel, { Username: Data.Username , Email: Data.Email }, false);
        
        try {
            
            // Create user within the transaction
            const user = await this.AuthModel.create(Data );
            
            // Generate verification token
            const verification_token = await this.jwtHelper.createEmailVerificationToken(user.id);
            
            // Send verification email
            const mailHelper = new MailHelper(this.configService);
            
            const emailSent = await mailHelper.sendVerificationEmail(user.Email, verification_token);
            
            if (!emailSent) {
                // If email sending fails, rollback the transaction
                throw new Error('Failed to send verification email');
            }
            
            return {User: {
                Username: user.Username,
                Email: user.Email,
                Role: user.Role,
                isVerified: user.isVerified,
                Friend_Code: user.Friend_Code,
                Friend_list: user.Friend_list,
                Friend_requests: user.Friend_requests
            }};
            
        } catch (error) {
            throw error;
        }
    }

    async Login(Data: LoginDto, res: Response) {
       
        
        try {

            // Verify user exists in database (pass session to ensure transaction consistency)
            const user = await Exist(this.AuthModel, { Email: Data.Email }, true);
            // Check password validity
            if (!VerifyPassword(Data.Password, user.Password)) throw new BadRequestException('Invalid Password');
            
            // Generate tokens
            const RefreshToken = await this.jwtHelper.createRefreshToken(user.id);
            const AccessToken = await this.jwtHelper.createAccessToken(user.id);

            // Set refresh token in HTTP-only cookie
            setCookie(res, "refreshToken", RefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 10 * 24 * 60 * 60 * 1000 // 10 days
            });


            // Return user data and access token
            return { User: {
                Username: user.Username,
                Email: user.Email,
                Role: user.Role,
                isVerified: user.isVerified,
                Friend_Code: user.Friend_Code,
                Friend_list: user.Friend_list,
                Friend_requests: user.Friend_requests
            }, Access: AccessToken };

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

    

}
