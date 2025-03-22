import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TransactionStatus } from './schema/transaction.schema';

describe('TransactionService', () => {
  let service: TransactionService;
  let mockTicketModel;
  let mockTransactionModel;
  let mockAuthModel;
  let mockPaymentsModel;
  let mockConfigService;

  beforeEach(async () => {
    mockTicketModel = {
      findById: jest.fn(),
      updateOne: jest.fn(),
      find: jest.fn(), // Add missing find method
    };
    
    mockTransactionModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };
    
    mockAuthModel = {
      findById: jest.fn(),
    };
    
    mockPaymentsModel = {
      find: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getModelToken('Transaction'),
          useValue: mockTransactionModel,
        },
        {
          provide: getModelToken('Tickets'),
          useValue: mockTicketModel,
        },
        {
          provide: getModelToken('Payments'),
          useValue: mockPaymentsModel,
        },
        {
          provide: getModelToken('Auth'),
          useValue: mockAuthModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('payWithCash', () => {
    it('should process a cash payment successfully', async () => {
      // Create a valid ObjectId string
      const ticketId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: ticketId,
        loanee: userId,
        toString: () => userId,
      };
      mockTicketModel.findById.mockResolvedValue(mockTicket);
      
      const mockTransaction = {
        _id: new Types.ObjectId().toString(),
        ticketId: new Types.ObjectId(ticketId), // Now valid ObjectId
        paymentMethod: 'CASH',
        status: TransactionStatus.COMPLETED
      };
      mockTransactionModel.create.mockResolvedValue(mockTransaction);
      
      const result = await service.payWithCash(ticketId, userId);
      
      expect(mockTicketModel.findById).toHaveBeenCalledWith(ticketId);
      expect(mockTransactionModel.create).toHaveBeenCalledWith({
        ticketId: expect.any(Object),
        paymentMethod: 'CASH',
        status: TransactionStatus.COMPLETED
      });
      expect(mockTicketModel.updateOne).toHaveBeenCalledWith(
        { _id: mockTicket._id },
        {
          status: 'PAYED',
          paidAt: expect.any(Date)
        }
      );
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException when ticket is not found', async () => {
      mockTicketModel.findById.mockResolvedValue(null);
      
      await expect(
        service.payWithCash('nonexistent-ticket', 'user-id')
      ).rejects.toThrow(NotFoundException);
      expect(mockTicketModel.findById).toHaveBeenCalled();
    });

    it('should throw BadRequestException when user is not the loanee', async () => {
      const mockTicket = {
        _id: 'ticket-id',
        loanee: 'different-user-id',
        toString: () => 'different-user-id'
      };
      mockTicketModel.findById.mockResolvedValue(mockTicket);
      
      await expect(
        service.payWithCash('ticket-id', 'user-id')
      ).rejects.toThrow(BadRequestException);
      expect(mockTicketModel.findById).toHaveBeenCalled();
    });
  });

  describe('payWithCard', () => {
    it('should process a card payment successfully', async () => {
      // Create valid ObjectIds
      const ticketId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      const paymentMethod = 'CARD';
      const paymentMethodId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: ticketId,
        loanee: userId,
        toString: () => userId,
        status: 'PENDING'
      };
      mockTicketModel.findById.mockResolvedValue(mockTicket);
      
      const mockUser = {
        StripeCostumer: 'cus_123'
      };
      mockAuthModel.findById.mockResolvedValue(mockUser);
      
      const mockPaymentMethods = [
        {
          _id: paymentMethodId,
          isDefault: true
        }
      ];
      mockPaymentsModel.find.mockResolvedValue(mockPaymentMethods);
      
      const mockTransaction = {
        _id: new Types.ObjectId().toString(),
        ticketId: new Types.ObjectId(ticketId), // Now valid ObjectId
        paymentMethod,
        paymentId: paymentMethodId,
        status: TransactionStatus.COMPLETED
      };
      mockTransactionModel.create.mockResolvedValue(mockTransaction);
      
      const result = await service.payWithCard(ticketId, userId, paymentMethod);
      
      expect(mockTicketModel.findById).toHaveBeenCalledWith(ticketId);
      expect(mockAuthModel.findById).toHaveBeenCalledWith(userId);
      expect(mockPaymentsModel.find).toHaveBeenCalledWith({
        stripeCustomerId: mockUser.StripeCostumer
      });
      expect(mockTransactionModel.create).toHaveBeenCalledWith({
        ticketId: expect.any(Object),
        paymentMethod,
        paymentId: paymentMethodId,
        status: TransactionStatus.COMPLETED
      });
      expect(mockTicketModel.updateOne).toHaveBeenCalledWith(
        { _id: mockTicket._id },
        {
          status: 'PAYED',
          paidAt: expect.any(Date),
          paymentId: paymentMethodId
        }
      );
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException when ticket is not found', async () => {
      mockTicketModel.findById.mockResolvedValue(null);
      
      await expect(
        service.payWithCard('nonexistent-ticket', 'user-id', 'CARD')
      ).rejects.toThrow(NotFoundException);
      expect(mockTicketModel.findById).toHaveBeenCalled();
    });

    it('should throw BadRequestException when user is not the loanee', async () => {
      const mockTicket = {
        _id: 'ticket-id',
        loanee: 'different-user-id',
        toString: () => 'different-user-id'
      };
      mockTicketModel.findById.mockResolvedValue(mockTicket);
      
      await expect(
        service.payWithCard('ticket-id', 'user-id', 'CARD')
      ).rejects.toThrow(BadRequestException);
      expect(mockTicketModel.findById).toHaveBeenCalled();
    });

    it('should throw BadRequestException when ticket is already paid', async () => {
      const mockTicket = {
        _id: 'ticket-id',
        loanee: 'user-id',
        toString: () => 'user-id',
        status: 'PAYED'
      };
      mockTicketModel.findById.mockResolvedValue(mockTicket);
      
      await expect(
        service.payWithCard('ticket-id', 'user-id', 'CARD')
      ).rejects.toThrow(BadRequestException);
      expect(mockTicketModel.findById).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no payment methods found', async () => {
      // Create valid ObjectIds
      const ticketId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      
      const mockTicket = {
        _id: ticketId,
        loanee: userId,
        toString: () => userId,
        status: 'PENDING'
      };
      mockTicketModel.findById.mockResolvedValue(mockTicket);
      
      const mockUser = {
        StripeCostumer: 'cus_123'
      };
      mockAuthModel.findById.mockResolvedValue(mockUser);
      
      mockPaymentsModel.find.mockResolvedValue([]);
      
      mockTransactionModel.create.mockResolvedValue({});
      
      await expect(
        service.payWithCard(ticketId, userId, 'CARD')
      ).rejects.toThrow(BadRequestException);
      
      expect(mockTransactionModel.create).toHaveBeenCalledWith({
        ticketId: expect.any(Object),
        paymentMethod: 'CARD',
        status: TransactionStatus.FAILED,
        errorMessage: 'No payment methods found for this user'
      });
    });

    it('should throw BadRequestException when no default payment method found', async () => {
      const mockTicket = {
        _id: 'ticket-id',
        loanee: 'user-id',
        toString: () => 'user-id',
        status: 'PENDING'
      };
      mockTicketModel.findById.mockResolvedValue(mockTicket);
      
      const mockUser = {
        StripeCostumer: 'cus_123'
      };
      mockAuthModel.findById.mockResolvedValue(mockUser);
      
      const mockPaymentMethods = [
        {
          _id: 'payment-id',
          isDefault: false
        }
      ];
      mockPaymentsModel.find.mockResolvedValue(mockPaymentMethods);
      
      await expect(
        service.payWithCard('ticket-id', 'user-id', 'CARD')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTransactionsByTicketId', () => {
    it('should return transactions for a ticket ID', async () => {
      const ticketId = 'ticket-123';
      const mockTransactions = [
        { _id: 'trans-1', ticketId },
        { _id: 'trans-2', ticketId }
      ];
      
      mockTransactionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockTransactions)
        })
      });
      
      const result = await service.getTransactionsByTicketId(ticketId);
      
      expect(mockTransactionModel.find).toHaveBeenCalledWith({ ticketId });
      expect(result).toEqual(mockTransactions);
    });
  });

  describe('getTransactionById', () => {
    it('should return a transaction by ID', async () => {
      const transactionId = 'trans-123';
      const mockTransaction = { _id: transactionId };
      
      mockTransactionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTransaction)
      });
      
      const result = await service.getTransactionById(transactionId);
      
      expect(mockTransactionModel.findById).toHaveBeenCalledWith(transactionId);
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException when transaction is not found', async () => {
      mockTransactionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });
      
      await expect(
        service.getTransactionById('nonexistent-id')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDetailedTransactionsByUser', () => {
    it('should return detailed transactions for a user', async () => {
      const userId = new Types.ObjectId().toString();
      const ticketIds = [new Types.ObjectId(), new Types.ObjectId()];
      
      const mockTickets = [
        {
          _id: ticketIds[0],
          loanee: new Types.ObjectId(userId),
          loaner: new Types.ObjectId(),
          amount: 100,
          Type: 'LOAN',
          Place: 'Store',
          dueDate: new Date(),
          status: 'PAYED',
          loaneeName: 'John',
          loanerName: 'Jane'
        },
        {
          _id: ticketIds[1],
          loanee: new Types.ObjectId(),
          loaner: new Types.ObjectId(userId),
          amount: 200,
          Type: 'DEBT',
          Place: 'Restaurant',
          dueDate: new Date(),
          status: 'PAYED',
          loaneeName: 'Alice',
          loanerName: 'Bob'
        }
      ];

      const mockTransactions = [
        {
          _id: new Types.ObjectId(),
          ticketId: ticketIds[0],
          status: TransactionStatus.COMPLETED,
          paymentMethod: 'CASH'
        },
        {
          _id: new Types.ObjectId(),
          ticketId: ticketIds[1],
          status: TransactionStatus.COMPLETED,
          paymentMethod: 'CARD'
        }
      ];

      mockTicketModel.find.mockResolvedValue(mockTickets);
      
      mockTransactionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockTransactions)
        })
      });

      const result = await service.getDetailedTransactionsByUser(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('transaction');
      expect(result[0]).toHaveProperty('ticket');
      expect(result[0]).toHaveProperty('counterparty');
      expect(result[0]).toHaveProperty('userRole');
      expect(result[0]).toHaveProperty('direction');
    });

    it('should return empty array when user has no tickets', async () => {
      const userId = new Types.ObjectId().toString();
      mockTicketModel.find.mockResolvedValue([]);

      const result = await service.getDetailedTransactionsByUser(userId);
      expect(result).toEqual([]);
    });

    it('should handle invalid user ID', async () => {
      await expect(service.getDetailedTransactionsByUser('invalid-id'))
        .rejects.toThrow();
    });
  });
});
