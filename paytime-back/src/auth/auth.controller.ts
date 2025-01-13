import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, ResetPasswordEmailDto } from './dtos/Auth.dto';
import { UseInterceptors } from '@nestjs/common';
import { AuthInterceptor } from './Interceptors/auth.interceptor';
import { LoginDto } from './dtos/Auth.dto';
import { Response, Request } from 'express';
import { getDeviceInfo } from '../Helpers/Device.helper';
import { VerifyOtpDto } from './dtos/Auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @UseInterceptors(AuthInterceptor) 
  @Post("register")
  Rgister(@Body() Data : RegisterDto, @Req() req: Request){ 
    return this.authService.Register(Data, req);
  }


  @Post("login")
  Login(@Body() Data : LoginDto, @Res({ passthrough: true }) res: Response, @Req() req: Request ){ 
    return this.authService.Login(Data, res, req);
  }


  @Get("refresh")
    RefreshToken(@Req() req: Request) {
    return this.authService.RefreshToken(req);
  }

  // @Get('device-info')
  // getDeviceInfo(@Req() request: Request) {
  //   const deviceInfo = getDeviceInfo(request);
  //   return deviceInfo;
  // }

  @Post("verify-otp")
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request
  ) {
    return this.authService.verifyOtp(verifyOtpDto, res, req);
  }

  @Post("send-reset-password-email")
  async sendResetPasswordEmail(@Body() resetPasswordEmailDto: ResetPasswordEmailDto) {
    return this.authService.sendResetPasswordEmail(resetPasswordEmailDto.email);
  }

  @Post("reset-password")
  async resetPassword(@Body("token") token: string, @Body("password") password: string) {
    return this.authService.resetPassword(token, password);
  }

}
