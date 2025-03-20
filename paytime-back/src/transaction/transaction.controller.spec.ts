import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { BadRequestException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';

describe('TransactionController', () => {
  let controller: TransactionController;
  let service: TransactionService;

  const mockTransactionService = {
    createTransaction: jest.fn(),
    createManualTransaction: jest.fn(),
    scheduleAutomaticTransaction: jest.fn(),
    createCashTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
    service = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should call service.createTransaction with correct parameters', async () => {
      const createTransactionDto = {} as CreateTransactionDto;
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      const expectedResult = { id: 'transaction-id' };
      
      mockTransactionService.createTransaction.mockResolvedValue(expectedResult);
      
      const result = await controller.createTransaction(createTransactionDto, mockRequest);
      
      expect(service.createTransaction).toHaveBeenCalledWith(createTransactionDto, userId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createManualTransaction', () => {
    it('should call service.createManualTransaction with correct parameters', async () => {
      const transactionData = {
        debtorId: 'debtor-id',
        amount: 100,
        paymentId: 'payment-id',
        description: 'Test transaction',
      };
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      const expectedResult = { id: 'transaction-id' };
      
      mockTransactionService.createManualTransaction.mockResolvedValue(expectedResult);
      
      const result = await controller.createManualTransaction(transactionData, mockRequest);
      
      expect(service.createManualTransaction).toHaveBeenCalledWith(
        userId,
        transactionData.debtorId,
        transactionData.amount,
        transactionData.paymentId,
        transactionData.description,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when required fields are missing', async () => {
      const transactionData = {
        debtorId: 'debtor-id',
        amount: null,
        paymentId: 'payment-id',
      };
      const mockRequest = { user: { id: 'user-id' } };
      
      await expect(controller.createManualTransaction(transactionData, mockRequest))
        .rejects.toThrow(BadRequestException);
      
      expect(service.createManualTransaction).not.toHaveBeenCalled();
    });
  });

  describe('scheduleAutomaticTransaction', () => {
    it('should call service.scheduleAutomaticTransaction with correct parameters', async () => {
      const scheduledDate = new Date('2023-12-31');
      const scheduleData = {
        debtorId: 'debtor-id',
        amount: 100,
        paymentId: 'payment-id',
        scheduledDate: scheduledDate.toISOString(),
        description: 'Test transaction',
      };
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      const expectedResult = { id: 'transaction-id' };
      
      mockTransactionService.scheduleAutomaticTransaction.mockResolvedValue(expectedResult);
      
      const result = await controller.scheduleAutomaticTransaction(scheduleData, mockRequest);
      
      expect(service.scheduleAutomaticTransaction).toHaveBeenCalledWith(
        userId,
        scheduleData.debtorId,
        scheduleData.amount,
        scheduleData.paymentId,
        expect.any(Date),
        scheduleData.description,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when required fields are missing', async () => {
      const scheduleData = {
        debtorId: 'debtor-id',
        amount: 100,
        paymentId: null,
        scheduledDate: new Date().toISOString(),
      };
      const mockRequest = { user: { id: 'user-id' } };
      
      await expect(controller.scheduleAutomaticTransaction(scheduleData, mockRequest))
        .rejects.toThrow(BadRequestException);
      
      expect(service.scheduleAutomaticTransaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when scheduledDate is invalid', async () => {
      const scheduleData = {
        debtorId: 'debtor-id',
        amount: 100,
        paymentId: 'payment-id',
        scheduledDate: 'invalid-date',
      };
      const mockRequest = { user: { id: 'user-id' } };
      
      await expect(controller.scheduleAutomaticTransaction(scheduleData, mockRequest))
        .rejects.toThrow(BadRequestException);
      
      expect(service.scheduleAutomaticTransaction).not.toHaveBeenCalled();
    });
  });

  describe('createCashTransaction', () => {
    it('should call service.createCashTransaction with correct parameters', async () => {
      const transactionData = {
        debtorId: 'debtor-id',
        amount: 100,
        description: 'Test transaction',
      };
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      const expectedResult = { id: 'transaction-id' };
      
      mockTransactionService.createCashTransaction.mockResolvedValue(expectedResult);
      
      const result = await controller.createCashTransaction(transactionData, mockRequest);
      
      expect(service.createCashTransaction).toHaveBeenCalledWith(
        userId,
        transactionData.debtorId,
        transactionData.amount,
        transactionData.description,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when required fields are missing', async () => {
      const transactionData = {
        debtorId: 'debtor-id',
        amount: null,
      };
      const mockRequest = { user: { id: 'user-id' } };
      
      await expect(controller.createCashTransaction(transactionData, mockRequest))
        .rejects.toThrow(BadRequestException);
      
      expect(service.createCashTransaction).not.toHaveBeenCalled();
    });
  });
});
