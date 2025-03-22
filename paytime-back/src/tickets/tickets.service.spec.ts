import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TicketsService } from './tickets.service';
import { getQueueToken } from '@nestjs/bull';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TicketsGateway } from './tickets.gateway';
import { TransactionService } from '../transaction/transaction.service';
import { SchedulerHelper } from '../Helpers/scheduler.helper';

// Create mock for the SchedulerHelper if it's not a class you can easily mock through DI
jest.mock('../Helpers/scheduler.helper', () => ({
  SchedulerHelper: {
    cleanupQueue: jest.fn().mockResolvedValue(null),
    scheduleJob: jest.fn().mockResolvedValue(null),
  },
}));

describe('TicketsService', () => {
  let service: TicketsService;
  let mockTicketModel;
  let mockAuthModel;
  let mockPaymentModel;
  let mockTicketsQueue;
  let mockTicketsGateway;
  let mockTransactionService;

  const mockTicket = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    amount: 100,
    loanee: new Types.ObjectId('507f1f77bcf86cd799439012'),
    loaneeName: 'John Doe',
    loaner: new Types.ObjectId('507f1f77bcf86cd799439013'),
    loanerName: 'Jane Smith',
    status: 'PENDING',
    Type: 'MANUAL',
    Place: 'Coffee Shop',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockReturnThis(),
    // Add missing properties required by Tickets interface
    paymentId: null,
    paidAt: null
  };

  const mockUser = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    Username: 'John Doe',
    StripeCostumer: 'cus_123456',
    Friend_list: [
      { 
        _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
        Username: 'Jane Smith' 
      }
    ]
  };
  
  const mockFriend = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
    Username: 'Jane Smith',
    StripeCostumer: 'cus_654321'
  };

  const mockPaymentMethod = [
    { stripeCustomerId: 'cus_123456', paymentMethodId: 'pm_123' }
  ];

  beforeEach(async () => {
    // Reset all mocks before each test to avoid bleeding state
    jest.clearAllMocks();
    
    // Create a proper constructor function for the mongoose model
    mockTicketModel = function() {
      return {
        ...mockTicket,
        save: jest.fn().mockResolvedValue(mockTicket)
      };
    };
    
    // Add static methods to the model
    mockTicketModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockTicket])
      })
    });
    
    mockTicketModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockTicket)
    });
    
    mockTicketModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockTicket)
    });

    mockAuthModel = {
      findById: jest.fn(),
    };

    mockPaymentModel = {
      find: jest.fn(),
    };

    mockTicketsQueue = {
      add: jest.fn().mockResolvedValue(null),
    };

    mockTicketsGateway = {
      broadcastTicketStatusUpdate: jest.fn(),
    };

    mockTransactionService = {
      payWithCard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: getModelToken('Tickets'),
          useValue: mockTicketModel,
        },
        {
          provide: getModelToken('Auth'),
          useValue: mockAuthModel,
        },
        {
          provide: getModelToken('Payments'),
          useValue: mockPaymentModel,
        },
        {
          provide: getQueueToken('tickets'),
          useValue: mockTicketsQueue,
        },
        {
          provide: TicketsGateway,
          useValue: mockTicketsGateway,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize the queue and reschedule pending tickets', async () => {
      // Spy on the rescheduleAllPendingTickets method
      jest.spyOn(service, 'rescheduleAllPendingTickets').mockResolvedValue();
      
      await service.onModuleInit();
      
      expect(SchedulerHelper.cleanupQueue).toHaveBeenCalledWith(mockTicketsQueue);
      expect(mockTicketsQueue.add).toHaveBeenCalledWith(
        'check-overdue-tickets',
        {},
        expect.objectContaining({
          repeat: { every: 60 * 60 * 1000 }
        })
      );
      expect(service.rescheduleAllPendingTickets).toHaveBeenCalled();
    });
  });

  describe('createTicket', () => {
    const createTicketDto = {
      amount: 100,
      loaner: '507f1f77bcf86cd799439013',
      Type: 'MANUAL',
      Place: 'Coffee Shop',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      // Add missing required properties
      title: 'Test Ticket',
      description: 'This is a test ticket'
    };

    it('should successfully create a ticket with valid data', async () => {
      mockAuthModel.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockFriend);
      
      mockPaymentModel.find.mockResolvedValue(mockPaymentMethod);
      
      mockTicket.save.mockResolvedValue(mockTicket);
      
      const result = await service.createTicket('507f1f77bcf86cd799439012', createTicketDto);
      
      expect(result).toEqual(mockTicket);
      expect(SchedulerHelper.scheduleJob).toHaveBeenCalledWith(
        mockTicketsQueue,
        'process-ticket',
        { ticketId: mockTicket._id.toString() },
        mockTicket.dueDate
      );
    });

    it('should throw BadRequestException for invalid user ID', async () => {
      await expect(service.createTicket('invalid-id', createTicketDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if loaner is not in friend list', async () => {
      mockAuthModel.findById.mockResolvedValueOnce({
        ...mockUser,
        Friend_list: []
      });

      await expect(service.createTicket('507f1f77bcf86cd799439012', createTicketDto))
        .rejects.toThrow(BadRequestException);
    });
    
    it('should throw BadRequestException for AUTO_CARD type without payment methods', async () => {
      mockAuthModel.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockFriend);
      
      mockPaymentModel.find.mockResolvedValue([]);
      
      await expect(service.createTicket('507f1f77bcf86cd799439012', {
        ...createTicketDto,
        Type: 'AUTO_CARD'
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when loaner ID is missing', async () => {
      const invalidDto = { 
        ...createTicketDto,
        loaner: null 
      };
      
      await expect(service.createTicket('507f1f77bcf86cd799439012', invalidDto))
        .rejects.toThrow(BadRequestException);
      expect(mockAuthModel.findById).not.toHaveBeenCalled();
    });
    
    it('should throw BadRequestException when loaner is not found', async () => {
      mockAuthModel.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      
      await expect(service.createTicket('507f1f77bcf86cd799439012', createTicketDto))
        .rejects.toThrow(BadRequestException);
    });
    
    it('should use default due date when not provided', async () => {
      mockAuthModel.findById
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockFriend);
      
      mockPaymentModel.find.mockResolvedValue(mockPaymentMethod);
      
      // Reset the model for this test to ensure we can track calls
      const originalModelFunc = mockTicketModel;
      
      // Create a mock with a spy we can track
      const constructorSpy = jest.fn().mockImplementation(function() {
        return {
          ...mockTicket,
          save: jest.fn().mockResolvedValue(mockTicket)
        };
      });
      
      // Replace the model used by the service
      service['ticketModel'] = Object.assign(constructorSpy, mockTicketModel);
      
      mockTicket.save.mockResolvedValue(mockTicket);
      
      const dtoBefore = { ...createTicketDto };
      delete dtoBefore.dueDate;
      
      await service.createTicket('507f1f77bcf86cd799439012', dtoBefore);
      
      // Check that the constructor was called
      expect(constructorSpy).toHaveBeenCalled();
      
      // Verify SchedulerHelper.scheduleJob was called with expected data
      expect(SchedulerHelper.scheduleJob).toHaveBeenCalledWith(
        mockTicketsQueue,
        'process-ticket',
        expect.any(Object),
        expect.any(Date)
      );
      
      // Restore the original model
      service['ticketModel'] = originalModelFunc;
    });
  });

  describe('getTicketsByUser', () => {
    it('should return tickets for a valid user ID', async () => {
      const mockTickets = [mockTicket];
      mockTicketModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockTickets)
        })
      });
      
      const result = await service.getTicketsByUser('507f1f77bcf86cd799439012');
      
      expect(result).toEqual(mockTickets);
      expect(mockTicketModel.find).toHaveBeenCalledWith({
        $or: [
          { loaner: new Types.ObjectId('507f1f77bcf86cd799439012') },
          { loanee: new Types.ObjectId('507f1f77bcf86cd799439012') }
        ]
      });
    });

    it('should throw BadRequestException for invalid user ID', async () => {
      await expect(service.getTicketsByUser('invalid-id'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getTicketById', () => {
    it('should return a ticket for a valid ID', async () => {
      mockTicketModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTicket)
      });
      
      const result = await service.getTicketById('507f1f77bcf86cd799439011');
      
      expect(result).toEqual(mockTicket);
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockTicketModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });
      
      await expect(service.getTicketById('507f1f77bcf86cd799439011'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid ticket ID', async () => {
      await expect(service.getTicketById('invalid-id'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('processOverdueTicket', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getTicketById').mockResolvedValue({
        ...mockTicket,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day overdue
      });
    });

    it('should mark ticket as OVERDUE if its due date has passed', async () => {
      mockTicketModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockTicket,
          status: 'OVERDUE'
        })
      });
      
      await service.processOverdueTicket('507f1f77bcf86cd799439011');
      
      expect(mockTicketsGateway.broadcastTicketStatusUpdate).toHaveBeenCalled();
      expect(mockTicketModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ status: 'OVERDUE' }),
        { new: true }
      );
    });

    it('should process AUTO_CARD payment if ticket type is AUTO_CARD', async () => {
      jest.spyOn(service, 'getTicketById').mockResolvedValue({
        ...mockTicket,
        Type: 'AUTO_CARD',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day overdue
      });
      
      mockTransactionService.payWithCard.mockResolvedValue({
        paymentId: 'payment_123'
      });
      
      mockTicketModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockTicket,
          status: 'PAID'
        })
      });
      
      await service.processOverdueTicket('507f1f77bcf86cd799439011');
      
      expect(mockTransactionService.payWithCard).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        mockTicket.loanee.toString(),
        'AUTO_CARD'
      );
      
      expect(mockTicketModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ 
          status: 'PAID',
          paymentId: 'payment_123'
        }),
        { new: true }
      );
    });

    it('should ignore tickets that are not pending', async () => {
      const paidTicket = {
        ...mockTicket,
        status: 'PAID',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
      };
      
      jest.spyOn(service, 'getTicketById').mockResolvedValue(paidTicket);
      
      await service.processOverdueTicket('507f1f77bcf86cd799439011');
      
      // Should not update ticket or call broadcastTicketStatusUpdate
      expect(mockTicketModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(mockTicketsGateway.broadcastTicketStatusUpdate).not.toHaveBeenCalled();
    });
    
    it('should ignore tickets that are not yet overdue', async () => {
      const futureTicket = {
        ...mockTicket,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day in the future
      };
      
      jest.spyOn(service, 'getTicketById').mockResolvedValue(futureTicket);
      
      await service.processOverdueTicket('507f1f77bcf86cd799439011');
      
      // Should not update ticket
      expect(mockTicketModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
    
    it('should handle failed auto-card payment and mark as overdue', async () => {
      jest.spyOn(service, 'getTicketById').mockResolvedValue({
        ...mockTicket,
        Type: 'AUTO_CARD',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day overdue
      });
      
      // Make the payment fail
      mockTransactionService.payWithCard.mockRejectedValue(new Error('Payment failed'));
      
      mockTicketModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockTicket,
          status: 'OVERDUE'
        })
      });
      
      await service.processOverdueTicket('507f1f77bcf86cd799439011');
      
      // Should mark as OVERDUE when AUTO_CARD payment fails
      expect(mockTicketModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ status: 'OVERDUE' }),
        { new: true }
      );
    });
  });

  describe('checkForOverdueTickets', () => {
    it('should check and process overdue tickets', async () => {
      const overdueTickets = [
        { ...mockTicket, _id: new Types.ObjectId('507f1f77bcf86cd799439011') },
        { ...mockTicket, _id: new Types.ObjectId('507f1f77bcf86cd799439014') }
      ];
      
      mockTicketModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(overdueTickets)
      });
      
      jest.spyOn(service, 'processOverdueTicket').mockResolvedValue(undefined);
      
      const result = await service.checkForOverdueTickets();
      
      expect(mockTicketModel.find).toHaveBeenCalledWith({
        status: 'PENDING',
        dueDate: { $lt: expect.any(Date) }
      });
      
      expect(service.processOverdueTicket).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ processed: 2 });
    });
  });

  describe('rescheduleAllPendingTickets', () => {
    beforeEach(() => {
      // Clear specific mocks to avoid interference between tests
      jest.clearAllMocks();
    });
    
    it('should reschedule all pending tickets', async () => {
      const pendingTickets = [
        { ...mockTicket, _id: new Types.ObjectId('507f1f77bcf86cd799439011') },
        { ...mockTicket, _id: new Types.ObjectId('507f1f77bcf86cd799439014') }
      ];
      
      mockTicketModel.find.mockResolvedValue(pendingTickets);
      
      await service.rescheduleAllPendingTickets();
      
      expect(mockTicketModel.find).toHaveBeenCalledWith({ status: 'PENDING' });
      // Check it was called exactly once per pending ticket
      expect(SchedulerHelper.scheduleJob).toHaveBeenCalledTimes(pendingTickets.length);
    });
    
    it('should handle tickets without due dates', async () => {
      const pendingTickets = [
        { ...mockTicket, _id: new Types.ObjectId('507f1f77bcf86cd799439011') },
        { ...mockTicket, _id: new Types.ObjectId('507f1f77bcf86cd799439014'), dueDate: null }
      ];
      
      mockTicketModel.find.mockResolvedValue(pendingTickets);
      
      await service.rescheduleAllPendingTickets();
      
      // Should only schedule the ticket with a due date (1 out of 2)
      expect(SchedulerHelper.scheduleJob).toHaveBeenCalledTimes(1);
    });
    
    it('should handle errors during scheduling', async () => {
      const pendingTickets = [
        { ...mockTicket, _id: new Types.ObjectId('507f1f77bcf86cd799439011') }
      ];
      
      mockTicketModel.find.mockResolvedValue(pendingTickets);
      
      // Fix the mock rejected value approach
      const originalScheduleJob = SchedulerHelper.scheduleJob;
      SchedulerHelper.scheduleJob = jest.fn().mockImplementation(() => {
        throw new Error('Scheduling failed');
      });
      
      // Should not throw error
      await expect(service.rescheduleAllPendingTickets()).resolves.not.toThrow();
      
      // Restore original function
      SchedulerHelper.scheduleJob = originalScheduleJob;
    });
  });
});
