import * as nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailHelper {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(MailHelper.name);

    constructor(private configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: this.configService.get<string>('SMTP_USER'),
                pass: this.configService.get<string>('SMTP_PASSWORD')
            }
        });

        this.transporter.verify((error, success) => {
            if (error) {
                this.logger.error('SMTP connection error:', error);
            } else {
                this.logger.log('SMTP server is ready to take our messages');
            }
        });
    }

    async sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
        try {
            const verificationLink = `${this.configService.get<string>('APP_URL')}/verify-email?token=${verificationToken}`;
            
            const fromName = this.configService.get<string>('MAIL_FROM_NAME');
            const fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS');

            const mailOptions = {
                from: `${fromName} <${this.configService.get<string>('SMTP_USER')}>`,
                to: email,
                subject: "Verify Your Email Address",
                html: `
                    <h1>Email Verification</h1>
                    <p>Please click the link below to verify your email address:</p>
                    <a href="${verificationLink}">Verify Email</a>
                    <p>If you didn't create an account, you can ignore this email.</p>
                    <p>This link will expire in 24 hours.</p>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);

            this.logger.log(`Verification email sent to ${email}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send verification email to ${email}: ${error.message}`);
            return false;
        }
    }
    
    async sendOTPEmail(email: string, otp: string): Promise<boolean> {
        try {
            const subject = 'Your OTP Code';
            const text = `Your OTP code is: ${otp}`;
            const fromName = this.configService.get<string>('MAIL_FROM_NAME');
            const fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS');

            const mailOptions = {
                from: `${fromName} <${this.configService.get<string>('SMTP_USER')}>`,
                to: email,
                subject: "Verify Your Email Address",
                html: `
                    <h1>OTP Verification</h1>
                    <p>Your OTP code is: <strong>${otp}</strong></p>
                    <p>Please enter this code in the application to verify your email address.</p>
                    <p>If you didn't request this code, you can ignore this email.</p>
                    <p>This OTP will expire in 5 minutes.</p>
                `
            };

            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send OTP email to ${email}: ${error.message}`);
            return false;
        }

    } 
}