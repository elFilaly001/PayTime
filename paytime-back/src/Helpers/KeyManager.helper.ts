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
            
            await this.rotateKeys(false);
            
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
        if (!this.initialized) await this.initialize();
        
        const activeKeys = this.getActiveKeys('refresh');
        
        if (activeKeys.length === 0) {
            return await this.addNewKey('refresh');
        }

        return activeKeys.sort((a, b) => 
            b.createdAt.getTime() - a.createdAt.getTime()
        )[0];
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

        const algorithm: Algorithm = 'HS256';

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

    private async rotateKeys(forceRotation: boolean = false): Promise<void> {
        try {
            const now = new Date();
            let keysUpdated = false;
            
            // Mark expired keys as inactive, but DON'T DELETE them
            for (let i = 0; i < this.keyStore.keys.length; i++) {
                const key = this.keyStore.keys[i];
                
                if (key.active && key.expiresAt <= now) {
                    this.keyStore.keys[i] = {
                        ...key,
                        active: false
                    };
                    keysUpdated = true;
                }
            }
            
            // Check if we need new access keys
            const activeAccessKeys = this.getActiveKeys('access');
            const accessExpiryBuffer = new Date(now);
            accessExpiryBuffer.setDate(accessExpiryBuffer.getDate() + 1); // 1 day buffer
            
            if (forceRotation || activeAccessKeys.length === 0 || 
                activeAccessKeys.every(key => key.expiresAt <= accessExpiryBuffer)) {
                await this.addNewKey('access');
                keysUpdated = true;
            }
            
            // Check if we need new refresh keys
            const activeRefreshKeys = this.getActiveKeys('refresh');
            const refreshExpiryBuffer = new Date(now);
            refreshExpiryBuffer.setDate(refreshExpiryBuffer.getDate() + 3); // 3 day buffer
            
            if (forceRotation || activeRefreshKeys.length === 0 || 
                activeRefreshKeys.every(key => key.expiresAt <= refreshExpiryBuffer)) {
                await this.addNewKey('refresh');
                keysUpdated = true;
            }
            
            if (keysUpdated) {
                this.keyStore.lastRotation = now.toISOString();
                await this.saveKeyStore();
            }
        } catch (error) {
            this.logger.error(`Error during key rotation: ${error.message}`);
            throw error;
        }
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
            
            const tempFilePath = `${this.KEY_FILE_PATH}.temp`;
            
            fs.writeFileSync(
                tempFilePath, 
                JSON.stringify(serializableStore, null, 4),
                { encoding: 'utf8', mode: 0o600 }
            );
            
            fs.renameSync(tempFilePath, this.KEY_FILE_PATH);
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
