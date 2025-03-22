import { Test, TestingModule } from '@nestjs/testing';
import { TransactionGateway } from './transaction.gateway';
import { TransactionService } from './transaction.service';
import { WsGuard } from '../ws/ws.guard';
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { Socket, Server } from 'socket.io';
import { TransactionStatus } from './schema/transaction.schema';

// Create mock JWT helper service class instead of importing it
class MockJWTHelperService {
  verifyAsync = jest.fn().mockResolvedValue({ id: 'test-user-id' });
  signAsync = jest.fn().mockResolvedValue('test-token');
}

describe('TransactionGateway', () => {
    let gateway: TransactionGateway;
    let transactionService: TransactionService;

    // Mock Socket.io objects
    const mockServer = {
        emit: jest.fn(() => true),
    } as unknown as Server;

    // Generate a valid MongoDB ObjectId for use in tests
    const validUserId = new Types.ObjectId().toString();

    const mockClient = {
        id: 'test-socket-id',
        handshake: {
            auth: {
                userId: validUserId, // Use a valid ObjectId string
            },
            headers: {
                authorization: 'Bearer test-token',
            },
        },
        emit: jest.fn(),
    } as unknown as Socket;

    // Mock transaction service
    const mockTransactionService = {
        payWithCash: jest.fn(),
        payWithCard: jest.fn(),
        getTransactionsByTicketId: jest.fn(),
    };

    // Use the mock class directly
    const mockJWTHelperService = new MockJWTHelperService();

    // Mock WsGuard with canActivate method
    const mockWsGuard = { 
        canActivate: jest.fn().mockImplementation(() => true) 
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransactionGateway,
                { provide: TransactionService, useValue: mockTransactionService },
                { provide: WsGuard, useValue: mockWsGuard },
                // Use the mock helper service with a string token name
                { provide: 'JWTHelperService', useValue: mockJWTHelperService },
                Logger,
            ],
        })
        .overrideGuard(WsGuard)
        .useValue(mockWsGuard)
        .compile();

        gateway = module.get<TransactionGateway>(TransactionGateway);
        transactionService = module.get<TransactionService>(TransactionService);

        // Set the server property manually since it's initialized by WebSocketServer() decorator
        gateway.server = mockServer;
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('afterInit', () => {
        it('should log gateway initialization', () => {
            const loggerSpy = jest.spyOn(gateway['logger'], 'log');
            gateway.afterInit(mockServer as Server);
            expect(loggerSpy).toHaveBeenCalledWith('Transaction WebSocket Gateway initialized');
        });
    });

    describe('handleConnection', () => {
        it('should handle new connections with authentication', () => {
            const loggerSpy = jest.spyOn(gateway['logger'], 'log');
            gateway.handleConnection(mockClient);

            expect(loggerSpy).toHaveBeenCalledWith(`Connection attempt from user with socket ${mockClient.id}`);
            expect(loggerSpy).toHaveBeenCalledWith(`User ${mockClient.handshake.auth.userId} connected with socket ${mockClient.id}`);
            expect(gateway['userSocketMap'].get(mockClient.handshake.auth.userId)).toBe(mockClient.id);
        });

        it('should log warning for connections without authentication', () => {
            const unauthenticatedClient = {
                ...mockClient,
                handshake: { auth: {}, headers: {} },
            } as unknown as Socket;

            const loggerSpy = jest.spyOn(gateway['logger'], 'warn');
            gateway.handleConnection(unauthenticatedClient);

            expect(loggerSpy).toHaveBeenCalledWith(`Socket connected without authentication: ${unauthenticatedClient.id}`);
        });

        it('should handle connection errors', () => {
            const errorClient = {
                ...mockClient,
                handshake: { auth: {} }, // Will throw when accessing headers
            } as unknown as Socket;

            const loggerSpy = jest.spyOn(gateway['logger'], 'error');
            gateway.handleConnection(errorClient);

            expect(loggerSpy).toHaveBeenCalled();
        });
    });

    describe('handleDisconnect', () => {
        it('should remove disconnected user from userSocketMap', () => {
            // Setup a user in the map
            gateway['userSocketMap'].set('test-user-id', mockClient.id);

            const loggerSpy = jest.spyOn(gateway['logger'], 'log');
            gateway.handleDisconnect(mockClient);

            expect(gateway['userSocketMap'].has('test-user-id')).toBe(false);
            expect(loggerSpy).toHaveBeenCalledWith('User test-user-id disconnected');
        });

        it('should ignore disconnect for unknown socket', () => {
            const unknownClient = { ...mockClient, id: 'unknown-socket-id' } as Socket;
            gateway.handleDisconnect(unknownClient);

            // Map should remain unchanged
            expect(gateway['userSocketMap'].size).toBe(0);
        });
    });

    describe('handleRegister', () => {
        it('should register user with socket id', () => {
            const result = gateway.handleRegister(mockClient, 'test-user-id');

            expect(gateway['userSocketMap'].get('test-user-id')).toBe(mockClient.id);
            expect(mockClient.emit).toHaveBeenCalledWith('registered', {
                success: true,
                userId: 'test-user-id'
            });
        });

        it('should handle registration without userId', () => {
            const result = gateway.handleRegister(mockClient, null);

            expect(mockClient.emit).toHaveBeenCalledWith('registered', {
                success: false,
                error: 'User ID is required for registration'
            });
            expect(gateway['userSocketMap'].size).toBe(0);
        });
    });

    describe('handlePayWithCash', () => {
        it('should process valid cash payment', async () => {
            // Setup user in map with valid ObjectId
            gateway['userSocketMap'].set(validUserId, mockClient.id);

            const mockTicketId = new Types.ObjectId().toString();
            const mockTransaction = {
                _id: new Types.ObjectId().toString(),
                ticketId: mockTicketId,
                status: TransactionStatus.COMPLETED,
                paymentMethod: 'CASH'
            };

            mockTransactionService.payWithCash.mockResolvedValue(mockTransaction);

            const result = await gateway.handlePayWithCash(mockClient, { ticketId: mockTicketId });

            expect(transactionService.payWithCash).toHaveBeenCalledWith(mockTicketId, validUserId);
            // Since broadcast is private, we can't spy on it directly
            expect(mockServer.emit).toHaveBeenCalled();
            expect(result).toEqual({ success: true, transaction: mockTransaction });
        });

        it('should handle payment with missing userId', async () => {
            // Use a client with no auth data
            const unknownClient = {
                id: 'unknown-socket-id',
                handshake: {
                    auth: {},
                    headers: {}
                },
                emit: jest.fn()
            } as unknown as Socket;

            const mockTicketId = new Types.ObjectId().toString();
            const loggerSpy = jest.spyOn(gateway['logger'], 'error');

            const result = await gateway.handlePayWithCash(unknownClient, { ticketId: mockTicketId });

            expect(loggerSpy).toHaveBeenCalled();
            // Update to match actual error from the gateway
            expect(result).toEqual({ success: false, error: 'User not authenticated' });
        });

        it('should handle invalid ID format', async () => {
            // Setup user in map
            gateway['userSocketMap'].set('test-user-id', mockClient.id);

            const result = await gateway.handlePayWithCash(mockClient, { ticketId: 'invalid-id' });

            expect(result).toEqual({ success: false, error: 'Invalid ID format' });
        });

        it('should handle service errors', async () => {
            // Setup user in map with valid ObjectId
            gateway['userSocketMap'].set(validUserId, mockClient.id);

            const mockTicketId = new Types.ObjectId().toString();
            mockTransactionService.payWithCash.mockRejectedValue(new Error('Payment failed'));

            const loggerSpy = jest.spyOn(gateway['logger'], 'error');

            const result = await gateway.handlePayWithCash(mockClient, { ticketId: mockTicketId });

            expect(loggerSpy).toHaveBeenCalled();
            expect(result).toEqual({ success: false, error: 'Payment failed' });
        });
    });

    describe('handlePayWithCard', () => {
        it('should process valid card payment', async () => {
            // Setup user in map with valid ObjectId
            gateway['userSocketMap'].set(validUserId, mockClient.id);

            const mockTicketId = new Types.ObjectId().toString();
            const mockPaymentMethod = 'VISA';
            const mockTransaction = {
                _id: new Types.ObjectId().toString(),
                ticketId: mockTicketId,
                status: TransactionStatus.COMPLETED,
                paymentMethod: mockPaymentMethod
            };

            mockTransactionService.payWithCard.mockResolvedValue(mockTransaction);

            const result = await gateway.handlePayWithCard(mockClient, {
                ticketId: mockTicketId,
                paymentMethod: mockPaymentMethod
            });

            expect(transactionService.payWithCard).toHaveBeenCalledWith(mockTicketId, validUserId, mockPaymentMethod);
            expect(mockServer.emit).toHaveBeenCalled();
            expect(result).toEqual({ success: true, transaction: mockTransaction });
        });

        it('should handle payment with missing userId', async () => {
            // Use a client with no auth data
            const unknownClient = {
                id: 'unknown-socket-id',
                handshake: {
                    auth: {},
                    headers: {}
                },
                emit: jest.fn()
            } as unknown as Socket;

            const mockTicketId = new Types.ObjectId().toString();
            const mockPaymentMethod = 'VISA';
            const loggerSpy = jest.spyOn(gateway['logger'], 'error');

            const result = await gateway.handlePayWithCard(unknownClient, {
                ticketId: mockTicketId,
                paymentMethod: mockPaymentMethod
            });

            expect(loggerSpy).toHaveBeenCalled();
            // Update to match actual error from the gateway
            expect(result).toEqual({ success: false, error: 'User not authenticated' });
        });

        it('should handle invalid ID format', async () => {
            // Setup user in map
            gateway['userSocketMap'].set('test-user-id', mockClient.id);

            const result = await gateway.handlePayWithCard(mockClient, {
                ticketId: 'invalid-id',
                paymentMethod: 'VISA'
            });

            expect(result).toEqual({ success: false, error: 'Invalid ID format' });
        });

        it('should handle service errors', async () => {
            // Setup user in map with valid ObjectId
            gateway['userSocketMap'].set(validUserId, mockClient.id);

            const mockTicketId = new Types.ObjectId().toString();
            const mockPaymentMethod = 'VISA';
            mockTransactionService.payWithCard.mockRejectedValue(new Error('Payment failed'));

            const loggerSpy = jest.spyOn(gateway['logger'], 'error');

            const result = await gateway.handlePayWithCard(mockClient, {
                ticketId: mockTicketId,
                paymentMethod: mockPaymentMethod
            });

            expect(loggerSpy).toHaveBeenCalled();
            expect(result).toEqual({ success: false, error: 'Payment failed' });
        });
    });

    describe('handleGetTransactionsByTicket', () => {
        it('should return transactions for valid ticket ID', async () => {
            const mockTicketId = new Types.ObjectId().toString();
            const mockTransactions = [
                { _id: new Types.ObjectId().toString(), ticketId: mockTicketId },
                { _id: new Types.ObjectId().toString(), ticketId: mockTicketId }
            ];

            mockTransactionService.getTransactionsByTicketId.mockResolvedValue(mockTransactions);

            const result = await gateway.handleGetTransactionsByTicket(mockClient, { ticketId: mockTicketId });

            expect(transactionService.getTransactionsByTicketId).toHaveBeenCalledWith(mockTicketId);
            expect(result).toEqual({ success: true, transactions: mockTransactions });
        });

        it('should handle invalid ticket ID format', async () => {
            const result = await gateway.handleGetTransactionsByTicket(mockClient, { ticketId: 'invalid-id' });

            expect(result).toEqual({ success: false, error: 'Invalid ticket ID format' });
        });

        it('should handle service errors', async () => {
            const mockTicketId = new Types.ObjectId().toString();
            mockTransactionService.getTransactionsByTicketId.mockRejectedValue(new Error('Failed to fetch transactions'));

            const loggerSpy = jest.spyOn(gateway['logger'], 'error');

            const result = await gateway.handleGetTransactionsByTicket(mockClient, { ticketId: mockTicketId });

            expect(loggerSpy).toHaveBeenCalled();
            expect(result).toEqual({ success: false, error: 'Failed to fetch transactions' });
        });
    });

    describe('broadcastTransactionStatusUpdate', () => {
        it('should broadcast status updates to all clients', () => {
            const mockTransaction = {
                _id: new Types.ObjectId().toString(),
                ticketId: new Types.ObjectId().toString(),
                status: TransactionStatus.COMPLETED
            };

            gateway.broadcastTransactionStatusUpdate(mockTransaction);

            expect(mockServer.emit).toHaveBeenCalledWith('transactionStatusUpdate', {
                transactionId: mockTransaction._id,
                ticketId: mockTransaction.ticketId,
                status: mockTransaction.status,
                updatedAt: expect.any(Date)
            });
        });

        it('should handle broadcast errors', () => {
            const mockTransaction = { _id: 'test-id' }; // Incomplete transaction

            // Fix the mock implementation
            mockServer.emit = jest.fn().mockImplementation(() => {
                throw new Error('Broadcast failed');
            });

            const loggerSpy = jest.spyOn(gateway['logger'], 'error');

            gateway.broadcastTransactionStatusUpdate(mockTransaction);

            expect(loggerSpy).toHaveBeenCalled();

            // Reset the mock for other tests
            mockServer.emit = jest.fn(() => true);
        });
    });
});