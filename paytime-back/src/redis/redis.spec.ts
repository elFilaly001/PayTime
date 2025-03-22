import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('Redis', () => {
  let service: RedisService;

  const mockRedisClient = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: "REDIS_CLIENT",
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Integration-style tests with focus on service interactions
  describe('integration tests', () => {
    it('should successfully store and retrieve a value', async () => {
      const key = 'integrationKey';
      const value = 'integrationValue';
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(value);

      await service.set(key, value);
      const result = await service.get(key);

      expect(result).toBe(value);
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
    });

    it('should handle complete OTP workflow correctly', async () => {
      const userId = 'testUser';
      const otp = '123456';
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(otp);
      mockRedisClient.del.mockResolvedValue(1);

      // Store OTP
      await service.storeOtp(userId, otp);
      
      // Verify OTP
      const verificationResult = await service.verifyOtp(userId, otp);
      
      expect(verificationResult).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(`otp:${userId}`, otp, 'EX', 300);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`otp:${userId}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`otp:${userId}`);
    });

    it('should handle race conditions in OTP verification', async () => {
      const userId = 'raceUser';
      const otp = '123456';
      
      // Setup mock to return OTP first time, then null (as if another process deleted it)
      mockRedisClient.get
        .mockResolvedValueOnce(otp)
        .mockResolvedValueOnce(null);
      
      // First verification should succeed
      const firstResult = await service.verifyOtp(userId, otp);
      expect(firstResult).toBe(true);
      
      // Second verification should fail (OTP already used)
      const secondResult = await service.verifyOtp(userId, otp);
      expect(secondResult).toBe(false);
    });
  });

  // Mock service behavior tests
  describe('service behavior', () => {
    it('should log appropriate messages', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const userId = 'logUser';
      const otp = '123456';
      
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(otp);
      
      await service.storeOtp(userId, otp);
      expect(consoleSpy).toHaveBeenCalledWith(`OTP stored for user ${userId}: ${otp}`);
      
      await service.getOtp(userId);
      expect(consoleSpy).toHaveBeenCalledWith(`Retrieved OTP for user ${userId}: ${otp}`);
      
      consoleSpy.mockRestore();
    });
  });
});
