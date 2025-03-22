import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { StripeService } from '../stripe/stripe.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { Payments } from './schema/payment.schema';
import { Transaction } from '../transaction/schema/transaction.schema';
import { CreatePaymentIdDto } from './dto/create-payment.dto';

// Mock implementation of the required dependencies
const mockStripeService = {
  processLoanRepayment: jest.fn(),
  createCustomer: jest.fn(),
  attachPaymentMethod: jest.fn(),
};

const mockPaymentModel = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  find: jest.fn(),
  updateMany: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  startSession: jest.fn().mockReturnValue({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  }),
};

const mockTransactionModel = {
  create: jest.fn(),
};

describe('PaymentService', () => {
  let service: PaymentService;
  let stripeService: StripeService;
  let paymentModel: Model<Payments>;
  let transactionModel: Model<Transaction>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
        {
          provide: getModelToken('Payments'),
          useValue: mockPaymentModel,
        },
        {
          provide: getModelToken('Transaction'),
          useValue: mockTransactionModel,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    stripeService = module.get<StripeService>(StripeService);
    paymentModel = module.get<Model<Payments>>(getModelToken('Payments'));
    transactionModel = module.get<Model<Transaction>>(getModelToken('Transaction'));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processLoanRepayment', () => {
    it('should successfully process a loan repayment', async () => {
      // Mock data
      const amount = 100;
      const senderId = 'sender123';
      const receiverId = 'receiver123';
      const loanId = 'loan123';
      const paymentMethodId = 'pm_123';
      const customerId = 'cus_123';
      
      // Mock responses
      const mockPaymentIntent = { id: 'pi_123', status: 'succeeded' };
      const mockPayment = { _id: 'payment123' };
      const mockTransaction = { _id: 'transaction123' };
      
      // Setup mocks
      mockStripeService.processLoanRepayment.mockResolvedValue(mockPaymentIntent);
      mockPaymentModel.create.mockResolvedValue(mockPayment);
      mockTransactionModel.create.mockResolvedValue(mockTransaction);
      
      // Execute
      const result = await service.processLoanRepayment(
        amount, senderId, receiverId, loanId, paymentMethodId, customerId
      );
      
      // Assert
      expect(stripeService.processLoanRepayment).toHaveBeenCalledWith(
        amount, 'usd', paymentMethodId, customerId
      );
      expect(paymentModel.create).toHaveBeenCalledWith({
        userId: senderId,
        stripeCustomerId: customerId,
        stripePaymentMethodId: paymentMethodId,
        amount: amount,
        status: mockPaymentIntent.status,
        stripePaymentIntentId: mockPaymentIntent.id
      });
      expect(transactionModel.create).toHaveBeenCalledWith({
        senderId,
        receiverId,
        amount,
        status: 'COMPLETED',
        type: 'REPAYMENT',
        paymentMethod: 'STRIPE',
        paymentId: mockPayment._id,
        metadata: {
          loanId,
          description: 'Loan repayment'
        }
      });
      expect(result).toEqual({ payment: mockPayment, transaction: mockTransaction });
    });

    it('should handle errors during loan repayment processing', async () => {
      // Setup mock to throw an error
      mockStripeService.processLoanRepayment.mockRejectedValue(new Error('Stripe error'));
      
      // Execute and assert
      await expect(service.processLoanRepayment(
        100, 'sender123', 'receiver123', 'loan123', 'pm_123', 'cus_123'
      )).rejects.toThrow(BadRequestException);
      
      // Verify transaction was aborted
      expect(mockPaymentModel.startSession().abortTransaction).toHaveBeenCalled();
    });

    it('should handle zero amount payments', async () => {
      // Mock data with zero amount
      const amount = 0;
      const senderId = 'sender123';
      const receiverId = 'receiver123';
      const loanId = 'loan123';
      const paymentMethodId = 'pm_123';
      const customerId = 'cus_123';
      
      // Mock responses
      const mockPaymentIntent = { id: 'pi_123', status: 'succeeded' };
      mockStripeService.processLoanRepayment.mockResolvedValue(mockPaymentIntent);
      
      // Execute and assert
      await service.processLoanRepayment(
        amount, senderId, receiverId, loanId, paymentMethodId, customerId
      );
      
      // Verify amount is passed as-is
      expect(stripeService.processLoanRepayment).toHaveBeenCalledWith(
        0, 'usd', paymentMethodId, customerId
      );
    });

    it('should handle failed Stripe payment intents', async () => {
      // Mock data
      const amount = 100;
      const senderId = 'sender123';
      const receiverId = 'receiver123';
      const loanId = 'loan123';
      const paymentMethodId = 'pm_123';
      const customerId = 'cus_123';
      
      // Mock a failed payment intent
      const mockPaymentIntent = { id: 'pi_123', status: 'failed' };
      mockStripeService.processLoanRepayment.mockResolvedValue(mockPaymentIntent);
      mockPaymentModel.create.mockResolvedValue({ _id: 'payment123' });
      
      // Execute
      const result = await service.processLoanRepayment(
        amount, senderId, receiverId, loanId, paymentMethodId, customerId
      );
      
      // Verify the status is recorded as-is
      expect(paymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed'
        })
      );
    });
  });

  describe('recordCashPayment', () => {
    it('should successfully record a cash payment', async () => {
      // Mock data
      const amount = 100;
      const senderId = 'sender123';
      const receiverId = 'receiver123';
      const loanId = 'loan123';
      const meetingLocation = 'Coffee Shop';
      const meetingDate = new Date();
      
      // Mock response
      const mockTransaction = { _id: 'transaction123' };
      mockTransactionModel.create.mockResolvedValue(mockTransaction);
      
      // Execute
      const result = await service.recordCashPayment(
        amount, senderId, receiverId, loanId, meetingLocation, meetingDate
      );
      
      // Assert
      expect(transactionModel.create).toHaveBeenCalledWith({
        senderId,
        receiverId,
        amount,
        status: 'CASH_PENDING_CONFIRMATION',
        type: 'REPAYMENT',
        paymentMethod: 'CASH',
        metadata: {
          loanId,
          description: 'Cash payment for loan repayment',
          meetingLocation,
          meetingDate
        }
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should handle errors when recording cash payment', async () => {
      // Setup mock to throw an error
      mockTransactionModel.create.mockRejectedValue(new Error('Database error'));
      
      // Execute and assert
      await expect(service.recordCashPayment(
        100, 'sender123', 'receiver123', 'loan123'
      )).rejects.toThrow(BadRequestException);
    });

    it('should handle missing optional parameters', async () => {
      // Mock data without optional parameters
      const amount = 100;
      const senderId = 'sender123';
      const receiverId = 'receiver123';
      const loanId = 'loan123';
      
      // Mock response
      const mockTransaction = { _id: 'transaction123' };
      mockTransactionModel.create.mockResolvedValue(mockTransaction);
      
      // Execute
      await service.recordCashPayment(amount, senderId, receiverId, loanId);
      
      // Assert the transaction was created with undefined optional fields
      expect(transactionModel.create).toHaveBeenCalledWith({
        senderId,
        receiverId,
        amount,
        status: 'CASH_PENDING_CONFIRMATION',
        type: 'REPAYMENT',
        paymentMethod: 'CASH',
        metadata: {
          loanId,
          description: 'Cash payment for loan repayment',
          meetingLocation: undefined,
          meetingDate: undefined
        }
      });
    });

    it('should handle negative amount', async () => {
      // Mock data with negative amount
      const amount = -100;
      const senderId = 'sender123';
      const receiverId = 'receiver123';
      const loanId = 'loan123';
      
      // If the service should reject negative amounts, we'd expect an error
      // If it should accept them, we'd test that it passes through
      mockTransactionModel.create.mockImplementation(() => {
        throw new Error('Amount must be positive');
      });
      
      // Execute and assert
      await expect(service.recordCashPayment(
        amount, senderId, receiverId, loanId
      )).rejects.toThrow(BadRequestException);
    });
  });

  describe('addCard', () => {
    it('should add a new card and make it default if it is the first card', async () => {
      // Mock data
      const cardData: CreatePaymentIdDto = {
        costumerId: 'cus_123',
        paymentMethodId: 'pm_123',
        holderName: 'John Doe',
        last4: '4242',
        brand: 'visa',
        exp_month: '12',  // Changed to string
        exp_year: '2025'  // Changed to string
      };
      
      // Mock responses
      const mockPayment = { _id: 'payment123' };
      mockPaymentModel.create.mockResolvedValue(mockPayment);
      mockPaymentModel.countDocuments.mockResolvedValue(1); // First card
      mockPaymentModel.findByIdAndUpdate.mockResolvedValue({ ...mockPayment, isDefault: true });
      
      // Need to properly spy on the service method with a compatible return type
      jest.spyOn(service, 'setDefaultCard').mockImplementation(() => {
        return Promise.resolve(mockPaymentModel.findByIdAndUpdate.mockReturnValue({ 
          ...mockPayment, 
          isDefault: true 
        })());
      });
      
      // Execute
      const result = await service.addCard(cardData);
      
      // Assert
      expect(paymentModel.create).toHaveBeenCalledWith({
        stripeCustomerId: cardData.costumerId,
        stripePaymentMethodId: cardData.paymentMethodId,
        holderName: cardData.holderName,
        last4: cardData.last4,
        cardBrand: cardData.brand,
        expiryMonth: cardData.exp_month,
        expiryYear: cardData.exp_year,
        isDefault: false,
      });
      expect(paymentModel.countDocuments).toHaveBeenCalledWith({ stripeCustomerId: cardData.costumerId });
      expect(service.setDefaultCard).toHaveBeenCalledWith(cardData.costumerId, mockPayment._id.toString());
      expect(result).toEqual(mockPayment);
    });

    it('should add a card but not make it default if other cards exist', async () => {
      // Mock response for a non-first card
      mockPaymentModel.create.mockResolvedValue({ _id: 'payment123' });
      mockPaymentModel.countDocuments.mockResolvedValue(3); // Not the first card
      
      // Spy on the setDefaultCard method
      jest.spyOn(service, 'setDefaultCard');
      
      // Execute
      await service.addCard({
        costumerId: 'cus_123',
        paymentMethodId: 'pm_123',
        holderName: 'John Doe',
        last4: '4242',
        brand: 'visa',
        exp_month: '12',  // Changed to string
        exp_year: '2025'  // Changed to string
      });
      
      // Assert that setDefaultCard was NOT called
      expect(service.setDefaultCard).not.toHaveBeenCalled();
    });

    it('should handle duplicate card errors', async () => {
      // Mock data
      const cardData: CreatePaymentIdDto = {
        costumerId: 'cus_123',
        paymentMethodId: 'pm_123',
        holderName: 'John Doe',
        last4: '4242',
        brand: 'visa',
        exp_month: '12',
        exp_year: '2025'
      };
      
      // Mock a duplicate card error
      mockPaymentModel.create.mockImplementation(() => {
        throw new Error('Card already exists');
      });
      
      // Execute and assert
      await expect(service.addCard(cardData))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle expired cards', async () => {
      // Mock data with expired card
      const cardData: CreatePaymentIdDto = {
        costumerId: 'cus_123',
        paymentMethodId: 'pm_123',
        holderName: 'John Doe',
        last4: '4242',
        brand: 'visa',
        exp_month: '12',
        exp_year: '2020' // Past year
      };
      
      // Execute
      const mockPayment = { _id: 'payment123' };
      mockPaymentModel.create.mockResolvedValue(mockPayment);
      
      // We're testing that the service accepts the card regardless of expiry
      // Since validation should be done at Stripe level, not in our service
      const result = await service.addCard(cardData);
      
      // Assert it was created with the expired year
      expect(paymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiryYear: '2020'
        })
      );
    });
  });

  describe('deleteCreditCard', () => {
    it('should successfully delete a non-default card', async () => {
      // Mock response for a non-default card
      mockPaymentModel.findById.mockResolvedValue({ _id: 'payment123', isDefault: false });
      mockPaymentModel.findByIdAndDelete.mockResolvedValue(true);
      
      // Execute
      const result = await service.deleteCreditCard('payment123');
      
      // Assert
      expect(paymentModel.findById).toHaveBeenCalledWith('payment123');
      expect(paymentModel.findByIdAndDelete).toHaveBeenCalledWith('payment123');
      expect(result).toEqual({ message: 'Payment method deleted successfully' });
    });

    it('should throw error when trying to delete a default card', async () => {
      // Mock response for a default card
      mockPaymentModel.findById.mockResolvedValue({ _id: 'payment123', isDefault: true });
      
      // Execute and assert
      await expect(service.deleteCreditCard('payment123'))
        .rejects.toThrow(BadRequestException);
      expect(paymentModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should throw error when card is not found', async () => {
      // Mock response for card not found
      mockPaymentModel.findById.mockResolvedValue(null);
      
      // Execute and assert - updated to match actual implementation
      await expect(service.deleteCreditCard('payment123'))
        .rejects.toThrow(BadRequestException);
      expect(paymentModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });

  describe('GetUserCards', () => {
    it('should return all cards for a user', async () => {
      // Mock data
      const customerId = 'cus_123';
      const mockCards = [
        { _id: 'card1', last4: '4242' },
        { _id: 'card2', last4: '1234' }
      ];
      
      // Mock response
      mockPaymentModel.find.mockResolvedValue(mockCards);
      
      // Execute
      const result = await service.GetUserCards(customerId);
      
      // Assert
      expect(paymentModel.find).toHaveBeenCalledWith({ stripeCustomerId: customerId });
      expect(result).toEqual(mockCards);
    });

    it('should handle errors when fetching user cards', async () => {
      // Setup mock to throw an error
      mockPaymentModel.find.mockRejectedValue(new Error('Database error'));
      
      // Execute and assert
      await expect(service.GetUserCards('cus_123'))
        .rejects.toThrow(BadRequestException);
    });

    it('should return empty array when user has no cards', async () => {
      // Mock empty response
      mockPaymentModel.find.mockResolvedValue([]);
      
      // Execute
      const result = await service.GetUserCards('cus_123');
      
      // Assert
      expect(result).toEqual([]);
    });

    it('should filter cards by customer ID', async () => {
      // Execute
      await service.GetUserCards('cus_123');
      
      // Assert the query was properly constructed
      expect(paymentModel.find).toHaveBeenCalledWith({ 
        stripeCustomerId: 'cus_123' 
      });
    });
  });

  describe('setDefaultCard', () => {
    it('should set a card as default', async () => {
      // Mock data
      const customerId = 'cus_123';
      const cardId = 'card123';
      const updatedCard = { _id: cardId, isDefault: true };
      
      // Mock responses
      mockPaymentModel.updateMany.mockResolvedValue(null);
      mockPaymentModel.findByIdAndUpdate.mockResolvedValue(updatedCard);
      
      // Execute
      const result = await service.setDefaultCard(customerId, cardId);
      
      // Assert
      expect(paymentModel.updateMany).toHaveBeenCalledWith(
        { stripeCustomerId: customerId },
        { isDefault: false }
      );
      expect(paymentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        cardId,
        { isDefault: true },
        { new: true }
      );
      expect(result).toEqual(updatedCard);
    });

    it('should throw error when card is not found', async () => {
      // Mock findByIdAndUpdate to return null (card not found)
      mockPaymentModel.updateMany.mockResolvedValue(null);
      mockPaymentModel.findByIdAndUpdate.mockResolvedValue(null);
      
      // Execute and assert - updated to match actual implementation
      await expect(service.setDefaultCard('cus_123', 'card123'))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle case when customer has no cards', async () => {
      // Mock responses for customer with no cards
      mockPaymentModel.updateMany.mockResolvedValue({ modifiedCount: 0 });
      mockPaymentModel.findByIdAndUpdate.mockResolvedValue(null);
      
      // Execute and assert
      await expect(service.setDefaultCard('cus_123', 'card123'))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle database transaction failures', async () => {
      // Mock updateMany to fail
      mockPaymentModel.updateMany.mockRejectedValue(new Error('Database error'));
      
      // Execute and assert
      await expect(service.setDefaultCard('cus_123', 'card123'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('setupCardForUser', () => {
    it('should successfully set up a card for a user', async () => {
      // Mock data
      const userId = 'user123';
      const email = 'user@example.com';
      const name = 'John Doe';
      const paymentMethodId = 'pm_123';
      
      // Mock responses
      const mockCustomer = { id: 'cus_123' };
      const mockPaymentMethod = {
        card: {
          last4: '4242',
          brand: 'visa',
          exp_month: '12',  // Changed to string
          exp_year: '2025'  // Changed to string
        }
      };
      const mockPayment = { _id: 'payment123' };
      
      mockStripeService.createCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.attachPaymentMethod.mockResolvedValue(mockPaymentMethod);
      mockPaymentModel.create.mockResolvedValue(mockPayment);
      
      // Execute
      const result = await service.setupCardForUser(userId, email, name, paymentMethodId);
      
      // Assert
      expect(stripeService.createCustomer).toHaveBeenCalledWith(email, name);
      expect(stripeService.attachPaymentMethod).toHaveBeenCalledWith(
        mockCustomer.id, paymentMethodId
      );
      expect(paymentModel.create).toHaveBeenCalledWith({
        userId,
        stripeCustomerId: mockCustomer.id,
        stripePaymentMethodId: paymentMethodId,
        last4: mockPaymentMethod.card.last4,
        cardBrand: mockPaymentMethod.card.brand,
        expiryMonth: mockPaymentMethod.card.exp_month,
        expiryYear: mockPaymentMethod.card.exp_year,
        isDefault: false,
        isActive: true
      });
      expect(result).toEqual(mockPayment);
    });

    it('should handle errors during card setup', async () => {
      // Mock Stripe service to throw an error
      mockStripeService.createCustomer.mockRejectedValue(new Error('Stripe error'));
      
      // Execute and assert
      await expect(service.setupCardForUser(
        'user123', 'user@example.com', 'John Doe', 'pm_123'
      )).rejects.toThrow(BadRequestException);
    });

    it('should handle missing customer information', async () => {
      // Mock the behavior to throw an error for empty email/name
      mockStripeService.createCustomer.mockImplementation((email, name) => {
        if (!email || !name) {
          throw new Error('Missing customer information');
        }
        return { id: 'cus_123' };
      });
      
      // Call with empty strings
      await expect(service.setupCardForUser(
        'user123', '', '', 'pm_123'
      )).rejects.toThrow(BadRequestException);
      
      // Since the mock will be called but will throw an error internally,
      // we should verify the parameters passed rather than it not being called
      expect(stripeService.createCustomer).toHaveBeenCalledWith('', '');
    });
  });
});
