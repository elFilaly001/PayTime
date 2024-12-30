export class RegisterDto {
    Username: string;
    Email: string;
    Password: string;
    ConfirmPassword: string;
} 


export class LoginDto {
    Email: string;
    Password: string;
}