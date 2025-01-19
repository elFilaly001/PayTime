import { Injectable, Logger } from '@nestjs/common';
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
    type: 'access' | 'refresh';  // Add key type
}

interface KeyStore {
    keys: KeyPair[];
    lastRotation: string;
}

@Injectable()
export class KeyManagerService {

    private logger = new Logger(KeyManagerService.name);
    private readonly KEY_EXPIRATION_DAYS = {
        access: 7,    // Access tokens rotate more frequently
        refresh: 30   // Refresh tokens need longer validity
    };

    private keyStore: KeyStore = {
        keys: [],
        lastRotation: new Date().toISOString()
    };

    constructor(private configService: ConfigService) {
        this.loadKeysFromFile();  
    }

    // Public methods needed for JWT.helpers.ts
    async getCurrentAccessKey(): Promise<KeyPair> {
        const activeKeys = this.getActiveKeys().filter(k => k.type === 'access');
        
        if (activeKeys.length === 0) {
            this.logger.warn('No active access key found - generating new key');
            return this.addNewKey('access');
        }

        return activeKeys.reduce((latest, current) => 
            new Date(latest.createdAt) > new Date(current.createdAt) ? latest : current
        );
    }

    async getCurrentRefreshKey(): Promise<KeyPair> {
        const activeKeys = this.getActiveKeys().filter(k => k.type === 'refresh');
        
        if (activeKeys.length === 0) {
            this.logger.warn('No active refresh key found - generating new key');
            return this.addNewKey('refresh');
        }

        return activeKeys.reduce((latest, current) => 
            new Date(latest.createdAt) > new Date(current.createdAt) ? latest : current
        );
    }

    async findKeyById(kid: string): Promise<KeyPair | undefined> {
        await this.getCurrentAccessKey();
        await this.getCurrentRefreshKey();
        return this.keyStore.keys.find(key => key.id === kid && key.active);
    }

    private GenerateNewKey(type: 'access' | 'refresh'): KeyPair {
        const id = crypto.randomBytes(8).toString('hex');
        const key = crypto.randomBytes(32).toString('hex');
        const now = new Date();
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + this.KEY_EXPIRATION_DAYS[type]); 

        // Randomly select a secure algorithm
        const algorithms: Algorithm[] = ['HS256', 'HS384', 'HS512'];
        const algorithm = algorithms[Math.floor(Math.random() * algorithms.length)];

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

    private async createFile(): Promise<void> {
        const filePath = path.join(process.cwd(), 'keys.json');
        const initialKeyStore = {
            keys: [],
            lastRotation: new Date().toISOString()
        };
        
        try {
            await fs.promises.writeFile(filePath, JSON.stringify(initialKeyStore, null, 4));
            this.keyStore = initialKeyStore;
            this.logger.log('Created new key store file');
            
            // Create initial key
            await this.addNewKey('access');
            await this.addNewKey('refresh');
            await this.updateKeyStore(this.keyStore);
        } catch (error) {
            this.logger.error(`Error creating key store file: ${error}`);
            throw error;
        }
    }

    private checkFile(): boolean {
        try {
            const filePath = path.join(process.cwd(), 'keys.json');
            this.logger.log(`Checking file: ${filePath}`);
            const exists = fs.existsSync(filePath);
            if (!exists) {
                this.createFile();
            }
            return exists;
        } catch (error) {
            this.logger.error(`Error checking file: ${error}`);
            
        }
    }

    private async rotateKeys(): Promise<void> {
        try {
            const now = new Date();
            
            // Check and rotate access keys
            const activeAccessKeys = this.getActiveKeys().filter(k => k.type === 'access');
            if (activeAccessKeys.length === 0 || new Date(activeAccessKeys[0].expiresAt) <= now) {
                this.logger.log('Rotating access keys');
                await this.addNewKey('access');
            }

            // Check and rotate refresh keys
            const activeRefreshKeys = this.getActiveKeys().filter(k => k.type === 'refresh');
            if (activeRefreshKeys.length === 0 || new Date(activeRefreshKeys[0].expiresAt) <= now) {
                this.logger.log('Rotating refresh keys');
                await this.addNewKey('refresh');
            }

            // Deactivate expired keys
            this.keyStore.keys.forEach((key) => {
                if (new Date(key.expiresAt) <= now) {
                    key.active = false;
                }
            });

            await this.updateKeyStore(this.keyStore);
        } catch (error) {
            this.logger.error(`Error rotating keys: ${error}`);
            throw error;
        }
    }

    private GetAllKeys(): KeyPair[] {
        return this.keyStore.keys;
    }

    private getActiveKeys(): KeyPair[] {
        return this.keyStore.keys.filter(key => key.active);
    }

    private async addNewKey(type: 'access' | 'refresh'): Promise<KeyPair> {
        const newKey = this.GenerateNewKey(type);
        this.keyStore.keys.push(newKey);
        await this.updateKeyStore(this.keyStore);
        return newKey;
    }

    private readAndParseFile(): KeyStore {
        const filePath = path.join(process.cwd(), 'keys.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        this.logger.log(`File content read from ${filePath}`);
        return JSON.parse(fileContent) as KeyStore;
    }

    private async updateKeyStore(keyStore: { keys: KeyPair[], lastRotation: string }): Promise<void> {
        const filePath = path.join(process.cwd(), 'keys.json');
        try {
            await fs.promises.writeFile(filePath, JSON.stringify(keyStore, null, 4));
            this.logger.log('Key store updated successfully');
        } catch (error) {
            this.logger.error(`Error updating key store: ${error}`);
            throw error;
        }
    }

    private loadKeysFromFile(): void {
        try {
            if (this.checkFile()) {
                const loadedStore = this.readAndParseFile();
                this.updateKeyStore(loadedStore);
            } else {
                this.logger.warn('No keys file found');
                throw new Error('Keys file not found - please create a valid keys.json file');
            }
        } catch (error) {
            this.logger.error(`Error loading keys from file: ${error}`);
            this.keyStore = {
                keys: [],
                lastRotation: new Date().toISOString()
            };
        }
    }

    private async loadKeyStore(): Promise<KeyPair[]> {
        try {
            const filePath = path.join(process.cwd(), 'keys.json');
            
            if (!fs.existsSync(filePath)) {
                await this.createFile();
                return this.keyStore.keys;
            }

            const data = await fs.promises.readFile(filePath, 'utf8');
            
            try {
                const parsedData = JSON.parse(data);
                if (parsedData && Array.isArray(parsedData.keys)) {
                    this.keyStore = parsedData;
                    return this.keyStore.keys;
                }
                
                this.keyStore = {
                    keys: [],
                    lastRotation: new Date().toISOString()
                };
                await this.updateKeyStore(this.keyStore);
                return this.keyStore.keys;
                
            } catch (parseError) {
                this.keyStore = {
                    keys: [],
                    lastRotation: new Date().toISOString()
                };
                await this.updateKeyStore(this.keyStore);
                return this.keyStore.keys;
            }
        } catch (error) {
            this.logger.error(`Error loading key store: ${error}`);
            throw error;
        }
    }

}
