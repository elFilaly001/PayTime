import * as bcrypt from 'bcryptjs';


export function HashPassword(password: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
}

export function VerifyPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
}