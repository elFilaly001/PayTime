import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { BadRequestException, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { RegisterDto, LoginDto, VerifyOtpDto, ResetPasswordEmailDto } from './dtos/Auth.dto';
import * as DeviceHelper from '../Helpers/Device.helper';

// Mock the stripe service
jest.mock('../stripe/stripe.service', () => ({
  StripeService: jest.fn().mockImplementation(() => ({
    createCustomer: jest.fn().mockResolvedValue({ id: 'stripe-customer-id' }),
  })),
}));

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService;
  let mockRequest: Request;
  let mockResponse: Response;

  beforeEach(async () => {
    mockAuthService = {
      Register: jest.fn(),
      Login: jest.fn(),
      RefreshToken: jest.fn(),
      sendResetPasswordEmail: jest.fn(),
      resetPassword: jest.fn(),
      verifyOtp: jest.fn(),
      logout: jest.fn(),
    };

    mockRequest = {} as Request;
    mockResponse = {} as Response;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Register', () => {
    it('should register a new user', async () => {
      const registerDto: RegisterDto = {
        Username: 'testuser',
        Email: 'test@example.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        Region: 'US',
      };
      const expectedResult = { 
        User: {
          Username: 'testuser',
          Email: 'test@example.com',
          Custumer: 'cus_123456789',
          Role: 'user',
          isVerified: false,
          Friend_Code: '123456789',
          Friend_list: [],
          Friend_requests: []
        },
        message: 'User created successfully'
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

  describe('Login', () => {
    it('should login a user', async () => {
      const loginDto: LoginDto = {
        Email: 'test@example.com',
        Password: 'password123',
      };
      const expectedResult = { 
        User: {
          id: '123',
          Username: 'testuser',
          Email: 'test@example.com'
        },
        Access: 'access-token',
        requiresOTP: false
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
        message: 'OTP has been sent to your email'
      };

      mockAuthService.Login.mockResolvedValue(expectedResult);

      const result = await controller.Login(loginDto, mockResponse, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.Login).toHaveBeenCalledWith(loginDto, mockResponse, mockRequest);
    });

    it('should throw UnauthorizedException when user is banned', async () => {
      const loginDto = {
        Email: 'banned@example.com',
        Password: 'password123',
      };

      mockAuthService.Login.mockRejectedValue(
        new UnauthorizedException('This account has been banned')
      );

      await expect(controller.Login(loginDto, mockResponse, mockRequest))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      const loginDto = { Email: 'nonexistent@example.com', Password: 'password123' };
      mockAuthService.Login.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.Login(loginDto, mockResponse, mockRequest)).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException when user is deleted', async () => {
      const loginDto = { Email: 'deleted@example.com', Password: 'password123' };
      mockAuthService.Login.mockRejectedValue(new UnauthorizedException('This account has been deleted.'));
      await expect(controller.Login(loginDto, mockResponse, mockRequest)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when password is invalid', async () => {
      const loginDto = { Email: 'test@example.com', Password: 'wrongpassword' };
      mockAuthService.Login.mockRejectedValue(new BadRequestException('Invalid Password'));
      await expect(controller.Login(loginDto, mockResponse, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully', async () => {
      const verifyOtpDto: VerifyOtpDto = {
        userId: '123',
        otp: '123456',
      };
      const expectedResult = { 
        User: {
          id: '123',
          Username: 'testuser',
          Email: 'test@example.com'
        },
        Access: 'access-token'
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

      mockAuthService.verifyOtp.mockRejectedValue(new UnauthorizedException('Invalid OTP'));

      await expect(controller.verifyOtp(verifyOtpDto, mockResponse, mockRequest))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when user is not found', async () => {
      const verifyOtpDto = { userId: 'nonexistent', otp: '123456' };
      mockAuthService.verifyOtp.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.verifyOtp(verifyOtpDto, mockResponse, mockRequest)).rejects.toThrow(NotFoundException);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const expectedResult = { message: 'Logged out successfully' };

      mockAuthService.logout.mockResolvedValue(expectedResult);

      const result = await controller.logout(mockResponse);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.logout).toHaveBeenCalledWith(mockResponse);
    });
  });

  describe('RefreshToken', () => {
    it('should refresh the token', async () => {
      const expectedResult = { 
        message: 'Token refreshed successfully',
        Access: 'new-access-token'
      };

      mockAuthService.RefreshToken.mockResolvedValue(expectedResult);

      const result = await controller.RefreshToken(mockRequest, mockResponse);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.RefreshToken).toHaveBeenCalledWith(mockRequest, mockResponse);
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      mockAuthService.RefreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token')
      );

      await expect(controller.RefreshToken(mockRequest, mockResponse))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token is missing', async () => {
      mockAuthService.RefreshToken.mockRejectedValue(new UnauthorizedException('Refresh token not found'));
      await expect(controller.RefreshToken(mockRequest, mockResponse)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sendResetPasswordEmail', () => {
    it('should send password reset instructions', async () => {
      const resetPasswordEmailDto: ResetPasswordEmailDto = {
        email: 'test@example.com',
      };

      const expectedResult = { 
        message: 'Reset password email sent', 
        token: 'reset-token'
      };

      mockAuthService.sendResetPasswordEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendResetPasswordEmail(resetPasswordEmailDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.sendResetPasswordEmail).toHaveBeenCalledWith(resetPasswordEmailDto.email);
    });

    it('should throw NotFoundException when user is not found', async () => {
      const resetPasswordEmailDto = { email: 'nonexistent@example.com' };
      mockAuthService.sendResetPasswordEmail.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.sendResetPasswordEmail(resetPasswordEmailDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const token = 'reset-token';
      const password = 'newpassword';
      
      const expectedResult = { message: 'Password reset successful' };

      mockAuthService.resetPassword.mockResolvedValue(expectedResult);

      const result = await controller.resetPassword(token, password);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(token, password);
    });

    it('should throw error when token is invalid', async () => {
      const token = 'invalid-token';
      const password = 'newpassword';
      mockAuthService.resetPassword.mockRejectedValue(new Error('Invalid token'));
      await expect(controller.resetPassword(token, password)).rejects.toThrow('Invalid token');
    });

    it('should throw NotFoundException when user is not found', async () => {
      const token = 'valid-token';
      const password = 'newpassword';
      mockAuthService.resetPassword.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.resetPassword(token, password)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDeviceInfo', () => {
    it('should return device info from request', () => {
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'accept-language': 'en-US',
        },
        ip: '127.0.0.1',
      } as unknown as Request;

      const deviceInfo = { 
        engine: 'Blink',
        cpu: 'amd64',
        os: 'Windows',
        browser: 'Chrome',
        ip: '127.0.0.1'
      } as const;

      jest.spyOn(DeviceHelper, 'getDeviceInfo').mockReturnValue(deviceInfo);

      const result = controller.getDeviceInfo(mockRequest);

      expect(result).toEqual(deviceInfo);
      expect(DeviceHelper.getDeviceInfo).toHaveBeenCalledWith(mockRequest);
    });
  });
});