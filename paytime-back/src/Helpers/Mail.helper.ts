import * as nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailHelper {
    private readonly logger = new Logger(MailHelper.name);
    private transporter: nodemailer.Transporter;

    constructor(private configService: ConfigService) {
        const host = this.configService.get<string>('SMTP_HOST');
        const port = parseInt(this.configService.get<string>('SMTP_PORT'));
        const user = this.configService.get<string>('SMTP_USER');
        const pass = this.configService.get<string>('SMTP_PASSWORD');

        // Log SMTP configuration (remove in production)
        this.logger.debug(`Initializing SMTP with host: ${host}, port: ${port}`);

        this.transporter = nodemailer.createTransport({
            host: host,
            port: port,
            secure: false,
            auth: {
                user: user,
                pass: pass,
            },
           
            logger: true,
            debug: true 
        });

        this.transporter.verify((error, success) => {
            if (error) {
                this.logger.error(`SMTP connection failed: ${error.message}`);
            } else {
                this.logger.log('SMTP connection successful');
            }
        });
    }

    async sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
        try {
            const verificationLink = `${this.configService.get<string>('APP_URL')}/verify-email?token=${verificationToken}`;

            await this.transporter.sendMail({
                from: `"${this.configService.get<string>('MAIL_FROM_NAME')}" <${this.configService.get<string>('MAIL_FROM_ADDRESS')}>`,
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
