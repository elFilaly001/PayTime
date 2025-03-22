import { Test, TestingModule } from '@nestjs/testing';
import { TicketsGateway } from './tickets.gateway';
import { TicketsService } from './tickets.service';
import { Socket, Server } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { Types } from 'mongoose';
import { WsGuard } from '../ws/ws.guard';

// Mock the WebSocket guard directly
jest.mock('../ws/ws.guard', () => ({
  WsGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn().mockReturnValue(true)
  }))
}));

describe('TicketsGateway', () => {
  let gateway: TicketsGateway;
  let ticketsService: TicketsService;
  let mockServer: Server;

  const mockTicketsService = {
    createTicket: jest.fn(),
    getTicketsByUser: jest.fn(),
    getTicketById: jest.fn(),
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
    paymentId: null,
    paidAt: null
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsGateway,
        {
          provide: TicketsService,
          useValue: mockTicketsService,
        }
      ],
    })
    .overrideGuard(WsGuard)
    .useValue({ canActivate: jest.fn().mockReturnValue(true) })
    .compile();

    gateway = module.get<TicketsGateway>(TicketsGateway);
    ticketsService = module.get<TicketsService>(TicketsService);
    
    // Mock Socket.io server
    const emitMock = jest.fn();
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({
        emit: emitMock
      })
    } as unknown as Server;
    
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('afterInit', () => {
    it('should initialize the WebSocket server', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      
      gateway.afterInit(mockServer);
      
      expect(loggerSpy).toHaveBeenCalledWith('Tickets WebSocket Gateway initialized');
    });
  });

  describe('handleConnection', () => {
    it('should add user to the socket map when connection is authenticated', () => {
      const mockSocket = {
        id: 'socket-123',
        handshake: {
          auth: { userId: 'user-123' },
          headers: { authorization: 'Bearer token' }
        }
      } as unknown as Socket;
      
      gateway.handleConnection(mockSocket);
      
      // Check internal map state
      expect(gateway['userSocketMap'].get('user-123')).toBe('socket-123');
    });

    it('should log a warning when connection is not authenticated', () => {
      const mockSocket = {
        id: 'socket-123',
        handshake: {
          auth: {},
          headers: {}
        }
      } as unknown as Socket;
      
      const loggerSpy = jest.spyOn(gateway['logger'], 'warn');
      
      gateway.handleConnection(mockSocket);
      
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('without authentication'));
    });
    
    it('should handle connection errors gracefully', () => {
      const mockSocket = {
        id: 'socket-123',
        handshake: {
          // Create a situation where handshake access would throw
          get auth() { throw new Error('Handshake error'); }
        }
      } as unknown as Socket;
      
      // Should not throw an error
      expect(() => gateway.handleConnection(mockSocket)).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove user from socket map on disconnect', () => {
      const mockSocket = { id: 'socket-123' } as Socket;
      
      // Setup the socket map with a test user
      gateway['userSocketMap'].set('user-123', 'socket-123');
      
      gateway.handleDisconnect(mockSocket);
      
      expect(gateway['userSocketMap'].has('user-123')).toBe(false);
    });
  });

  describe('handleRegister', () => {
    it('should register the user with their socket ID', () => {
      const mockSocket = { 
        id: 'socket-123',
        emit: jest.fn()
      } as unknown as Socket;
      
      gateway.handleRegister(mockSocket, 'user-123');
      
      expect(gateway['userSocketMap'].get('user-123')).toBe('socket-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('registered', { 
        success: true, 
        userId: 'user-123' 
      });
    });

    it('should handle registration without userId', () => {
      const mockSocket = { 
        id: 'socket-123',
        emit: jest.fn()
      } as unknown as Socket;
      
      gateway.handleRegister(mockSocket, null);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('registered', { 
        success: false, 
        error: expect.any(String)
      });
    });
  });

  describe('handleCreateTicket', () => {
    const createTicketDto = {
      amount: 100,
      loaner: '507f1f77bcf86cd799439013',
      Type: 'MANUAL',
      Place: 'Coffee Shop',
      title: 'Test Ticket',
      description: 'This is a test ticket'
    };
    
    const mockSocket = { 
      id: 'socket-123',
      handshake: {
        auth: { userId: '507f1f77bcf86cd799439012' }
      }
    } as unknown as Socket;

    beforeEach(() => {
      // Register the user with the socket
      gateway['userSocketMap'].set('507f1f77bcf86cd799439012', 'socket-123');
    });

    it('should create a ticket and broadcast it', async () => {
      mockTicketsService.createTicket.mockResolvedValue(mockTicket);
      
      const result = await gateway.handleCreateTicket(mockSocket, createTicketDto);
      
      expect(mockTicketsService.createTicket).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        createTicketDto
      );
      
      expect(result).toEqual({
        success: true,
        ticket: mockTicket
      });
      
      // Check that broadcast was called
      expect(mockServer.emit).toHaveBeenCalledWith('newTicket', mockTicket);
    });

    it('should handle errors when creating tickets', async () => {
      const error = new Error('Failed to create ticket');
      mockTicketsService.createTicket.mockRejectedValue(error);
      
      const result = await gateway.handleCreateTicket(mockSocket, createTicketDto);
      
      expect(result).toEqual({
        success: false,
        error: error.message
      });
    });

    it('should handle missing user authentication', async () => {
      const unauthSocket = { 
        id: 'socket-456',
        handshake: {
          auth: {}
        }
      } as unknown as Socket;
      
      mockTicketsService.createTicket.mockRejectedValue(new WsException('User not authenticated'));
      
      const result = await gateway.handleCreateTicket(unauthSocket, createTicketDto);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('User not authenticated');
    });
    
    it('should extract userId from DTO when not in socket map', async () => {
      const dtoWithUserId = {
        ...createTicketDto,
        userId: '507f1f77bcf86cd799439012'
      };
      
      // Socket not registered in userSocketMap
      const unregisteredSocket = { 
        id: 'socket-999',
        handshake: {
          auth: {}
        }
      } as unknown as Socket;
      
      mockTicketsService.createTicket.mockResolvedValue(mockTicket);
      
      const result = await gateway.handleCreateTicket(unregisteredSocket, dtoWithUserId);
      
      expect(mockTicketsService.createTicket).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        dtoWithUserId
      );
      
      expect(result.success).toBe(true);
    });
    
    it('should extract userId from handshake auth when not in socket map or DTO', async () => {
      const socketWithAuthUserId = { 
        id: 'socket-999',
        handshake: {
          auth: { userId: '507f1f77bcf86cd799439012' }
        }
      } as unknown as Socket;
      
      mockTicketsService.createTicket.mockResolvedValue(mockTicket);
      
      const result = await gateway.handleCreateTicket(socketWithAuthUserId, createTicketDto);
      
      expect(mockTicketsService.createTicket).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        createTicketDto
      );
      
      expect(result.success).toBe(true);
    });
    
    it('should throw error for invalid ObjectId', async () => {
      // Mock the Types.ObjectId.isValid specifically for this test
      const originalIsValid = Types.ObjectId.isValid;
      Types.ObjectId.isValid = jest.fn().mockReturnValue(false);
      
      const invalidSocket = { 
        id: 'socket-123',
        handshake: {
          auth: { userId: 'not-a-valid-object-id' }
        }
      } as unknown as Socket;
      
      // Register the invalid user ID
      gateway['userSocketMap'].set('not-a-valid-object-id', 'socket-123');
      
      const result = await gateway.handleCreateTicket(invalidSocket, createTicketDto);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid user ID format');
      
      // Restore the original function
      Types.ObjectId.isValid = originalIsValid;
    });
  });

  describe('broadcastTicketStatusUpdate', () => {
    it('should broadcast status update to all users', () => {
      const updatedTicket = {
        ...mockTicket,
        status: 'PAID'
      };
      
      // Set up socket map for both users
      gateway['userSocketMap'].set(mockTicket.loanee.toString(), 'loanee-socket');
      gateway['userSocketMap'].set(mockTicket.loaner.toString(), 'loaner-socket');
      
      // Properly mock the server to() method with BroadcastOperator behavior
      const toEmitMock = jest.fn();
      const broadcastOperatorMock = {
        emit: toEmitMock,
        // Add missing BroadcastOperator properties
        adapter: {},
        rooms: new Set(),
        exceptRooms: new Set(),
        flags: {},
        // Other required methods
        to: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        except: jest.fn().mockReturnThis(),
        timeout: jest.fn().mockReturnThis(),
        serverSideEmit: jest.fn()
      };
      
      mockServer.to = jest.fn().mockReturnValue(broadcastOperatorMock);
      
      gateway.broadcastTicketStatusUpdate(updatedTicket);
      
      // Check general broadcast
      expect(mockServer.emit).toHaveBeenCalledWith('ticketStatusUpdate', expect.objectContaining({
        ticketId: updatedTicket._id,
        status: 'PAID'
      }));
      
      // Check direct notifications
      expect(mockServer.to).toHaveBeenCalledWith('loaner-socket');
      expect(mockServer.to).toHaveBeenCalledWith('loanee-socket');
      expect(toEmitMock).toHaveBeenCalledWith('ticketStatusUpdate', expect.objectContaining({
        role: expect.stringMatching(/loaner|loanee/)
      }));
    });
  });
  
  describe('broadcastTicketStatusUpdate edge cases', () => {
    it('should handle empty user socket map', () => {
      const updatedTicket = {
        ...mockTicket,
        status: 'PAID'
      };
      
      // Clear the user socket map
      gateway['userSocketMap'].clear();
      
      // Should not throw error
      expect(() => gateway.broadcastTicketStatusUpdate(updatedTicket)).not.toThrow();
      
      // Should still broadcast to all connected clients
      expect(mockServer.emit).toHaveBeenCalled();
    });
    
    it('should handle error during broadcast', () => {
      const updatedTicket = {
        ...mockTicket,
        status: 'PAID'
      };
      
      // Fix the mock implementation
      const originalEmit = mockServer.emit;
      mockServer.emit = jest.fn().mockImplementation(() => {
        throw new Error('Broadcasting error');
      });
      
      // Should not throw error
      expect(() => gateway.broadcastTicketStatusUpdate(updatedTicket)).not.toThrow();
      
      // Restore original function
      mockServer.emit = originalEmit;
    });
    
    it('should handle ticket with missing participant data', () => {
      const incompleteTicket = {
        _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
        status: 'PAID'
        // Missing loanee and loaner
      };
      
      // Should not throw error
      expect(() => gateway.broadcastTicketStatusUpdate(incompleteTicket)).not.toThrow();
      
      // Should still broadcast general update
      expect(mockServer.emit).toHaveBeenCalled();
    });
  });
});
