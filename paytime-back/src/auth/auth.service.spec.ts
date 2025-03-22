import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { ConfigService } from '@nestjs/config';
import { MailHelper } from '../Helpers/Mail.helper';
import { OTPHelper } from '../Helpers/OTP.helper';
import { RedisService } from '../redis/redis.service';
import { getModelToken } from '@nestjs/mongoose';
import { Response, Request } from 'express';
import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';

// Mock the stripe service
jest.mock('../stripe/stripe.service', () => ({
  StripeService: jest.fn().mockImplementation(() => ({
    createCustomer: jest.fn().mockResolvedValue({ id: 'stripe-customer-id' }),
  })),
}));

jest.mock('../Helpers/Auth.helper', () => ({
  VerifyPassword: jest.fn().mockReturnValue(true),
  HashPassword: jest.fn().mockReturnValue('hashedPassword'),
}));

describe('AuthService', () => {
  let service: AuthService;

  // Mock all dependencies
  const mockAuthModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    startSession: jest.fn(() => ({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    })),
    sendResetPasswordEmail: jest.fn(),
    createResetPasswordToken: jest.fn(),
  };

  const mockJwtHelper = {
    createAccessToken: jest.fn(),
    createRefreshToken: jest.fn(),
    verifyToken: jest.fn(),
    createResetPasswordToken: jest.fn(),
  };
  
  const mockConfigService = {
    get: jest.fn(),
  };

  const mockMailHelper = {
    sendOTPEmail: jest.fn(),
    sendResetPasswordEmail: jest.fn(),
    createResetPasswordToken: jest.fn(),
  };

  const mockOtpHelper = {
    generateOtp: jest.fn(),
    verifyOtp: jest.fn(),
  };

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    verifyOtp: jest.fn(),
    storeOtp: jest.fn(),
  };

  const mockStripeService = {
    createCustomer: jest.fn().mockResolvedValue({ id: 'stripe-customer-id' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken('Auth'),
          useValue: mockAuthModel,
        },
        {
          provide: JWTHelperService,
          useValue: mockJwtHelper,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MailHelper,
          useValue: mockMailHelper,
        },
        {
          provide: OTPHelper,
          useValue: mockOtpHelper,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // Mock request and response objects for tests
  const mockRequest = {
    headers: {
      'user-agent': 'test-agent',
      cookie: 'refreshToken=test-token',
    },
  } as unknown as Request;

  const mockResponse = {
    cookie: jest.fn(),
  } as unknown as Response;

  // Example test cases
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('RefreshToken', () => {
    it('should refresh token successfully', async () => {
      const userId = 'user-123';
      const oldRefreshToken = 'old-refresh-token';
      const newRefreshToken = 'new-refresh-token';
      const newAccessToken = 'new-access-token';

      jest.spyOn(require('../Helpers/Cookies.helper'), 'getCookie')
        .mockReturnValue(oldRefreshToken);

      mockJwtHelper.verifyToken.mockResolvedValue(userId);
      mockJwtHelper.createRefreshToken.mockResolvedValue(newRefreshToken);
      mockJwtHelper.createAccessToken.mockResolvedValue(newAccessToken);

      const result = await service.RefreshToken(mockRequest, mockResponse);

      expect(mockJwtHelper.verifyToken).toHaveBeenCalledWith(oldRefreshToken);
      expect(mockJwtHelper.createRefreshToken).toHaveBeenCalledWith(userId);
      expect(mockJwtHelper.createAccessToken).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        message: 'Token refreshed successfully',
        Access: newAccessToken
      });
    });

    it('should throw UnauthorizedException when refresh token is missing', async () => {
      jest.spyOn(require('../Helpers/Cookies.helper'), 'getCookie')
        .mockReturnValue(null);

      await expect(service.RefreshToken(mockRequest, mockResponse))
        .rejects.toThrow('Refresh token not found');
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      jest.spyOn(require('../Helpers/Cookies.helper'), 'getCookie')
        .mockReturnValue('invalid-token');

      mockJwtHelper.verifyToken.mockResolvedValue(null);

      await expect(service.RefreshToken(mockRequest, mockResponse))
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('sendResetPasswordEmail', () => {
    it('should send reset password email successfully', async () => {
      const email = 'test@example.com';
      const userId = 'user-123';
      const resetToken = 'reset-token-123';

      mockAuthModel.findOne.mockResolvedValue({ id: userId });
      mockJwtHelper.createResetPasswordToken.mockResolvedValue(resetToken);
      mockMailHelper.sendResetPasswordEmail.mockResolvedValue(true);

      const result = await service.sendResetPasswordEmail(email);

      expect(mockAuthModel.findOne).toHaveBeenCalledWith({ Email: email });
      expect(mockJwtHelper.createResetPasswordToken).toHaveBeenCalledWith(userId);
      expect(mockMailHelper.sendResetPasswordEmail).toHaveBeenCalledWith(email, resetToken);
      expect(result).toEqual({
        message: 'Reset password email sent',
        token: resetToken
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockAuthModel.findOne.mockResolvedValue(null);

      await expect(service.sendResetPasswordEmail('nonexistent@example.com'))
        .rejects.toThrow('User not found');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const token = 'valid-reset-token';
      const userId = 'user-123';
      const newPassword = 'newPassword123';
      const hashedPassword = 'hashedNewPassword123';

      mockJwtHelper.verifyToken.mockResolvedValue(userId);
      jest.spyOn(require('../Helpers/Auth.helper'), 'HashPassword')
        .mockReturnValue(hashedPassword);
      mockAuthModel.findByIdAndUpdate.mockResolvedValue({ id: userId });

      const result = await service.resetPassword(token, newPassword);

      expect(mockJwtHelper.verifyToken).toHaveBeenCalledWith(token);
      expect(require('../Helpers/Auth.helper').HashPassword).toHaveBeenCalledWith(newPassword);
      expect(mockAuthModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, { Password: hashedPassword });
      expect(result).toEqual({ message: 'Password reset successful' });
    });

    it('should throw error when token verification fails', async () => {
      mockJwtHelper.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await expect(service.resetPassword('invalid-token', 'newPassword123'))
        .rejects.toThrow('Invalid token');
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockJwtHelper.verifyToken.mockResolvedValue('nonexistent-user');
      mockAuthModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(service.resetPassword('valid-token', 'newPassword123'))
        .rejects.toThrow('User not found');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      jest.spyOn(require('../Helpers/Cookies.helper'), 'deleteCookie')
        .mockImplementation((res, name) => {
          expect(name).toBe('refreshToken');
          return res;
        });

      const result = await service.logout(mockResponse);

      expect(require('../Helpers/Cookies.helper').deleteCookie).toHaveBeenCalledWith(mockResponse, 'refreshToken');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should handle errors during logout', async () => {
      jest.spyOn(require('../Helpers/Cookies.helper'), 'deleteCookie')
        .mockImplementation(() => {
          throw new Error('Cookie deletion failed');
        });

      await expect(service.logout(mockResponse))
        .rejects.toThrow('Cookie deletion failed');
    });
  });

  describe('Register with Stripe integration', () => {
    let mockStripeService;

    beforeEach(() => {
      mockStripeService = {
        createCustomer: jest.fn()
      };

      Object.defineProperty(service, 'stripeService', {
        value: mockStripeService
      });
    });

    it('should create a Stripe customer during registration', async () => {
      const registerDto = {
        Email: 'new@test.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'johndoe',
        Region: 'US'
      };

      const stripeCustomerId = 'cus_123456789';
      mockAuthModel.findOne.mockResolvedValue(null);
      mockStripeService.createCustomer.mockResolvedValue({ id: stripeCustomerId });

      mockAuthModel.create.mockResolvedValue({
        ...registerDto,
        id: '123',
        StripeCostumer: stripeCustomerId,
        Friend_Code: '123456789012345',
        isVerified: false,
        Role: 'user',
        Friend_list: [],
        Friend_requests: []
      });

      const result = await service.Register(registerDto);

      expect(mockStripeService.createCustomer).toHaveBeenCalledWith('new@test.com', 'johndoe');
      expect(mockAuthModel.create).toHaveBeenCalledWith({
        ...registerDto,
        StripeCostumer: stripeCustomerId
      });
      expect(result.User).toHaveProperty('Custumer', stripeCustomerId);
    });

    it('should handle Stripe customer creation failure', async () => {
      const registerDto = {
        Email: 'new@test.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'johndoe',
        Region: 'US'
      };

      // Setup mock session with spies to properly track method calls
      const sessionMock = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      mockAuthModel.startSession.mockReturnValue(sessionMock);
      
      // Setup the Exist helper to allow the test to proceed
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockResolvedValue(undefined);
        
      mockStripeService.createCustomer.mockRejectedValue(new Error('Stripe API error'));

      await expect(service.Register(registerDto))
        .rejects.toThrow('Stripe API error');

      // Now verify transaction was aborted using the session mock
      expect(sessionMock.abortTransaction).toHaveBeenCalled();
      expect(sessionMock.endSession).toHaveBeenCalled();
    });

    it('should throw error when username already exists', async () => {
      const registerDto = {
        Email: 'new@test.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'existinguser',
        Region: 'US'
      };
      
      // Reset mocks to avoid interference between tests
      jest.clearAllMocks();
      
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockRejectedValueOnce(new BadRequestException('Username already exists'));

      await expect(service.Register(registerDto))
        .rejects.toThrow('Username already exists');
    });

    it('should throw error when email already exists', async () => {
      const registerDto = {
        Email: 'existing@test.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'newuser',
        Region: 'US'
      };
      
      // Reset mocks to avoid interference between tests
      jest.clearAllMocks();
      
      // Mock Exist helper to pass username check but fail on email check
      const existHelperMock = jest.spyOn(require('../Helpers/Exist.helper'), 'Exist');
      
      // Fix: Add type annotations to the parameters
      existHelperMock.mockImplementation((model: any, query: {Username?: string, Email?: string}, shouldExist: boolean) => {
        if (query.Username) {
          return Promise.resolve(); // Username check passes
        } else if (query.Email) {
          return Promise.reject(new BadRequestException('Email already exists')); // Email check fails
        }
        return Promise.resolve(); // Default case
      });

      await expect(service.Register(registerDto))
        .rejects.toThrow('Email already exists');
        
      // Clean up mock to avoid affecting other tests
      existHelperMock.mockRestore();
    });
  });

  describe('Login with device recognition', () => {
    beforeEach(() => {
      // Clear all mocks before each test in this suite to prevent interference
      jest.clearAllMocks();
    });
    
    it('should recognize a known device and skip OTP for verified users', async () => {
      const loginDto = { Email: 'test@test.com', Password: 'password123' };
      const mockUser = {
        id: '123',
        _id: '123',
        Email: 'test@test.com',
        Password: 'hashedPassword',
        isVerified: true,
        isBanned: false,
        isDeleted: false,
        Devices: [{
          userAgent: 'test-agent',
          ip: '127.0.0.1',
          lastUsedAt: new Date()
        }]
      };

      // Setup for device recognition
      jest.spyOn(require('../Helpers/Device.helper'), 'getDeviceInfo')
        .mockReturnValue({
          userAgent: 'test-agent',
          ip: '127.0.0.1'
        });

      jest.spyOn(require('../Helpers/Device.helper'), 'isDeviceRecognized')
        .mockReturnValue(true);

      // Setup the auth flow
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockImplementation(() => Promise.resolve(mockUser));

      mockJwtHelper.createAccessToken.mockResolvedValue('access-token');
      mockJwtHelper.createRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.Login(loginDto, mockResponse, mockRequest);

      expect(result.requiresOTP).toBeFalsy();
      expect(result.Access).toBe('access-token');
      expect(result.User).toBeDefined();
      expect(result.User.id).toBe('123');
    });

    it('should require OTP for unrecognized device even if user is verified', async () => {
      const loginDto = { Email: 'test@test.com', Password: 'password123' };
      const mockUser = {
        id: '123',
        Email: 'test@test.com',
        Password: 'hashedPassword',
        isVerified: true,
        isBanned: false,
        isDeleted: false,
        Devices: [{
          userAgent: 'different-agent',
          ip: '192.168.1.1',
          lastUsedAt: new Date()
        }]
      };

      // Setup for device recognition
      jest.spyOn(require('../Helpers/Device.helper'), 'getDeviceInfo')
        .mockReturnValue({
          userAgent: 'test-agent',
          ip: '127.0.0.1'
        });

      jest.spyOn(require('../Helpers/Device.helper'), 'isDeviceRecognized')
        .mockReturnValue(false);

      // Setup the auth flow
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockResolvedValue(mockUser);
      mockOtpHelper.generateOtp.mockResolvedValue('123456');

      const result = await service.Login(loginDto, mockResponse, mockRequest);

      expect(result.requiresOTP).toBeTruthy();
      expect(mockOtpHelper.generateOtp).toHaveBeenCalledWith('123');
      expect(mockMailHelper.sendOTPEmail).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP and update user', async () => {
      const userId = '123';
      const otp = '123456';
      const mockUser = {
        id: userId,
        Username: 'testuser',
        Email: 'test@test.com',
        Role: 'user',
        isVerified: false,
        Friend_Code: '123456789012345',
        Friend_list: [],
        Friend_requests: []
      };

      mockAuthModel.findById.mockResolvedValue(mockUser);
      mockRedisService.verifyOtp.mockResolvedValue(true);
      mockJwtHelper.createAccessToken.mockReturnValue('access-token');
      mockJwtHelper.createRefreshToken.mockReturnValue('refresh-token');
      mockAuthModel.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        isVerified: true
      });

      const result = await service.verifyOtp({ userId, otp }, mockResponse, mockRequest);

      expect(result.User).toBeDefined();
      expect(result.Access).toBe('access-token');
    });

    it('should throw NotFoundException when user is not found', async () => {
      const verifyOtpDto = { userId: 'nonexistent', otp: '123456' };
      mockAuthModel.findById.mockResolvedValue(null);
      await expect(service.verifyOtp(verifyOtpDto, mockResponse, mockRequest))
        .rejects.toThrow('User not found');
    });
  });

  describe('Login', () => {
    it('should require OTP for unverified users', async () => {
      const loginDto = { Email: 'test@test.com', Password: 'password123' };
      const mockUser = {
        id: '123',
        Email: 'test@test.com',
        Password: 'hashedPassword',
        isVerified: false,
        isBanned: false,
        isDeleted: false,
      };

      const generatedOtp = '123456';

      // Clear all mocks before test
      jest.clearAllMocks();

      // Setup mocks in correct order
      mockAuthModel.findOne.mockResolvedValue(mockUser);
      mockOtpHelper.generateOtp.mockResolvedValue(generatedOtp);
      mockRedisService.storeOtp.mockResolvedValue(undefined);
      mockMailHelper.sendOTPEmail.mockResolvedValue(true);

      // Mock Exist helper
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockResolvedValue(mockUser);

      // Mock VerifyPassword helper
      jest.spyOn(require('../Helpers/Auth.helper'), 'VerifyPassword')
        .mockReturnValue(true);

      const result = await service.Login(loginDto, mockResponse, mockRequest);

      expect(result.requiresOTP).toBeTruthy();
      expect(result.userId).toBe('123');
      expect(mockOtpHelper.generateOtp).toHaveBeenCalledWith('123');
      expect(mockMailHelper.sendOTPEmail).toHaveBeenCalledWith('test@test.com', generatedOtp);
    });

    it('should require OTP for verified user with unrecognized device', async () => {
      const loginDto = { Email: 'test@test.com', Password: 'password123' };
      const mockUser = {
        id: '123',
        Email: 'test@test.com',
        Password: 'hashedPassword',
        isVerified: true,
        isBanned: false,
        isDeleted: false,
        Devices: []
      };

      mockAuthModel.findOne.mockResolvedValue(mockUser);
      mockJwtHelper.createAccessToken.mockReturnValue('access-token');
      mockJwtHelper.createRefreshToken.mockReturnValue('refresh-token');

      const result = await service.Login(loginDto, mockResponse, mockRequest);

      expect(result.requiresOTP).toBeTruthy();
      expect(mockOtpHelper.generateOtp).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      const loginDto = { Email: 'nonexistent@test.com', Password: 'password123' };
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockRejectedValue(new NotFoundException('User not found'));
      await expect(service.Login(loginDto, mockResponse, mockRequest))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException for banned user', async () => {
      const loginDto = { Email: 'banned@test.com', Password: 'password123' };
      const mockUser = {
        id: '123',
        Email: 'banned@test.com',
        Password: 'hashedPassword',
        isBanned: true,
        isDeleted: false,
        isVerified: true,
      };
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockResolvedValue(mockUser);
      await expect(service.Login(loginDto, mockResponse, mockRequest))
        .rejects.toThrow('This account has been banned. Please contact support for more information.');
    });

    it('should throw UnauthorizedException for deleted user', async () => {
      const loginDto = { Email: 'deleted@test.com', Password: 'password123' };
      const mockUser = {
        id: '123',
        Email: 'deleted@test.com',
        Password: 'hashedPassword',
        isBanned: false,
        isDeleted: true,
        isVerified: true,
      };
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockResolvedValue(mockUser);
      await expect(service.Login(loginDto, mockResponse, mockRequest))
        .rejects.toThrow('This account has been deleted.');
    });

    it('should throw BadRequestException for invalid password', async () => {
      const loginDto = { Email: 'test@test.com', Password: 'wrongpassword' };
      const mockUser = {
        id: '123',
        Email: 'test@test.com',
        Password: 'hashedPassword',
        isBanned: false,
        isDeleted: false,
        isVerified: true,
      };
      jest.spyOn(require('../Helpers/Exist.helper'), 'Exist')
        .mockResolvedValue(mockUser);
      jest.spyOn(require('../Helpers/Auth.helper'), 'VerifyPassword')
        .mockReturnValue(false);
      await expect(service.Login(loginDto, mockResponse, mockRequest))
        .rejects.toThrow('Invalid Password');
    });
  });

  describe('LoginWithOTP', () => {
    it('should verify OTP and complete login', async () => {
      const loginWithOtpDto = {
        userId: '123',
        otp: '123456'
      };
      const mockUser = {
        id: '123',
        Email: 'test@test.com',
        isVerified: false,
      };

      mockAuthModel.findById.mockResolvedValue(mockUser);
      mockOtpHelper.verifyOtp.mockResolvedValue(true);
      mockJwtHelper.createAccessToken.mockReturnValue('access-token');
      mockJwtHelper.createRefreshToken.mockReturnValue('refresh-token');

      const result = await service.verifyOtp(loginWithOtpDto, mockResponse, mockRequest);

      expect(result.Access).toBe('access-token');
      expect(mockResponse.cookie).toHaveBeenCalled();
    });

    it('should fail for invalid OTP', async () => {
      const loginWithOtpDto = {
        userId: '123',
        otp: 'invalid'
      };

      mockAuthModel.findById.mockResolvedValue({ id: '123' });
      mockRedisService.verifyOtp.mockResolvedValue(false);

      await expect(service.verifyOtp(loginWithOtpDto, mockResponse, mockRequest))
        .rejects.toThrow('Invalid OTP');
    });
  });
});