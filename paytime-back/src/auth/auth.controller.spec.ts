import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { ConfigService } from '@nestjs/config';
import { MailHelper } from '../Helpers/Mail.helper';
import { OTPHelper } from '../Helpers/OTP.helper';
import { RedisService } from '../redis/redis.service';
import { Response, Request } from 'express';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  const mockRequest = {
    headers: {
      'user-agent': 'test-agent',
    },
    cookies: {
      refreshToken: 'test-refresh-token',
    },
  } as unknown as Request;

  const mockAuthService = {
    Register: jest.fn(),
    Login: jest.fn(),
    verifyOtp: jest.fn(),
    Logout: jest.fn(),
    RefreshToken: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    getUserInfo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: getModelToken('Auth'),
          useValue: {},
        },
        {
          provide: JWTHelperService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: MailHelper,
          useValue: {},
        },
        {
          provide: OTPHelper,
          useValue: {},
        },
        {
          provide: RedisService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        Email: 'test@example.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'johndoe',
        Region: 'US',
      };

      const expectedResult = {
        User: {
          Username: 'johndoe',
          Email: 'test@example.com',
          Role: 'user',
          isVerified: false,
        },
      };

      mockAuthService.Register.mockResolvedValue(expectedResult);

      const result = await controller.Rgister(registerDto);
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.Register).toHaveBeenCalledWith(registerDto);
    });

    it('should throw BadRequestException when passwords do not match', async () => {
      const registerDto = {
        Email: 'test@example.com',
        Password: 'password123',
        ConfirmPassword: 'different',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'johndoe',
        Region: 'US',
      };

      mockAuthService.Register.mockRejectedValue(new BadRequestException('Passwords do not match'));

      await expect(controller.Rgister(registerDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when email already exists', async () => {
      const registerDto = {
        Email: 'existing@example.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'johndoe',
        Region: 'US',
      };

      mockAuthService.Register.mockRejectedValue(new ConflictException('Email already exists'));

      await expect(controller.Rgister(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login successfully when OTP is not required', async () => {
      const loginDto = {
        Email: 'test@example.com',
        Password: 'password123',
      };

      const expectedResult = {
        User: {
          id: '123',
          Username: 'johndoe',
        },
        Access: 'access-token',
        requiresOTP: false,
      };

      mockAuthService.Login.mockResolvedValue(expectedResult);

      const result = await controller.Login(loginDto, mockResponse, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.Login).toHaveBeenCalledWith(loginDto, mockResponse, mockRequest);
    });

    it('should return userId when OTP is required', async () => {
      const loginDto = {
        Email: 'test@example.com',
        Password: 'password123',
      };

      const expectedResult = {
        requiresOTP: true,
        userId: '123',
      };

      mockAuthService.Login.mockResolvedValue(expectedResult);

      const result = await controller.Login(loginDto, mockResponse, mockRequest);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully', async () => {
      const verifyOtpDto = {
        userId: '123',
        otp: '123456',
      };

      const expectedResult = {
        User: {
          id: '123',
          Username: 'johndoe',
        },
        Access: 'access-token',
      };

      mockAuthService.verifyOtp.mockResolvedValue(expectedResult);

      const result = await controller.verifyOtp(verifyOtpDto, mockResponse, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(verifyOtpDto, mockResponse, mockRequest);
    });

    it('should throw exception for invalid OTP', async () => {
      const verifyOtpDto = {
        userId: '123',
        otp: 'invalid',
      };

      mockAuthService.verifyOtp.mockRejectedValue(new BadRequestException('Invalid OTP'));

      await expect(controller.verifyOtp(verifyOtpDto, mockResponse, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const expectedResult = { message: 'Logged out successfully' };

      mockAuthService.Logout.mockResolvedValue(expectedResult);

      const result = await controller.logout(mockResponse);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.Logout).toHaveBeenCalledWith(mockResponse);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const expectedResult = {
        Access: 'new-access-token',
      };

      mockAuthService.RefreshToken.mockResolvedValue(expectedResult);

      const result = await controller.RefreshToken(mockRequest, mockResponse);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.RefreshToken).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset instructions', async () => {
      const forgotPasswordDto = {
        Email: 'test@example.com',
      };

      const expectedResult = { message: 'Reset instructions sent' };

      mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

      // Use PascalCase as that's what the controller uses
      const result = await controller.ForgotPassword(forgotPasswordDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const resetPasswordDto = {
        token: 'reset-token',
        Password: 'newpassword',
        ConfirmPassword: 'newpassword',
      };

      const expectedResult = { message: 'Password reset successfully' };

      mockAuthService.resetPassword.mockResolvedValue(expectedResult);

      // Fix parameter handling to match controller expectations
      const result = await controller.resetPassword(
        resetPasswordDto.token, 
        resetPasswordDto.Password  // Pass password as string, not as object
      );

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(resetPasswordDto);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const changePasswordDto = {
        OldPassword: 'oldpassword',
        NewPassword: 'newpassword',
        ConfirmNewPassword: 'newpassword',
      };

      const mockUser = { id: '123' };
      const expectedResult = { message: 'Password changed successfully' };

      mockAuthService.changePassword.mockResolvedValue(expectedResult);

      // Use PascalCase as that's what the controller uses
      const result = await controller.ChangePassword(changePasswordDto, mockUser);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(changePasswordDto, mockUser);
    });
  });

  describe('getUserInfo', () => {
    it('should return user info successfully', async () => {
      const mockUser = {
        id: '123',
        Username: 'johndoe',
        Email: 'test@example.com',
      };

      const expectedResult = {
        User: mockUser
      };

      mockAuthService.getUserInfo.mockResolvedValue(expectedResult);

      // Use PascalCase as that's what the controller uses
      const result = await controller.GetUserInfo(mockUser);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.getUserInfo).toHaveBeenCalledWith(mockUser);
    });
  });
});
