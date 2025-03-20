import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';

describe('TransactionService', () => {
  let service: TransactionService;
  let repository: Repository<Transaction>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    repository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should create and return a transaction', async () => {
      const createTransactionDto = {
        creditorId: 'creditor-id',
        debtorId: 'debtor-id',
        amount: 100,
        paymentMethod: 'CARD',
      };
      const userId = 'user-id';
      const createdTransaction = { id: 'transaction-id', ...createTransactionDto };
      
      mockRepository.create.mockReturnValue(createdTransaction);
      mockRepository.save.mockResolvedValue(createdTransaction);
      
      const result = await service.createTransaction(createTransactionDto, userId);
      
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(createdTransaction);
    });
  });

  describe('createManualTransaction', () => {
    it('should create and return a manual transaction', async () => {
      const creditorId = 'creditor-id';
      const debtorId = 'debtor-id';
      const amount = 100;
      const paymentId = 'payment-id';
      const description = 'Test transaction';
      
      const transaction = {
        id: 'transaction-id',
        creditorId,
        debtorId,
        amount,
        paymentMethod: 'MANUAL',
        paymentId,
        description,
      };
      
      mockRepository.create.mockReturnValue(transaction);
      mockRepository.save.mockResolvedValue(transaction);
      
      const result = await service.createManualTransaction(
        creditorId, debtorId, amount, paymentId, description
      );
      
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(transaction);
    });
  });

  describe('scheduleAutomaticTransaction', () => {
    it('should schedule an automatic transaction', async () => {
      const creditorId = 'creditor-id';
      const debtorId = 'debtor-id';
      const amount = 100;
      const paymentId = 'payment-id';
      const scheduledDate = new Date('2023-12-31');
      const description = 'Test transaction';
      
      const transaction = {
        id: 'transaction-id',
        creditorId,
        debtorId,
        amount,
        paymentMethod: 'AUTOMATIC',
        paymentId,
        scheduledDate,
        description,
        status: 'PENDING',
      };
      
      mockRepository.create.mockReturnValue(transaction);
      mockRepository.save.mockResolvedValue(transaction);
      
      const result = await service.scheduleAutomaticTransaction(
        creditorId, debtorId, amount, paymentId, scheduledDate, description
      );
      
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(transaction);
    });
  });

  describe('createCashTransaction', () => {
    it('should create and return a cash transaction', async () => {
      const creditorId = 'creditor-id';
      const debtorId = 'debtor-id';
      const amount = 100;
      const description = 'Test transaction';
      
      const transaction = {
        id: 'transaction-id',
        creditorId,
        debtorId,
        amount,
        paymentMethod: 'CASH',
        description,
        status: 'COMPLETED',
      };
      
      mockRepository.create.mockReturnValue(transaction);
      mockRepository.save.mockResolvedValue(transaction);
      
      const result = await service.createCashTransaction(
        creditorId, debtorId, amount, description
      );
      
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(transaction);
    });
  });
});
