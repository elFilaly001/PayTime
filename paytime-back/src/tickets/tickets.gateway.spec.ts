import { Test, TestingModule } from '@nestjs/testing';
import { TicketsGateway } from './tickets.gateway';
import { TicketsService } from './tickets.service';
import { Socket, Server } from 'socket.io';

describe('TicketsGateway', () => {
  let gateway: TicketsGateway;
  let ticketsService: TicketsService;

  const mockTicketsService = {
    createTicket: jest.fn(),
  };

  const mockSocket = {
    emit: jest.fn(),
    data: { 
      user: { 
        id: '123', 
        Username: 'loaneeUser' 
      } 
    },
    join: jest.fn(),
    leave: jest.fn(),
    handshake: {
      auth: {
        token: 'mock-jwt-token'
      }
    }
  } as unknown as Socket;

  const mockServer = {
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({
      emit: jest.fn()
    })
  } as unknown as Server;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsGateway,
        {
          provide: TicketsService,
          useValue: mockTicketsService
        }
      ],
    }).compile();

    gateway = module.get<TicketsGateway>(TicketsGateway);
    ticketsService = module.get<TicketsService>(TicketsService);
    
    // Mock the WebSocket server
    gateway.server = mockServer;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleCreateTicket', () => {
    it('should create a loan ticket and notify the loaner', async () => {
      const ticketData = { 
        title: 'Loan Request', 
        amount: 1000,
        duration: '30 days',
        loanerId: '456'
      };
      
      const createdTicket = { 
        _id: 'ticket123', 
        title: 'Loan Request',
        amount: 1000,
        duration: '30 days',
        loaneeId: '123',
        loanerId: '456',
        status: 'pending',
        createdAt: new Date(),
      };
      
      mockTicketsService.createTicket.mockResolvedValue(createdTicket);
      
      await gateway.handleCreateTicket(ticketData, mockSocket);
      
      expect(mockTicketsService.createTicket).toHaveBeenCalledWith({
        ...ticketData,
        loaneeId: '123'
      }, mockSocket.data.user);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('ticketCreated', createdTicket);
      
      expect(mockServer.to).toHaveBeenCalledWith(`user-${ticketData.loanerId}`);
      expect(mockServer.to(`user-${ticketData.loanerId}`).emit).toHaveBeenCalledWith(
        'newLoanTicket', 
        {
          ticket: createdTicket,
          message: 'A new loan request ticket has been created for you',
          loanee: {
            id: '123',
            username: 'loaneeUser'
          }
        }
      );
    });

    it('should handle missing loaner ID error', async () => {
      const ticketData = { 
        title: 'Loan Request', 
        amount: 1000,
      };
      
      await gateway.handleCreateTicket(ticketData, mockSocket);
      
      expect(mockTicketsService.createTicket).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('ticketError', {
        message: 'Loaner ID is required',
        status: 500
      });
    });
  });

  describe('handleJoinUserRoom', () => {
    it('should join user-specific room for notifications', () => {
      const result = gateway.handleJoinUserRoom(mockSocket);
      
      expect(mockSocket.join).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ success: true, room: 'user-123' });
    });
    
    it('should handle unauthenticated users', () => {
      const unauthSocket = { 
        data: { user: null },
        join: jest.fn() 
      } as unknown as Socket;
      
      const result = gateway.handleJoinUserRoom(unauthSocket);
      
      expect(unauthSocket.join).not.toHaveBeenCalled();
      expect(result).toEqual({ 
        success: false, 
        message: 'User not authenticated' 
      });
    });
  });
});
