import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { Algorithm } from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

interface KeyPair {
    id: string;
    key: string;
    algorithm: Algorithm;
    active: boolean;
    createdAt: Date;
    expiresAt: Date;
    type: 'access' | 'refresh';
}

interface KeyStore {
    keys: KeyPair[];
    lastRotation: string;
}

@Injectable()
export class KeyManagerService implements OnModuleInit {
    private logger = new Logger(KeyManagerService.name);
    private readonly KEY_EXPIRATION_DAYS = {
        access: 7,
        refresh: 30
    };
    private readonly KEY_FILE_PATH: string;

    private keyStore: KeyStore = {
        keys: [],
        lastRotation: new Date().toISOString()
    };

    private initialized = false;

    private readonly SUPPORTED_ALGORITHMS: Algorithm[] = [
        'HS256', 'HS384', 'HS512'
    ];

    constructor(private configService: ConfigService) {
        const keysDir = process.env.KEYS_DIR || process.cwd();
        this.KEY_FILE_PATH = path.resolve(keysDir, 'keys.json');
    }

    async onModuleInit() {
        await this.initialize();
    }

    private async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            await this.ensureKeyFileExists();
            await this.loadKeysFromFile();

            const accessKeys = this.getActiveKeys('access');
            const refreshKeys = this.getActiveKeys('refresh');

            if (accessKeys.length === 0) {
                await this.addNewKey('access');
            }

            if (refreshKeys.length === 0) {
                await this.addNewKey('refresh');
            }

            await this.rotateKeys();

