export class RegisterDto {
    Username: string;
    Email: string;
    Password: string;
    ConfirmPassword: string;
    Region: string;
} 


export class LoginDto {
    Email: string;
    Password: string;
}

export class VerifyOtpDto {
    userId: string;
    otp: string;
}