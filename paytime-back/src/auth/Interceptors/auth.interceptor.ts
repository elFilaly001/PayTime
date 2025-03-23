import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { StripeService } from '../../stripe/stripe.service';
import {HashPassword} from '../../Helpers/Auth.helper';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    try {

      if (!request.body.Username || !request.body.Email || !request.body.Password) {
        throw new BadRequestException('Username, Email and Password are required');
      }

      if (request.body.Password !== request.body.ConfirmPassword || !request.body.Password || !request.body.ConfirmPassword) {
        throw new BadRequestException('passwords do not match');
      }
      
      request.body.Friend_Code = Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0');
      
      const {ConfirmPassword, ...user} = request.body;
      request.body = user;
      user.Password = HashPassword(user.Password);

      return next.handle();
    } catch (error) {
      throw error;
    }
  }
}
