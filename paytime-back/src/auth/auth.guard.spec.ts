import { AuthGuard } from './auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtHelperService: JWTHelperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: JWTHelperService,
          useValue: {
            verifyToken: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtHelperService = module.get<JWTHelperService>(JWTHelperService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access with valid token', async () => {
      const mockUser = { id: '123', Username: 'testuser', Role: 'user' };
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token',
        },
      };

      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(jwtHelperService, 'verifyToken').mockResolvedValue(mockUser);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest['user']).toEqual(mockUser);
      expect(jwtHelperService.verifyToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException when no authorization header', async () => {
      const mockRequest = { headers: {} };
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      };

      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(jwtHelperService, 'verifyToken').mockRejectedValue(new Error('Invalid token'));

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });
  });
});
