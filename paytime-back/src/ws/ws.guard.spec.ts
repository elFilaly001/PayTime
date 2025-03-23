import { ExecutionContext, BadGatewayException } from '@nestjs/common';
import { WsGuard } from './ws.guard';
import { JWTHelperService } from '../Helpers/JWT.helpers';

describe('WsGuard', () => {
  let guard: WsGuard;
  let jwtHelper: JWTHelperService;
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    jwtHelper = {
      verifyToken: jest.fn()
    } as any;

    guard = new WsGuard(jwtHelper);

    const mockClient = {
      handshake: {
        headers: {
          authorization: 'Bearer valid-token'
        },
        auth: {}
      }
    };

    mockExecutionContext = {
      switchToWs: () => ({
        getClient: () => mockClient
      })
    } as any;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow connection with valid token', async () => {
    const userId = 'user-123';
    (jwtHelper.verifyToken as jest.Mock).mockResolvedValue(userId);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(jwtHelper.verifyToken).toHaveBeenCalledWith('valid-token');
  });

  it('should throw BadGatewayException when no token provided', async () => {
    const contextWithoutToken = {
      switchToWs: () => ({
        getClient: () => ({
          handshake: {
            headers: {},
            auth: {}
          }
        })
      })
    } as any;

    await expect(guard.canActivate(contextWithoutToken))
      .rejects
      .toThrow(BadGatewayException);
  });

  it('should throw BadGatewayException when token is invalid', async () => {
    (jwtHelper.verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(mockExecutionContext))
      .rejects
      .toThrow(BadGatewayException);
  });

  it('should set userId in client auth object upon successful verification', async () => {
    const userId = 'user-123';
    (jwtHelper.verifyToken as jest.Mock).mockResolvedValue(userId);

    const mockClient = mockExecutionContext.switchToWs().getClient();
    await guard.canActivate(mockExecutionContext);

    expect(mockClient.handshake.auth.userId).toBe(userId);
  });
});
