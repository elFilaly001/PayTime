import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dtos/Auth.dto';
import { UseInterceptors } from '@nestjs/common';
import { AuthInterceptor } from './Interceptors/auth.interceptor';
import { LoginDto } from './dtos/Auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @UseInterceptors(AuthInterceptor) 
  @Post("register")
  Rgister(@Body() Data : RegisterDto){ 
    return this.authService.Register(Data);
  }


  @Post("login")
  Login(@Body() Data : LoginDto){ 
    return this.authService.Login(Data);
  }


  @Get("refresh/:token")
  RefreshToken(@Param("token") RefreshToken : string){ 
    return this.authService.RefreshToken(RefreshToken);
  }


  

}
