import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { KeyManagerService } from './KeyManager.helper';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { KeyPair } from './types/KeyPair.type';

@Injectable()
export class JWTHelperService {
    private readonly logger = new Logger(JWTHelperService.name);
    private currentKeyPair: KeyPair | null = null;

    constructor(
        private configService: ConfigService,
        private keyManager: KeyManagerService
    ) {}

    private async getKey(): Promise<KeyPair> {
        if (!this.currentKeyPair) {
            this.currentKeyPair = await this.keyManager.getCurrentKey();
        }
        return this.currentKeyPair;
    }

    private async createToken(userId: string, expiresIn: string): Promise<string> {
        const keyPair = await this.getKey();
        
        if (!keyPair || !keyPair.key) {
            throw new UnauthorizedException('Invalid key configuration');
        }

        try {
            const payload = { 
                sub: userId,
                iat: Math.floor(Date.now() / 1000),
            };
            
            const options = { 
                expiresIn,
                algorithm: keyPair.algorithm as jwt.Algorithm,
                keyid: keyPair.id
            };
            
            const token = jwt.sign(payload, keyPair.key, options);
            return token;
        } catch (error) {
            this.logger.error('Error creating token:', error);
            throw new UnauthorizedException('Error creating token');
        }
    }

    async createAccessToken(userId: string): Promise<string> {
        return this.createToken(userId, this.configService.get('JWT_ACCESS_TIME'));
    }

    async createRefreshToken(userId: string): Promise<string> {
        return this.createToken(userId, this.configService.get('JWT_REFRESH_TIME'));
    }

    async createResetPasswordToken(userId: string): Promise<string> {
        return this.createToken(userId, this.configService.get('JWT_RESET_PASSWORD_TIME'));
    }

    async createEmailVerificationToken(userId: string): Promise<string> {
        return this.createToken(userId, this.configService.get('JWT_EMAIL_VERIFICATION_TIME'));
    }

    verifyToken(token: string): any {
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded?.header?.kid) throw new UnauthorizedException();

        const keyPair = this.keyManager.findKeyById(decoded.header.kid);
        if (!keyPair) throw new UnauthorizedException();

        return jwt.verify(token, keyPair.key, { algorithms: [keyPair.algorithm] });
    }
}