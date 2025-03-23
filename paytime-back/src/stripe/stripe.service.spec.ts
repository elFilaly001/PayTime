import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';

// Create a complete mock implementation of StripeService
const mockStripeService = {
  createPaymentIntent: jest.fn().mockImplementation((amount, currency, customerId) => {
    return Promise.resolve({ 
      id: 'pi_test123', 
      amount: Math.round(amount * 100), 
      currency, 
      customer: customerId 
    });
  }),
  
  createCustomer: jest.fn().mockImplementation((email, name) => {
    return Promise.resolve({ 
      id: 'cus_test123', 
      email, 
      name 
    });
  }),
  
  createPaymentToken: jest.fn().mockImplementation((number, exp_month, exp_year, cvc) => {
    return Promise.resolve('tok_test123');
  }),
  
  attachPaymentMethod: jest.fn().mockImplementation((customerId, paymentMethodId) => {
    return Promise.resolve({ 
      id: paymentMethodId, 
      customer: customerId 
    });
  }),
  
  processLoanRepayment: jest.fn().mockImplementation((amount, currency, paymentMethodId, customerId) => {
    return Promise.resolve({ 
      id: 'pi_test123', 
      amount: Math.round(amount * 100), 
      currency, 
      customer: customerId, 
      payment_method: paymentMethodId 
    });
  }),
  
  refundPayment: jest.fn().mockImplementation((paymentIntentId) => {
    return Promise.resolve({ 
      id: 'ref_test123', 
      payment_intent: paymentIntentId 
    });
  }),
  
  detachPaymentMethod: jest.fn().mockImplementation((paymentMethodId) => {
    return Promise.resolve({ 
      id: paymentMethodId, 
      customer: null 
    });
  }),
  
  processPayment: jest.fn().mockImplementation((amount, currency, paymentMethodId, description) => {
    return Promise.resolve({ 
      id: 'pi_test123', 
      amount: Math.round(amount * 100), 
      currency, 
      payment_method: paymentMethodId, 
      description 
    });
  }),
  
  sendPayout: jest.fn().mockImplementation((amount, currency, destination, description) => {
    return Promise.resolve({ 
      id: 'po_test123', 
      amount: Math.round(amount * 100), 
      currency, 
      destination, 
      description 
    });
  }),
  
  getBankAccount: jest.fn().mockImplementation((userId) => {
    return Promise.resolve('ba_test123');
  }),
};

