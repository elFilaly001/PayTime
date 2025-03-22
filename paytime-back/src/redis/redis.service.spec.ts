import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
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

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set', () => {
    it('should call redisClient.set with the correct parameters', async () => {
      // Arrange
      const key = 'testKey';
      const value = 'testValue';
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      await service.set(key, value);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
    });
  });

  describe('get', () => {
    it('should return the value stored in redis', async () => {
      // Arrange
      const key = 'testKey';
      const expectedValue = 'testValue';
      mockRedisClient.get.mockResolvedValue(expectedValue);

      // Act
      const result = await service.get(key);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(expectedValue);
    });

    it('should return null if key does not exist', async () => {
      // Arrange
      const key = 'nonExistentKey';
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.get(key);

      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });
  });

  describe('storeOtp', () => {
    it('should store OTP with expiry time', async () => {
      // Arrange
      const userId = 'user123';
      const otp = '123456';
      mockRedisClient.set.mockResolvedValue('OK');
      
      // Act
      await service.storeOtp(userId, otp);
      
      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(`otp:${userId}`, otp, 'EX', 300);
    });
  });

  describe('getOtp', () => {
    it('should retrieve stored OTP for a user', async () => {
      // Arrange
      const userId = 'user123';
      const expectedOtp = '123456';
      mockRedisClient.get.mockResolvedValue(expectedOtp);
      
      // Act
      const result = await service.getOtp(userId);
      
      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(`otp:${userId}`);
      expect(result).toBe(expectedOtp);
    });
    
    it('should return null if OTP not found', async () => {
      // Arrange
      const userId = 'user123';
      mockRedisClient.get.mockResolvedValue(null);
      
      // Act
      const result = await service.getOtp(userId);
      
      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(`otp:${userId}`);
      expect(result).toBeNull();
    });
  });

  describe('verifyOtp', () => {
    it('should return true and delete OTP if verification succeeds', async () => {
      // Arrange
      const userId = 'user123';
      const otp = '123456';
      mockRedisClient.get.mockResolvedValue(otp);
      mockRedisClient.del.mockResolvedValue(1);
      
      // Act
      const result = await service.verifyOtp(userId, otp);
      
      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(`otp:${userId}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`otp:${userId}`);
      expect(result).toBe(true);
    });
    
    it('should return false if OTP does not match', async () => {
      // Arrange
      const userId = 'user123';
      const storedOtp = '123456';
      const providedOtp = '654321';
      mockRedisClient.get.mockResolvedValue(storedOtp);
      
      // Act
      const result = await service.verifyOtp(userId, providedOtp);
      
      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(`otp:${userId}`);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should return false if OTP does not exist', async () => {
      // Arrange
      const userId = 'user123';
      const otp = '123456';
      mockRedisClient.get.mockResolvedValue(null);
      
      // Act
      const result = await service.verifyOtp(userId, otp);
      
      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledWith(`otp:${userId}`);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  // Additional set method tests
  describe('set - additional scenarios', () => {
    it('should handle set with custom expiry time', async () => {
      const key = 'expiryKey';
      const value = 'expiryValue';
      const expiryTime = 60; // 60 seconds
      mockRedisClient.set.mockResolvedValue('OK');

      // Call set manually with EX option
      await service['redisClient'].set(key, value, 'EX', expiryTime);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value, 'EX', expiryTime);
    });

    it('should handle errors during set operation', async () => {
      const key = 'errorKey';
      const value = 'errorValue';
      const errorMessage = 'Redis connection error';
      mockRedisClient.set.mockRejectedValue(new Error(errorMessage));

      await expect(service.set(key, value)).rejects.toThrow(errorMessage);
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
    });

    it('should handle empty values correctly', async () => {
      const key = 'emptyKey';
      const value = '';
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set(key, value);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
    });
  });

  // Additional get method tests
  describe('get - additional scenarios', () => {
    it('should handle errors during get operation', async () => {
      const key = 'errorKey';
      const errorMessage = 'Redis connection error';
      mockRedisClient.get.mockRejectedValue(new Error(errorMessage));

      await expect(service.get(key)).rejects.toThrow(errorMessage);
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
    });

    it('should handle empty string values correctly', async () => {
      const key = 'emptyValueKey';
      mockRedisClient.get.mockResolvedValue('');

      const result = await service.get(key);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe('');
    });
  });

  // Tests for OTP functionality with edge cases
  describe('OTP functionality - edge cases', () => {
    it('should handle empty OTP values', async () => {
      const userId = 'user123';
      const emptyOtp = '';
      mockRedisClient.set.mockResolvedValue('OK');

      await service.storeOtp(userId, emptyOtp);

      expect(mockRedisClient.set).toHaveBeenCalledWith(`otp:${userId}`, emptyOtp, 'EX', 300);
    });

    it('should handle verification with empty OTP input', async () => {
      const userId = 'user123';
      const storedOtp = '123456';
      const emptyOtp = '';
      mockRedisClient.get.mockResolvedValue(storedOtp);

      const result = await service.verifyOtp(userId, emptyOtp);

      expect(result).toBe(false);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle errors during OTP verification', async () => {
      const userId = 'user123';
      const otp = '123456';
      const errorMessage = 'Redis error during verification';
      mockRedisClient.get.mockRejectedValue(new Error(errorMessage));

      await expect(service.verifyOtp(userId, otp)).rejects.toThrow(errorMessage);
    });

    it('should handle errors during OTP deletion after verification', async () => {
      const userId = 'user123';
      const otp = '123456';
      const errorMessage = 'Redis error during deletion';
      
      mockRedisClient.get.mockResolvedValue(otp);
      mockRedisClient.del.mockRejectedValue(new Error(errorMessage));

      await expect(service.verifyOtp(userId, otp)).rejects.toThrow(errorMessage);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`otp:${userId}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`otp:${userId}`);
    });
  });

  // Direct Redis client method tests
  describe('direct Redis client operations', () => {
    it('should handle del operation correctly', async () => {
      const key = 'deleteMe';
      mockRedisClient.del.mockResolvedValue(1);

      await service['redisClient'].del(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
    });

    it('should handle del operation for non-existent key', async () => {
      const key = 'nonExistentKey';
      mockRedisClient.del.mockResolvedValue(0);

      const result = await service['redisClient'].del(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
      expect(result).toBe(0);
    });

    it('should handle multiple keys in del operation', async () => {
      const keys = ['key1', 'key2', 'key3'];
      mockRedisClient.del.mockResolvedValue(3);

      await service['redisClient'].del(...keys);

      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
    });
  });

  // Performance and edge case tests
  describe('performance and edge cases', () => {
    it('should handle long keys and values correctly', async () => {
      const longKey = 'a'.repeat(1000);
      const longValue = 'b'.repeat(10000);
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(longValue);

      await service.set(longKey, longValue);
      const result = await service.get(longKey);

      expect(mockRedisClient.set).toHaveBeenCalledWith(longKey, longValue);
      expect(mockRedisClient.get).toHaveBeenCalledWith(longKey);
      expect(result).toBe(longValue);
    });

    it('should handle special characters in keys and values', async () => {
      const specialKey = 'special!@#$%^&*()_+';
      const specialValue = '你好，世界！😊';
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(specialValue);

      await service.set(specialKey, specialValue);
      const result = await service.get(specialKey);

      expect(mockRedisClient.set).toHaveBeenCalledWith(specialKey, specialValue);
      expect(mockRedisClient.get).toHaveBeenCalledWith(specialKey);
      expect(result).toBe(specialValue);
    });
  });
});
