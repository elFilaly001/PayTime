import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { ConfigService } from '@nestjs/config';
import { MailHelper } from '../Helpers/Mail.helper';
import { OTPHelper } from '../Helpers/OTP.helper';
import { RedisService } from '../redis/redis.service';
import { getModelToken } from '@nestjs/mongoose';
import { Response, Request } from 'express';

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
  };

  const mockJwtHelper = {
    createAccessToken: jest.fn(),
    createRefreshToken: jest.fn(),
    verifyToken: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockMailHelper = {
    sendOTPEmail: jest.fn(),
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

  describe('Register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = {
        Email: 'new@test.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'johndoe',
        Region: 'US'
      };
      
      mockAuthModel.findOne.mockResolvedValue(null);
      mockAuthModel.create.mockResolvedValue({ 
        ...registerDto, 
        id: '123',
        Friend_Code: '123456789012345',
        isVerified: false,
        Role: 'user',
        Friend_list: [],
        Friend_requests: []
      });
      mockOtpHelper.generateOtp.mockResolvedValue('123456');

      const result = await service.Register(registerDto);

      expect(result).toEqual({
        User: {
          Username: 'johndoe',
          Email: 'new@test.com',
          Role: 'user',
          isVerified: false,
          Friend_Code: '123456789012345',
          Friend_list: [],
          Friend_requests: []
        }
      });
    });

    it('should fail if email already exists', async () => {
      const registerDto = {
        Email: 'existing@test.com',
        Password: 'password123',
        ConfirmPassword: 'password123',
        FirstName: 'John',
        LastName: 'Doe',
        Username: 'johndoe',
        Region: 'US'
      };
      mockAuthModel.findOne.mockResolvedValue({ id: '123' });

      await expect(service.Register(registerDto))
        .rejects.toThrow('already exists: Username or/and Email');
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

    it('should successfully login verified user with recognized device', async () => {
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

  // Add more test cases for other methods...
});