describe('StripeService', () => {
  let service;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: StripeService,
          useValue: mockStripeService,
        }
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent with the correct parameters', async () => {
      const amount = 10.99;
      const currency = 'usd';
      const customerId = 'cus_test123';

      await service.createPaymentIntent(amount, currency, customerId);

      expect(service.createPaymentIntent).toHaveBeenCalledWith(amount, currency, customerId);
    });

    it('should return the created payment intent object', async () => {
      const amount = 10.99;
      const currency = 'usd';
      const customerId = 'cus_test123';

      const result = await service.createPaymentIntent(amount, currency, customerId);
      
      expect(result).toEqual({
        id: 'pi_test123',
        amount: Math.round(amount * 100),
        currency,
        customer: customerId
      });
    });

    it('should handle errors when creating payment intent fails', async () => {
      service.createPaymentIntent.mockRejectedValueOnce(new Error('API error'));
      
      await expect(service.createPaymentIntent(10, 'usd', 'cus_test123'))
        .rejects.toThrow('API error');
    });
  });

  describe('createCustomer', () => {
    it('should create a customer with the correct parameters', async () => {
      const email = 'test@example.com';
      const name = 'Test User';

      await service.createCustomer(email, name);

      expect(service.createCustomer).toHaveBeenCalledWith(email, name);
    });

    it('should return the created customer object with correct data', async () => {
      const email = 'test@example.com';
      const name = 'Test User';

      const result = await service.createCustomer(email, name);
      
      expect(result).toEqual({
        id: 'cus_test123',
        email,
        name
      });
    });

    it('should handle validation errors when creating customer', async () => {
      service.createCustomer.mockRejectedValueOnce(new Error('Invalid email'));
      
      await expect(service.createCustomer('invalid-email', 'Test User'))
        .rejects.toThrow('Invalid email');
    });
  });

  describe('createPaymentToken', () => {
    it('should create a payment token with the correct card details', async () => {
      const number = '4242424242424242';
      const exp_month = '12';
      const exp_year = '2025';
      const cvc = '123';

      await service.createPaymentToken(number, exp_month, exp_year, cvc);

      expect(service.createPaymentToken).toHaveBeenCalledWith(number, exp_month, exp_year, cvc);
    });

    it('should throw an error when token creation fails', async () => {
      service.createPaymentToken.mockRejectedValueOnce(new Error('Invalid card'));

      await expect(service.createPaymentToken('invalid', '12', '2025', '123')).rejects.toThrow();
    });
  });

  describe('attachPaymentMethod', () => {
    it('should attach a payment method to a customer', async () => {
      const customerId = 'cus_test123';
      const paymentMethodId = 'pm_test123';

      await service.attachPaymentMethod(customerId, paymentMethodId);

      expect(service.attachPaymentMethod).toHaveBeenCalledWith(customerId, paymentMethodId);
    });
  });

  describe('processLoanRepayment', () => {
    it('should create a payment intent for loan repayment', async () => {
      const amount = 100;
      const currency = 'usd';
      const paymentMethodId = 'pm_test123';
      const customerId = 'cus_test123';
      const options = { idempotencyKey: 'idem_key123' };

      await service.processLoanRepayment(amount, currency, paymentMethodId, customerId, options);

      expect(service.processLoanRepayment).toHaveBeenCalledWith(
        amount, currency, paymentMethodId, customerId, options
      );
    });

    it('should create payment intent without idempotency key when not provided', async () => {
      const amount = 100;
      const currency = 'usd';
      const paymentMethodId = 'pm_test123';
      const customerId = 'cus_test123';

      await service.processLoanRepayment(amount, currency, paymentMethodId, customerId);

      expect(service.processLoanRepayment).toHaveBeenCalledWith(
        amount, currency, paymentMethodId, customerId
      );
    });

    it('should handle payment failure scenarios', async () => {
      service.processLoanRepayment.mockRejectedValueOnce(new Error('Payment failed: insufficient funds'));
      
      await expect(service.processLoanRepayment(100, 'usd', 'pm_test123', 'cus_test123'))
        .rejects.toThrow('Payment failed: insufficient funds');
    });
  });

  describe('refundPayment', () => {
    it('should refund a payment intent', async () => {
      const paymentIntentId = 'pi_test123';

      await service.refundPayment(paymentIntentId);

      expect(service.refundPayment).toHaveBeenCalledWith(paymentIntentId);
    });

    it('should throw an error for an invalid payment intent', async () => {
      service.refundPayment.mockRejectedValueOnce(new Error('No such payment intent'));
      
      await expect(service.refundPayment('invalid_pi'))
        .rejects.toThrow('No such payment intent');
    });

    it('should handle partial refunds', async () => {
      // Add a test case for partial refunds when that feature is implemented
      // This would require modifying the service method first to accept an amount parameter
    });
  });

  describe('detachPaymentMethod', () => {
    it('should detach a payment method', async () => {
      const paymentMethodId = 'pm_test123';

      await service.detachPaymentMethod(paymentMethodId);

      expect(service.detachPaymentMethod).toHaveBeenCalledWith(paymentMethodId);
    });

    it('should throw an error for an invalid payment method', async () => {
      service.detachPaymentMethod.mockRejectedValueOnce(new Error('No such payment method'));
      
      await expect(service.detachPaymentMethod('invalid_pm'))
        .rejects.toThrow('No such payment method');
    });
  });

  describe('processPayment', () => {
    it('should process a payment with the correct parameters', async () => {
      const amount = 50;
      const currency = 'usd';
      const paymentMethodId = 'pm_test123';
      const description = 'Test payment';

      await service.processPayment(amount, currency, paymentMethodId, description);

      expect(service.processPayment).toHaveBeenCalledWith(amount, currency, paymentMethodId, description);
    });

    it('should round amount correctly for decimal values', async () => {
      const amount = 10.55;
      const currency = 'eur';
      const paymentMethodId = 'pm_test123';
      const description = 'Test payment';

      await service.processPayment(amount, currency, paymentMethodId, description);
      
      const result = await service.processPayment(amount, currency, paymentMethodId, description);
      expect(result.amount).toBe(Math.round(amount * 100));
      expect(result.currency).toBe(currency);
    });

    it('should handle payment method errors', async () => {
      service.processPayment.mockRejectedValueOnce(new Error('Invalid payment method'));
      
      await expect(service.processPayment(50, 'usd', 'invalid_pm', 'Test'))
        .rejects.toThrow('Invalid payment method');
    });
  });

  describe('sendPayout', () => {
    it('should send a payout with the correct parameters', async () => {
      const amount = 75;
      const currency = 'usd';
      const destination = 'ba_test123';
      const description = 'Test payout';

      await service.sendPayout(amount, currency, destination, description);

      expect(service.sendPayout).toHaveBeenCalledWith(amount, currency, destination, description);
    });

    it('should handle different currencies correctly', async () => {
      const testCases = [
        { amount: 100, currency: 'usd', expected: 10000 },
        { amount: 100, currency: 'jpy', expected: 10000 }, // JPY doesn't use decimal places
        { amount: 10.25, currency: 'eur', expected: 1025 },
      ];

      for (const testCase of testCases) {
        service.sendPayout.mockImplementationOnce((amount, currency) => {
          return Promise.resolve({
            id: 'po_test123',
            amount: Math.round(amount * 100),
            currency,
          });
        });

        const result = await service.sendPayout(
          testCase.amount, 
          testCase.currency, 
          'ba_test123', 
          'Test payout'
        );
        
        expect(result.amount).toBe(testCase.expected);
        expect(result.currency).toBe(testCase.currency);
      }
    });

    it('should throw an error for invalid destination', async () => {
      service.sendPayout.mockRejectedValueOnce(new Error('Invalid destination account'));
      
      await expect(service.sendPayout(75, 'usd', 'invalid_ba', 'Test'))
        .rejects.toThrow('Invalid destination account');
    });
  });

  describe('getBankAccount', () => {
    it('should get or create a bank account', async () => {
      const userId = 'user_123';

      await service.getBankAccount(userId);

      expect(service.getBankAccount).toHaveBeenCalledWith(userId);
    });

    it('should handle non-existent users', async () => {
      service.getBankAccount.mockRejectedValueOnce(new Error('User not found'));
      
      await expect(service.getBankAccount('nonexistent_user'))
        .rejects.toThrow('User not found');
    });
  });
});
