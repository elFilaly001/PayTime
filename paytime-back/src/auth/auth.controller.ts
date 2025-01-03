import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dtos/Auth.dto';
import { UseInterceptors } from '@nestjs/common';
import { AuthInterceptor } from './Interceptors/auth.interceptor';
import { LoginDto } from './dtos/Auth.dto';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @UseInterceptors(AuthInterceptor) 
  @Post("register")
  Rgister(@Body() Data : RegisterDto){ 
    return this.authService.Register(Data);
  }


  @Post("login")
  Login(@Body() Data : LoginDto, @Res({ passthrough: true }) res: Response){ 
    return this.authService.Login(Data, res);
  }


  @Get("refresh")
  RefreshToken(@Req() req: Request) {
    return this.authService.RefreshToken(req);
  }


  

}
