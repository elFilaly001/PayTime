import { Test, TestingModule } from '@nestjs/testing';
import { AuthInterceptor } from './auth.interceptor';
import { BadRequestException, CallHandler, ExecutionContext } from '@nestjs/common';
import { Observable, of } from 'rxjs';

// Mock the Auth Helper
jest.mock('../../Helpers/Auth.helper', () => ({
  HashPassword: jest.fn().mockReturnValue('hashed_password')
}));

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthInterceptor],
    }).compile();

    interceptor = module.get<AuthInterceptor>(AuthInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    let mockContext: ExecutionContext;
    let mockCallHandler: CallHandler;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        body: {
          Username: 'testuser',
          Email: 'test@example.com',
          Password: 'password123',
          ConfirmPassword: 'password123'
        }
      };

      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest)
        })
      } as unknown as ExecutionContext;

      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of('test result'))
      } as unknown as CallHandler;
    });

    it('should process valid input correctly', () => {
      const result = interceptor.intercept(mockContext, mockCallHandler);
      
      // Test the result is passed through
      result.subscribe(value => {
        expect(value).toBe('test result');
      });

      // Verify transformations
      expect(mockRequest.body.Password).toBe('hashed_password');
      expect(mockRequest.body.ConfirmPassword).toBeUndefined();
      expect(mockRequest.body.Friend_Code).toBeDefined();
      expect(mockRequest.body.Friend_Code.length).toBe(15);
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should throw error when Username is missing', () => {
      mockRequest.body = {
        Email: 'test@example.com',
        Password: 'password123',
        ConfirmPassword: 'password123'
      };

      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow(BadRequestException);
      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow('Username, Email and Password are required');
    });

    it('should throw error when Email is missing', () => {
      mockRequest.body = {
        Username: 'testuser',
        Password: 'password123',
        ConfirmPassword: 'password123'
      };

      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow(BadRequestException);
      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow('Username, Email and Password are required');
    });

    it('should throw error when Password is missing', () => {
      mockRequest.body = {
        Username: 'testuser',
        Email: 'test@example.com',
        ConfirmPassword: 'password123'
      };

      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow(BadRequestException);
      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow('Username, Email and Password are required');
    });

    it('should throw error when ConfirmPassword is missing', () => {
      mockRequest.body = {
        Username: 'testuser',
        Email: 'test@example.com',
        Password: 'password123'
      };

      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow(BadRequestException);
      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow('passwords do not match');
    });

    it('should throw error when passwords do not match', () => {
      mockRequest.body = {
        Username: 'testuser',
        Email: 'test@example.com',
        Password: 'password123',
        ConfirmPassword: 'differentpassword'
      };

      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow(BadRequestException);
      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow('passwords do not match');
    });

    it('should generate a 15-digit Friend_Code', () => {
      interceptor.intercept(mockContext, mockCallHandler);
      expect(mockRequest.body.Friend_Code).toBeDefined();
      expect(typeof mockRequest.body.Friend_Code).toBe('string');
      expect(mockRequest.body.Friend_Code.length).toBe(15);
    });

    it('should remove ConfirmPassword from the request body', () => {
      interceptor.intercept(mockContext, mockCallHandler);
      expect(mockRequest.body.ConfirmPassword).toBeUndefined();
    });

    it('should hash the password', () => {
      const { HashPassword } = require('../../Helpers/Auth.helper');
      interceptor.intercept(mockContext, mockCallHandler);
      expect(HashPassword).toHaveBeenCalledWith('password123');
      expect(mockRequest.body.Password).toBe('hashed_password');
    });
  });
});
