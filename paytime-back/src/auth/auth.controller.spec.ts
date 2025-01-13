import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { JWTHelperService } from '../Helpers/JWT.helpers';
import { ConfigService } from '@nestjs/config';
import { MailHelper } from '../Helpers/Mail.helper';
import { OTPHelper } from '../Helpers/OTP.helper';
import { RedisService } from '../redis/redis.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthModel = {
    create: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: getModelToken('Auth'),
          useValue: mockAuthModel,
        },
        {
          provide: JWTHelperService,
          useValue: { createAccessToken: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: MailHelper,
          useValue: { sendOTPEmail: jest.fn() },
        },
        {
          provide: OTPHelper,
          useValue: { generateOtp: jest.fn() },
        },
        {
          provide: RedisService,
          useValue: { set: jest.fn(), get: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
