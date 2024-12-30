import nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class MailHelper {
    private readonly logger = new Logger(MailHelper.name);
    private transporter: nodemailer.Transporter;

    constructor(private configService: ConfigService,) {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }

    async sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
        try {
            const verificationLink = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;

            await this.transporter.sendMail({
                from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
                to: email,
                subject: "Verify Your Email Address",
                html: `
                    <h1>Email Verification</h1>
                    <p>Please click the link below to verify your email address:</p>
                    <a href="${verificationLink}">Verify Email</a>
                    <p>If you didn't create an account, you can ignore this email.</p>
                    <p>This link will expire in 24 hours.</p>
                `,
            });

            this.logger.log(`Verification email sent to ${email}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send verification email to ${email}: ${error.message}`);
            return false;
        }
    }
}
