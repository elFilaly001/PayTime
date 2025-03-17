import { CanActivate, ExecutionContext, Injectable , BadGatewayException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JWTHelperService } from '../Helpers/JWT.helpers';

@Injectable()
export class WsGuard implements CanActivate {

  constructor(private jwtHelper: JWTHelperService) { }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    console.log('Websocket guard activated');
    const client = context.switchToWs().getClient();
    // console.log('Websocket client: ', client);
    const token = this.extractTokenFromHeader(client);

    console.log(`WebSocket connection attempt with token: ${token}`);


    if (!token) {
      throw new BadGatewayException('No token provided');
    }

    try {
      const decodedUserId = await this.jwtHelper.verifyToken(token);
      client.handshake.auth.userId = decodedUserId;
    
      console.log(`WebSocket authenticated for user: ${decodedUserId}`);
      return true;
    } catch (error) {
      throw new BadGatewayException('Invalid token');
    }
  }

  private extractTokenFromHeader(client: any): string | undefined {
    const [type, token] = client.handshake.headers.authorization?.split(' ') ?? [];
    console.log(`Extracted token: ${token}`);
    return type === 'Bearer' ? token : undefined;
  }
}
