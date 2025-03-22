export interface KeyPair {
    id: string;
    key: string;
    algorithm: string;
    active: boolean;
    createdAt: Date;
    expiresAt: Date;
} 