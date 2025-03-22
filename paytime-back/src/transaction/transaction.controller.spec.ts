import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';

describe('TransactionController', () => {
  let controller: TransactionController;
  let service: TransactionService;

  const mockTransactionService = {
    payWithCash: jest.fn(),
    payWithCard: jest.fn(),
    getTransactionsByTicketId: jest.fn(),
    getTransactionById: jest.fn(),
    getDetailedTransactionsByUser: jest.fn()
  };

  const mockAuthGuard = {
    canActivate: jest.fn(() => true)
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
        {
          provide: AuthGuard,
          useValue: mockAuthGuard
        }
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue(mockAuthGuard)
    .compile();

    controller = module.get<TransactionController>(TransactionController);
    service = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('payCash', () => {
    it('should call service.payWithCash with correct parameters', async () => {
      const ticketId = 'valid-ticket-id';
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      const mockTransaction = { id: 'transaction-id' };
      
      mockTransactionService.payWithCash.mockResolvedValue(mockTransaction);
      
      const result = await controller.payCash(ticketId, mockRequest);
      
      expect(service.payWithCash).toHaveBeenCalledWith(ticketId, userId);
      expect(result).toEqual(mockTransaction);
    });

    it('should handle invalid ticket ID', async () => {
      const ticketId = 'invalid-id';
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      
      mockTransactionService.payWithCash.mockRejectedValue(new BadRequestException('Invalid ticket ID'));
      
      await expect(controller.payCash(ticketId, mockRequest))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle unauthorized user', async () => {
      const ticketId = 'valid-ticket-id';
      const userId = 'unauthorized-user';
      const mockRequest = { user: { id: userId } };
      
      mockTransactionService.payWithCash.mockRejectedValue(
        new BadRequestException('Only the loanee can make a payment')
      );
      
      await expect(controller.payCash(ticketId, mockRequest))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('payCard', () => {
    it('should call service.payWithCard with correct parameters', async () => {
      const ticketId = 'valid-ticket-id';
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      const mockTransaction = { id: 'transaction-id' };
      
      mockTransactionService.payWithCard.mockResolvedValue(mockTransaction);
      
      const result = await controller.payCard(ticketId, mockRequest);
      
      expect(service.payWithCard).toHaveBeenCalledWith(ticketId, userId, 'MANUAL_CARD');
      expect(result).toEqual(mockTransaction);
    });

    it('should handle payment method errors', async () => {
      const ticketId = 'valid-ticket-id';
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      
      mockTransactionService.payWithCard.mockRejectedValue(
        new BadRequestException('No payment methods found for this user')
      );
      
      await expect(controller.payCard(ticketId, mockRequest))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle already paid ticket', async () => {
      const ticketId = 'paid-ticket-id';
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      
      mockTransactionService.payWithCard.mockRejectedValue(
        new BadRequestException('Ticket already payed')
      );
      
      await expect(controller.payCard(ticketId, mockRequest))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getTransactionsByTicket', () => {
    it('should call service.getTransactionsByTicketId with correct parameters', async () => {
      const ticketId = 'valid-ticket-id';
      const mockTransactions = [{ id: 'transaction-1' }, { id: 'transaction-2' }];
      
      mockTransactionService.getTransactionsByTicketId.mockResolvedValue(mockTransactions);
      
      const result = await controller.getTransactionsByTicket(ticketId);
      
      expect(service.getTransactionsByTicketId).toHaveBeenCalledWith(ticketId);
      expect(result).toEqual(mockTransactions);
    });

    it('should handle empty transaction list', async () => {
      const ticketId = 'valid-ticket-id';
      mockTransactionService.getTransactionsByTicketId.mockResolvedValue([]);
      
      const result = await controller.getTransactionsByTicket(ticketId);
      
      expect(result).toEqual([]);
    });

    it('should handle invalid ticket ID format', async () => {
      const ticketId = 'invalid-id';
      mockTransactionService.getTransactionsByTicketId.mockRejectedValue(
        new BadRequestException('Invalid ticket ID format')
      );
      
      await expect(controller.getTransactionsByTicket(ticketId))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getTransaction', () => {
    it('should call service.getTransactionById with correct parameters', async () => {
      const transactionId = 'valid-transaction-id';
      const mockTransaction = { id: transactionId };
      
      mockTransactionService.getTransactionById.mockResolvedValue(mockTransaction);
      
      const result = await controller.getTransaction(transactionId);
      
      expect(service.getTransactionById).toHaveBeenCalledWith(transactionId);
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('getTransactions', () => {
    it('should return detailed transactions for user', async () => {
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };
      const mockDetailedTransactions = [
        {
          transaction: { _id: 'trans-1', status: 'COMPLETED' },
          ticket: { _id: 'ticket-1', amount: 100 },
          counterparty: { id: 'other-user-1', name: 'John' },
          userRole: 'loaner',
          direction: 'outgoing'
        },
        {
          transaction: { _id: 'trans-2', status: 'COMPLETED' },
          ticket: { _id: 'ticket-2', amount: 200 },
          counterparty: { id: 'other-user-2', name: 'Jane' },
          userRole: 'loanee',
          direction: 'incoming'
        }
      ];

      mockTransactionService.getDetailedTransactionsByUser = jest.fn()
        .mockResolvedValue(mockDetailedTransactions);

      const result = await controller.getTransactions(mockRequest);

      expect(mockTransactionService.getDetailedTransactionsByUser)
        .toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockDetailedTransactions);
    });

    it('should handle empty transaction history', async () => {
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };

      mockTransactionService.getDetailedTransactionsByUser = jest.fn()
        .mockResolvedValue([]);

      const result = await controller.getTransactions(mockRequest);

      expect(mockTransactionService.getDetailedTransactionsByUser)
        .toHaveBeenCalledWith(userId);
      expect(result).toEqual([]);
    });

    it('should handle service errors', async () => {
      const userId = 'user-id';
      const mockRequest = { user: { id: userId } };

      mockTransactionService.getDetailedTransactionsByUser = jest.fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(controller.getTransactions(mockRequest))
        .rejects.toThrow('Database error');
    });
  });
});
