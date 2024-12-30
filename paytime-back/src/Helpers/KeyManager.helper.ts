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
}

interface KeyStore {
    keys: KeyPair[];
    lastRotation: string;
}

@Injectable()
export class KeyManagerService {

    private logger = new Logger(KeyManagerService.name);
    private readonly KEY_EXPIRATION_DAYS = 30;  // How long a key remains active
    private readonly KEY_RETENTION_DAYS = 40;   // How long to keep expired keys
    private readonly KEY_CHECK_INTERVAL = 12;

    private keyStore: KeyStore = {
        keys: [],
        lastRotation: new Date().toISOString()
    };

    constructor(private configService: ConfigService) {
        this.loadKeysFromFile();  
    }

    // Public methods needed for JWT.helpers.ts
    async getCurrentKey(): Promise<KeyPair> {
        const keys = await this.loadKeyStore();
        const activeKeys = this.getActiveKeys();

        if(keys.length === 0) {
            this.logger.warn('No keys found - generating new key');
            const newKey = await this.addNewKey();
            return newKey;
        }else if (activeKeys.length === 0) {
            this.logger.warn('No active keys found - generating new key');
            const newKey = await this.addNewKey();
            return newKey;
        }

        return activeKeys.reduce((latest, current) => 
            new Date(latest.createdAt) > new Date(current.createdAt) ? latest : current
        );
    }

    async findKeyById(kid: string): Promise<KeyPair | undefined> {
        await this.getCurrentKey();
        return this.keyStore.keys.find(key => key.id === kid && key.active);
    }

    private GenerateNewKey(): KeyPair {
        const id = crypto.randomBytes(8).toString('hex');
        const key = crypto.randomBytes(32).toString('hex');
        const now = new Date();
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + 30); 

        // Define a list of algorithms to rotate between
        const algorithms: Algorithm[] = ['HS256', 'HS384', 'HS512'];
        // Randomly select an algorithm from the list
        const algorithm = algorithms[Math.floor(Math.random() * algorithms.length)];

        return {
            id,
            key,
            algorithm, 
            active: true,
            createdAt: now,
            expiresAt: expiry
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
            await this.addNewKey();
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

    private async rotateKeys(): Promise<KeyPair> {
        try {
            await this.loadKeyStore();
            const now = new Date();
            const activeKeys = this.getActiveKeys();
            
            // Check if current active key is expired
            const currentKey = activeKeys[0];
            const isKeyExpired = currentKey ? new Date(currentKey.expiresAt) <= now : true;
            
            this.logger.debug('Key rotation check:', {
                now: now.toISOString(),
                currentKeyExpiry: currentKey?.expiresAt,
                isKeyExpired,
            });

            // Only rotate if current key is expired
            if (isKeyExpired) {
                this.logger.log('Rotating keys - deactivating old keys');
                this.keyStore.keys.forEach((key) => {
                    key.active = false;
                });

                const newKey = await this.addNewKey();
                this.keyStore.lastRotation = now.toISOString();
                await this.updateKeyStore(this.keyStore);
                return newKey;
            }
            
            return activeKeys[0];
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

    private async addNewKey(): Promise<KeyPair> {
        const newKey = this.GenerateNewKey();
        this.keyStore.keys.push(newKey);
        await this.updateKeyStore(this.keyStore); // Save changes to file
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