            this.initialized = true;
        } catch (error) {
            this.logger.error(`Error initializing key manager: ${error.message}`);
            throw error;
        }
    }

    async getCurrentAccessKey(): Promise<KeyPair> {
        if (!this.initialized) await this.initialize();

        const activeKeys = this.getActiveKeys('access');

        if (activeKeys.length === 0) {
            return await this.addNewKey('access');
        }

        return activeKeys.sort((a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime()
        )[0];
    }

    async getCurrentRefreshKey(): Promise<KeyPair> {
        if (!this.initialized) {
            this.logger.debug('Initializing key manager before getting refresh key');
            await this.initialize();
        }

        const activeKeys = this.getActiveKeys('refresh');
        this.logger.debug(`Found ${activeKeys.length} active refresh keys`);

        if (activeKeys.length === 0) {
            this.logger.debug('No active refresh keys found, generating new one');
            return await this.addNewKey('refresh');
        }

        const currentKey = activeKeys.sort((a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime()
        )[0];

        this.logger.debug(`Using refresh key with id: ${currentKey.id}`);
        return currentKey;
    }

    async findKeyById(kid: string): Promise<KeyPair | undefined> {
        if (!this.initialized) await this.initialize();

        const key = this.keyStore.keys.find(k => k.id === kid);

        if (!key) {
            return undefined;
        }

        return key;
    }

    private generateNewKey(type: 'access' | 'refresh'): KeyPair {
        const id = crypto.randomBytes(8).toString('hex');
        const key = crypto.randomBytes(32).toString('hex');
        const now = new Date();
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + this.KEY_EXPIRATION_DAYS[type]);

        // Randomly select an algorithm from the supported list
        const algorithm = this.SUPPORTED_ALGORITHMS[
            Math.floor(Math.random() * this.SUPPORTED_ALGORITHMS.length)
        ];

        return {
            id,
            key,
            algorithm,
            active: true,
            createdAt: now,
            expiresAt: expiry,
            type
        };
    }

    private async ensureKeyFileExists(): Promise<void> {
        try {
            const dir = path.dirname(this.KEY_FILE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            if (!fs.existsSync(this.KEY_FILE_PATH)) {
                const initialKeyStore: KeyStore = {
                    keys: [],
                    lastRotation: new Date().toISOString()
                };

                fs.writeFileSync(
                    this.KEY_FILE_PATH,
                    JSON.stringify(initialKeyStore, null, 4),
                    { encoding: 'utf8', mode: 0o600 }
                );

                this.keyStore = { ...initialKeyStore };
            }
        } catch (error) {
            this.logger.error(`Failed to ensure key file exists: ${error.message}`);
            throw error;
        }
    }

    private async rotateKeys(): Promise<void> {
        const now = new Date();
        
        // Deactivate all existing active access keys
        this.keyStore.keys
            .filter(k => k.type === 'access' && k.active)
            .forEach(k => k.active = false);

        // Create new active access key
        const newAccessKey = this.generateNewKey('access');
        this.keyStore.keys.push(newAccessKey);

        // Clean up old inactive access keys (keep only the most recent inactive one)
        const inactiveAccessKeys = this.keyStore.keys
            .filter(k => k.type === 'access' && !k.active)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Remove all but the most recent inactive access key
        if (inactiveAccessKeys.length > 1) {
            const keysToRemove = inactiveAccessKeys.slice(1);
            this.keyStore.keys = this.keyStore.keys
                .filter(k => !keysToRemove.includes(k));
        }

        // Handle refresh token rotation if needed
        const activeRefreshKey = this.keyStore.keys
            .find(k => k.type === 'refresh' && k.active);

        if (!activeRefreshKey || this.isKeyExpired(activeRefreshKey)) {
            // Deactivate current refresh key if exists
            if (activeRefreshKey) activeRefreshKey.active = false;
            
            // Create new refresh key
            const newRefreshKey = this.generateNewKey('refresh');
            this.keyStore.keys.push(newRefreshKey);
        }

        this.keyStore.lastRotation = now.toISOString();
        await this.saveKeyStore();
    }

    private isKeyExpired(key: KeyPair): boolean {
        return new Date() >= new Date(key.expiresAt);
    }

    public getActiveKey(type: 'access' | 'refresh'): KeyPair {
        return this.keyStore.keys.find(k => k.type === type && k.active);
    }

    public getVerificationKeys(type: 'access' | 'refresh'): KeyPair[] {
        return this.keyStore.keys.filter(k => k.type === type)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 2); // Returns active key + most recent inactive key
    }

    private getActiveKeys(type?: 'access' | 'refresh'): KeyPair[] {
        const activeKeys = this.keyStore.keys.filter(key => key.active);
        return type ? activeKeys.filter(key => key.type === type) : activeKeys;
    }

    private async addNewKey(type: 'access' | 'refresh'): Promise<KeyPair> {
        try {
            const newKey = this.generateNewKey(type);

            this.keyStore = {
                ...this.keyStore,
                keys: [...this.keyStore.keys, newKey]
            };

            await this.saveKeyStore();
            return newKey;
        } catch (error) {
            this.logger.error(`Failed to add new key: ${error.message}`);
            throw error;
        }
    }

    private async saveKeyStore(): Promise<void> {
        try {
            const serializableStore = {
                ...this.keyStore,
                keys: this.keyStore.keys.map(key => ({
                    ...key,
                    createdAt: key.createdAt.toISOString(),
                    expiresAt: key.expiresAt.toISOString()
                }))
            };

            this.logger.debug('Saving key store:', JSON.stringify(serializableStore, null, 2));

            const tempFilePath = `${this.KEY_FILE_PATH}.temp`;

            fs.writeFileSync(
                tempFilePath,
                JSON.stringify(serializableStore, null, 4),
                { encoding: 'utf8', mode: 0o600 }
            );

            fs.renameSync(tempFilePath, this.KEY_FILE_PATH);
            this.logger.debug('Key store saved successfully');
        } catch (error) {
            this.logger.error(`Error saving key store: ${error.message}`);
            throw error;
        }
    }

    private async loadKeysFromFile(): Promise<void> {
        try {
            if (!fs.existsSync(this.KEY_FILE_PATH)) {
                return;
            }

            const data = fs.readFileSync(this.KEY_FILE_PATH, 'utf8');

            try {
                const parsedData = JSON.parse(data);

                if (!parsedData || !Array.isArray(parsedData.keys)) {
                    throw new Error('Invalid key store format');
                }

                const processedKeys = parsedData.keys.map(key => ({
                    ...key,
                    createdAt: new Date(key.createdAt),
                    expiresAt: new Date(key.expiresAt)
                }));

                this.keyStore = {
                    ...parsedData,
                    keys: processedKeys
                };
            } catch (parseError) {
                const backupPath = `${this.KEY_FILE_PATH}.backup.${Date.now()}`;
                fs.copyFileSync(this.KEY_FILE_PATH, backupPath);

                this.keyStore = {
                    keys: [],
                    lastRotation: new Date().toISOString()
                };
            }
        } catch (error) {
            this.keyStore = {
                keys: [],
                lastRotation: new Date().toISOString()
            };
        }
    }
}
