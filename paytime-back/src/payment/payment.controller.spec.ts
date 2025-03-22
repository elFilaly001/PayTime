import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CreatePaymentIdDto, ProcessLoanRepaymentDto, RecordCashPaymentDto } from './dto/create-payment.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common'; // Add this import

// Mock the AuthGuard before importing PaymentController
// This ensures the mock is in place before the controller tries to use it
jest.mock('../auth/auth.guard', () => {
  return {
    AuthGuard: jest.fn().mockImplementation(() => ({
      canActivate: jest.fn().mockReturnValue(true),
    })),
  };
}, { virtual: true }); // Add virtual: true to create a virtual mock

// Also need to mock the actual import path used in the controller
jest.mock('src/auth/auth.guard', () => {
  return {
    AuthGuard: jest.fn().mockImplementation(() => ({
      canActivate: jest.fn().mockReturnValue(true),
    })),
  };
}, { virtual: true }); // Virtual mock for the absolute path

// Create a mock of the PaymentService
const mockPaymentService = {
  addCard: jest.fn(),
  GetUserCards: jest.fn(),
  setDefaultCard: jest.fn(),
  deleteCreditCard: jest.fn(),
  processLoanRepayment: jest.fn(),
  recordCashPayment: jest.fn(),
};

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    service = module.get<PaymentService>(PaymentService);
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addCard', () => {
    it('should call the service to add a card', async () => {
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
      const expectedResult = { _id: 'payment123' };
      
      // Mock service response
      mockPaymentService.addCard.mockResolvedValue(expectedResult);
      
      // Execute
      const result = await controller.addCard(cardData);
      
      // Assert
      expect(service.addCard).toHaveBeenCalledWith(cardData);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors', async () => {
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
      
      // Mock service throwing an error
      const errorMessage = 'Failed to add card';
      mockPaymentService.addCard.mockRejectedValue(new BadRequestException(errorMessage));
      
      // Execute and assert
      await expect(controller.addCard(cardData))
        .rejects.toThrow(BadRequestException);
      expect(service.addCard).toHaveBeenCalledWith(cardData);
    });
  
    it('should handle incomplete card data', async () => {
      // Mock incomplete data (missing required fields)
      const incompleteCardData: Partial<CreatePaymentIdDto> = {
        costumerId: 'cus_123',
        paymentMethodId: 'pm_123',
        // Missing other required fields
      };
      
      // Since validation would happen at DTO level, we're testing
      // that the controller passes the data to the service as-is
      mockPaymentService.addCard.mockResolvedValue({ _id: 'payment123' });
      
      // Execute
      await controller.addCard(incompleteCardData as CreatePaymentIdDto);
      
      // Assert data was passed as-is
      expect(service.addCard).toHaveBeenCalledWith(incompleteCardData);
    });
  });

  describe('GetUserCards', () => {
    it('should return all cards for a user', async () => {
      // Mock data
      const customerId = 'cus_123';
      const expectedCards = [
        { _id: 'card1', last4: '4242' },
        { _id: 'card2', last4: '1234' }
      ];
      
      // Mock service response
      mockPaymentService.GetUserCards.mockResolvedValue(expectedCards);
      
      // Execute
      const result = await controller.GetUserCards(customerId);
      
      // Assert
      expect(service.GetUserCards).toHaveBeenCalledWith(customerId);
      expect(result).toEqual(expectedCards);
    });

    it('should handle empty customer ID', async () => {
      // Mock service response for empty customerId
      mockPaymentService.GetUserCards.mockResolvedValue([]);
      
      // Execute
      const result = await controller.GetUserCards('');
      
      // Assert
      expect(service.GetUserCards).toHaveBeenCalledWith('');
      expect(result).toEqual([]);
    });
  
    it('should handle service errors', async () => {
      // Mock service throwing an error
      mockPaymentService.GetUserCards.mockRejectedValue(new BadRequestException('Database error'));
      
      // Execute and assert
      await expect(controller.GetUserCards('cus_123'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('setDefaultCard', () => {
    // Reorder tests - run the success case first
    it('should set a card as default', async () => {
      // Mock data
      const customerId = 'cus_123';
      const paymentId = 'card123';
      const expectedResult = { _id: paymentId, isDefault: true };
      
      // Reset the mock first
      mockPaymentService.setDefaultCard.mockReset();
      // Now set up the specific behavior for this test
      mockPaymentService.setDefaultCard.mockResolvedValue(expectedResult);
      
      // Execute
      const result = await controller.setDefaultCard(customerId, paymentId);
      
      // Assert
      expect(service.setDefaultCard).toHaveBeenCalledWith(customerId, paymentId);
      expect(result).toEqual(expectedResult);
    });

    it('should handle setting default card with empty customerId', async () => {
      // Mock data
      const customerId = '';
      const paymentId = 'card123';
      
      // Reset the mock and set up for this specific test case
      mockPaymentService.setDefaultCard.mockReset();
      mockPaymentService.setDefaultCard.mockResolvedValue({ _id: paymentId, isDefault: true });
      
      // Execute
      await controller.setDefaultCard(customerId, paymentId);
      
      // Assert parameters were passed as-is
      expect(service.setDefaultCard).toHaveBeenCalledWith(customerId, paymentId);
    });

    it('should handle card not found', async () => {
      // Reset the mock first
      mockPaymentService.setDefaultCard.mockReset();
      // Mock service throwing not found error
      mockPaymentService.setDefaultCard.mockRejectedValue(
        new NotFoundException('Card not found')
      );
      
      // Execute and assert
      await expect(controller.setDefaultCard('cus_123', 'invalid_id'))
        .rejects.toThrow(NotFoundException);
      expect(service.setDefaultCard).toHaveBeenCalledWith('cus_123', 'invalid_id');
    });
  });

  describe('deleteCreditCard', () => {
    it('should delete a card', async () => {
      // Mock data
      const paymentId = 'card123';
      const expectedResult = { message: 'Payment method deleted successfully' };
      
      // Mock service response
      mockPaymentService.deleteCreditCard.mockResolvedValue(expectedResult);
      
      // Execute
      const result = await controller.deleteCreditCard(paymentId);
      
      // Assert
      expect(service.deleteCreditCard).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual(expectedResult);
    });

    it('should handle deleting a non-existent card', async () => {
      // Mock service throwing error for non-existent card
      mockPaymentService.deleteCreditCard.mockRejectedValue(
        new NotFoundException('Card not found')
      );
      
      // Execute and assert
      await expect(controller.deleteCreditCard('non_existent_id'))
        .rejects.toThrow(NotFoundException);
    });
  
    it('should handle deleting a default card', async () => {
      // Mock service throwing error for default card
      mockPaymentService.deleteCreditCard.mockRejectedValue(
        new BadRequestException('Cannot delete default card')
      );
      
      // Execute and assert
      await expect(controller.deleteCreditCard('default_card_id'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('processLoanRepayment', () => {
    // Reorder tests - run the success case first
    it('should process a loan repayment', async () => {
      // Mock data
      const repaymentDto: ProcessLoanRepaymentDto = {
        amount: 100,
        senderId: 'sender123',
        receiverId: 'receiver123',
        loanId: 'loan123',
        paymentMethodId: 'pm_123',
        customerId: 'cus_123'
      };
      const expectedResult = {
        payment: { _id: 'payment123' },
        transaction: { _id: 'transaction123' }
      };
      
      // Reset the mock first
      mockPaymentService.processLoanRepayment.mockReset();
      // Now set up the specific behavior for this test
      mockPaymentService.processLoanRepayment.mockResolvedValue(expectedResult);
      
      // Execute
      const result = await controller.processLoanRepayment(repaymentDto);
      
      // Assert
      expect(service.processLoanRepayment).toHaveBeenCalledWith(
        repaymentDto.amount,
        repaymentDto.senderId,
        repaymentDto.receiverId,
        repaymentDto.loanId,
        repaymentDto.paymentMethodId,
        repaymentDto.customerId
      );
      expect(result).toEqual(expectedResult);
    });

    it('should process payment with minimum amount allowed', async () => {
      // Mock data with minimum amount
      const repaymentDto: ProcessLoanRepaymentDto = {
        amount: 1, // Minimum amount
        senderId: 'sender123',
        receiverId: 'receiver123',
        loanId: 'loan123',
        paymentMethodId: 'pm_123',
        customerId: 'cus_123'
      };
      
      // Reset the mock and set up for this specific test case
      mockPaymentService.processLoanRepayment.mockReset();
      mockPaymentService.processLoanRepayment.mockResolvedValue({
        payment: { _id: 'payment123' },
        transaction: { _id: 'transaction123' }
      });
      
      // Execute
      await controller.processLoanRepayment(repaymentDto);
      
      // Assert minimum amount was passed to service
      expect(service.processLoanRepayment).toHaveBeenCalledWith(
        1,
        repaymentDto.senderId,
        repaymentDto.receiverId,
        repaymentDto.loanId,
        repaymentDto.paymentMethodId,
        repaymentDto.customerId
      );
    });

    it('should handle payment processing errors', async () => {
      // Mock data
      const repaymentDto: ProcessLoanRepaymentDto = {
        amount: 100,
        senderId: 'sender123',
        receiverId: 'receiver123',
        loanId: 'loan123',
        paymentMethodId: 'pm_123',
        customerId: 'cus_123'
      };
      
      // Reset the mock first
      mockPaymentService.processLoanRepayment.mockReset();
      // Mock service throwing an error
      mockPaymentService.processLoanRepayment.mockRejectedValue(
        new BadRequestException('Payment processing failed')
      );
      
      // Execute and assert
      await expect(controller.processLoanRepayment(repaymentDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('recordCashPayment', () => {
    it('should record a cash payment', async () => {
      // Mock data
      const cashPaymentDto: RecordCashPaymentDto = {
        amount: 100,
        senderId: 'sender123',
        receiverId: 'receiver123',
        loanId: 'loan123',
        meetingLocation: 'Coffee Shop',
        meetingDate: new Date()
      };
      const expectedResult = { _id: 'transaction123' };
      
      // Mock service response
      mockPaymentService.recordCashPayment.mockResolvedValue(expectedResult);
      
      // Execute
      const result = await controller.recordCashPayment(cashPaymentDto);
      
      // Assert
      expect(service.recordCashPayment).toHaveBeenCalledWith(
        cashPaymentDto.amount,
        cashPaymentDto.senderId,
        cashPaymentDto.receiverId,
        cashPaymentDto.loanId,
        cashPaymentDto.meetingLocation,
        cashPaymentDto.meetingDate
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle cash payment with minimal required fields', async () => {
      // Mock data with only required fields
      const minimalCashPaymentDto: RecordCashPaymentDto = {
        amount: 100,
        senderId: 'sender123',
        receiverId: 'receiver123',
        loanId: 'loan123',
        // Optional fields omitted
      };
      
      // Execute
      await controller.recordCashPayment(minimalCashPaymentDto);
      
      // Assert
      expect(service.recordCashPayment).toHaveBeenCalledWith(
        minimalCashPaymentDto.amount,
        minimalCashPaymentDto.senderId,
        minimalCashPaymentDto.receiverId,
        minimalCashPaymentDto.loanId,
        undefined, // meetingLocation
        undefined  // meetingDate
      );
    });
  
    it('should handle cash payment recording errors', async () => {
      // Mock service throwing an error
      mockPaymentService.recordCashPayment.mockRejectedValue(
        new BadRequestException('Invalid data')
      );
      
      // Execute and assert
      await expect(controller.recordCashPayment({
        amount: 100,
        senderId: 'sender123',
        receiverId: 'receiver123',
        loanId: 'loan123'
      })).rejects.toThrow(BadRequestException);
    });
  });
});
