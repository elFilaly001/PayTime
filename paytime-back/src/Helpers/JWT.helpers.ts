import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { KeyManagerService } from './KeyManager.helper';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { KeyPair } from './types/KeyPair.type';

@Injectable()
export class JWTHelperService {
    private readonly logger = new Logger(JWTHelperService.name);
    private currentAccessKey: KeyPair | null = null;
    private currentRefreshKey: KeyPair | null = null;

    constructor(
        private configService: ConfigService,
        private keyManager: KeyManagerService
    ) {}

    private async getAccessKey(): Promise<KeyPair> {
        if (!this.currentAccessKey) {
            this.currentAccessKey = await this.keyManager.getCurrentAccessKey();
        }
        return this.currentAccessKey;
    }

    private async getRefreshKey(): Promise<KeyPair> {
        if (!this.currentRefreshKey) {
            this.logger.debug('Getting new refresh key from key manager');
            this.currentRefreshKey = await this.keyManager.getCurrentRefreshKey();
            this.logger.debug(`Got refresh key with id: ${this.currentRefreshKey.id}`);
        } else {
            this.logger.debug(`Using cached refresh key with id: ${this.currentRefreshKey.id}`);
        }
        return this.currentRefreshKey;
    }

    private async createToken(userId: string, expiresIn: number, keyPair: KeyPair): Promise<string> {
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
        const keyPair = await this.getAccessKey();
        return this.createToken(userId, this.configService.get('JWT_ACCESS_TIME'), keyPair);
    }

    async createRefreshToken(userId: string): Promise<string> {
        const keyPair = await this.getRefreshKey();
        this.logger.debug(`Creating refresh token with key id: ${keyPair.id}`);
        return this.createToken(userId, this.configService.get('JWT_REFRESH_TIME'), keyPair);
    }

    async createResetPasswordToken(userId: string): Promise<string> {
        return this.createToken(userId, this.configService.get('JWT_RESET_PASSWORD_TIME'), await this.getAccessKey());
    }

    async createEmailVerificationToken(userId: string): Promise<string> {
        return this.createToken(userId, this.configService.get('JWT_EMAIL_VERIFICATION_TIME'), await this.getAccessKey());
    }

    async verifyToken(token: string): Promise<any> {
        try {
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded?.header?.kid) {
                this.logger.error('Token does not contain a valid kid');
                throw new UnauthorizedException();
            }

            const keyPair = await this.keyManager.findKeyById(decoded.header.kid);
            if (!keyPair) {
                this.logger.error(`No key found for kid: ${decoded.header.kid}`);
                throw new UnauthorizedException();
            }

            this.logger.log(`Verifying token with key id: ${keyPair.id} and algorithm: ${keyPair.algorithm}`);

            const verifiedToken = jwt.verify(token, keyPair.key, { algorithms: [keyPair.algorithm] });
            this.logger.log('Token verified successfully ' , verifiedToken.sub);
            return verifiedToken.sub;
        } catch (error) {
            this.logger.error('Error verifying token:', error);
            throw new UnauthorizedException('Invalid token');
        }
    }


    async decodeToken(token: string): Promise<any> {
        return jwt.decode(token);
    }
}
