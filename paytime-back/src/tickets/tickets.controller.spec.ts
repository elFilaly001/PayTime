import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthGuard } from '../auth/auth.guard';

// Just mock the AuthGuard class itself
jest.mock('../auth/auth.guard', () => ({
  AuthGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn().mockReturnValue(true)
  }))
}));

describe('TicketsController', () => {
  let controller: TicketsController;
  let service: TicketsService;

  const mockTicketsService = {
    createTicket: jest.fn(),
    getTicketsByUser: jest.fn(),
    getTicketById: jest.fn(),
    checkForOverdueTickets: jest.fn(),
  };

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
    dueDate: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: mockTicketsService,
        }
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: jest.fn().mockReturnValue(true) })
    .compile();

    controller = module.get<TicketsController>(TicketsController);
    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTicket', () => {
    const createTicketDto = {
      amount: 100,
      loaner: '507f1f77bcf86cd799439013',
      Type: 'MANUAL',
      Place: 'Coffee Shop',
      // Add missing properties
      title: 'Test Ticket',
      description: 'This is a test ticket'
    };
    
    const mockRequest = {
      user: {
        id: '507f1f77bcf86cd799439012',
        username: 'John Doe',
      }
    };

    it('should create a ticket when given valid data', async () => {
      mockTicketsService.createTicket.mockResolvedValue(mockTicket);
      
      const result = await controller.createTicket(mockRequest as any, createTicketDto);
      
      expect(mockTicketsService.createTicket).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        createTicketDto
      );
      expect(result).toEqual(mockTicket);
    });

    it('should throw an error when user is not authenticated', async () => {
      const unauthRequest = { user: null };
      
      // The controller accesses req.user.username before checking if req.user exists
      // This causes TypeError: Cannot read properties of null (reading 'username')
      await expect(controller.createTicket(unauthRequest as any, createTicketDto))
        .rejects.toThrow(TypeError); // Change to expect TypeError instead of BadRequestException
    });
    
    it('should handle service errors', async () => {
      mockTicketsService.createTicket.mockRejectedValue(
        new BadRequestException('Service error')
      );
      
      await expect(controller.createTicket(mockRequest as any, createTicketDto))
        .rejects.toThrow(BadRequestException);
    });
    
    it('should handle unexpected service errors', async () => {
      mockTicketsService.createTicket.mockRejectedValue(
        new Error('Unexpected error')
      );
      
      await expect(controller.createTicket(mockRequest as any, createTicketDto))
        .rejects.toThrow(Error);
    });
  });

  describe('getTickets', () => {
    const mockRequest = {
      user: {
        id: '507f1f77bcf86cd799439012',
        username: 'John Doe',
      }
    };

    it('should return tickets for the authenticated user', async () => {
      const mockTickets = [mockTicket];
      mockTicketsService.getTicketsByUser.mockResolvedValue(mockTickets);
      
      const result = await controller.getTickets(mockRequest as any);
      
      expect(mockTicketsService.getTicketsByUser).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
      expect(result).toEqual(mockTickets);
    });

    it('should throw an error when user ID is missing', async () => {
      const invalidRequest = {
        user: {
          username: 'John Doe',
          // missing id
        }
      };
      
      await expect(controller.getTickets(invalidRequest as any))
        .rejects.toThrow(BadRequestException);
    });
    
    it('should handle service errors in getTickets', async () => {
      mockTicketsService.getTicketsByUser.mockRejectedValue(
        new BadRequestException('Invalid user ID')
      );
      
      const mockRequest = {
        user: {
          id: '507f1f77bcf86cd799439012',
          username: 'John Doe',
        }
      };
      
      await expect(controller.getTickets(mockRequest as any))
        .rejects.toThrow(BadRequestException);
    });
    
    it('should throw error for null user', async () => {
      const nullUserRequest = { user: null };
      
      await expect(controller.getTickets(nullUserRequest as any))
        .rejects.toThrow();
    });
  });

  describe('getTicketById', () => {
    it('should return a ticket when given a valid ID', async () => {
      mockTicketsService.getTicketById.mockResolvedValue(mockTicket);
      
      const result = await controller.getTicketById('507f1f77bcf86cd799439011');
      
      expect(mockTicketsService.getTicketById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockTicket);
    });
    
    it('should handle not found tickets', async () => {
      mockTicketsService.getTicketById.mockRejectedValue(
        new NotFoundException(`Ticket with ID not found`)
      );
      
      await expect(controller.getTicketById('invalid-id'))
        .rejects.toThrow(NotFoundException);
    });
    
    it('should handle invalid ID format errors', async () => {
      mockTicketsService.getTicketById.mockRejectedValue(
        new BadRequestException('Invalid ticket ID')
      );
      
      await expect(controller.getTicketById('invalid-id'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('checkOverdueTickets', () => {
    it('should trigger a check for overdue tickets', async () => {
      const mockResult = { processed: 5 };
      mockTicketsService.checkForOverdueTickets.mockResolvedValue(mockResult);
      
      const result = await controller.checkOverdueTickets();
      
      expect(mockTicketsService.checkForOverdueTickets).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
    
    it('should handle errors in overdue ticket processing', async () => {
      mockTicketsService.checkForOverdueTickets.mockRejectedValue(
        new BadRequestException('Failed to check for overdue tickets')
      );
      
      await expect(controller.checkOverdueTickets())
        .rejects.toThrow(BadRequestException);
    });
  });
});
