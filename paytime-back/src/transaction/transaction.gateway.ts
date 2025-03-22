import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
    WsException,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit
} from '@nestjs/websockets';
import { Logger, Injectable, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TransactionService } from './transaction.service';
import { WsGuard } from '../ws/ws.guard';
import { Types } from 'mongoose';

@UseGuards(WsGuard)
@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/transactions',
})
export class TransactionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(TransactionGateway.name);
    private userSocketMap = new Map<string, string>();

    @WebSocketServer()
    server: Server;

    constructor(
        @Inject(forwardRef(() => TransactionService))
        private readonly transactionService: TransactionService,
    ) { }

    afterInit(server: Server) {
        this.logger.log('Transaction WebSocket Gateway initialized');
    }

    handleConnection(client: Socket) {
        try {
            const userId = client.handshake.auth.userId;
            this.logger.log(`Connection attempt from user with socket ${client.id}`);
            const token = client.handshake.headers.authorization;

            if (userId && token) {
                this.userSocketMap.set(userId, client.id);
                this.logger.log(`User ${userId} connected with socket ${client.id}`);
            } else {
                this.logger.warn(`Socket connected without authentication: ${client.id}`);
            }
        } catch (error) {
            this.logger.error(`Connection error: ${error.message}`);
        }
    }

    handleDisconnect(client: Socket) {
        for (const [userId, socketId] of this.userSocketMap.entries()) {
            if (socketId === client.id) {
                this.userSocketMap.delete(userId);
                this.logger.log(`User ${userId} disconnected`);
                break;
            }
        }
    }

    @SubscribeMessage('register')
    handleRegister(@ConnectedSocket() client: Socket, @MessageBody() userId: string) {
        if (!userId) {
            this.logger.error('Registration attempted without userId');
            client.emit('registered', {
                success: false,
                error: 'User ID is required for registration'
            });
            return;
        }

        this.userSocketMap.set(userId, client.id);
        this.logger.log(`User ${userId} registered with socket ${client.id}`);

        client.emit('registered', {
            success: true,
            userId
        });

        this.logger.debug(`Currently connected users: ${Array.from(this.userSocketMap.entries()).map(([id, socket]) => `${id}:${socket}`).join(', ')}`);
    }

    @SubscribeMessage('payWithCash')
    async handlePayWithCash(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { ticketId: string }
    ) {
        try {
            let userId = null;
            for (const [uid, sid] of this.userSocketMap.entries()) {
                if (sid === client.id) {
                    userId = uid;
                    break;
                }
            }

            if (!userId && client.handshake.auth.userId) {
                userId = client.handshake.auth.userId;
            }

            if (!userId) {
                this.logger.error(`No userId found for socket ${client.id}`);
                throw new WsException('User not authenticated');
            }

            if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(payload.ticketId)) {
                throw new WsException('Invalid ID format');
            }

            this.logger.log(`Processing cash payment for ticket ${payload.ticketId} by user ${userId}`);
            const transaction = await this.transactionService.payWithCash(payload.ticketId, userId);

            // Broadcast the payment success
            this.broadcastPaymentUpdate(transaction);

            return { success: true, transaction };
        } catch (error) {
            this.logger.error(`Failed to process cash payment: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    @SubscribeMessage('payWithCard')
    async handlePayWithCard(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { ticketId: string, paymentMethod: string }
    ) {
        try {
            let userId = null;
            for (const [uid, sid] of this.userSocketMap.entries()) {
                if (sid === client.id) {
                    userId = uid;
                    break;
                }
            }

            if (!userId && client.handshake.auth.userId) {
                userId = client.handshake.auth.userId;
            }

            if (!userId) {
                this.logger.error(`No userId found for socket ${client.id}`);
                throw new WsException('User not authenticated');
            }

            if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(payload.ticketId)) {
                throw new WsException('Invalid ID format');
            }

            this.logger.log(`Processing card payment for ticket ${payload.ticketId} by user ${userId}`);
            const transaction = await this.transactionService.payWithCard(
                payload.ticketId,
                userId,
                payload.paymentMethod
            );

            // Broadcast the payment success
            this.broadcastPaymentUpdate(transaction);

            return { success: true, transaction };
        } catch (error) {
            this.logger.error(`Failed to process card payment: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    @SubscribeMessage('getTransactionsByTicket')
    async handleGetTransactionsByTicket(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { ticketId: string }
    ) {
        try {
            if (!Types.ObjectId.isValid(payload.ticketId)) {
                throw new WsException('Invalid ticket ID format');
            }

            const transactions = await this.transactionService.getTransactionsByTicketId(payload.ticketId);
            return { success: true, transactions };
        } catch (error) {
            this.logger.error(`Failed to get transactions: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    private broadcastPaymentUpdate(transaction) {
        try {
            this.logger.log(`Broadcasting transaction ${transaction._id} update to all connected clients`);

            // Broadcast to all clients
            this.server.emit('transactionComplete', {
                ticketId: transaction.ticketId,
                transactionId: transaction._id,
                status: transaction.status,
                paymentMethod: transaction.paymentMethod,
                timestamp: new Date()
            });

            this.logger.log(`Broadcast complete. Active connections: ${this.userSocketMap.size}`);
        } catch (error) {
            this.logger.error(`Error broadcasting transaction update: ${error.message}`, error.stack);
        }
    }

    /**
     * Public method to broadcast transaction status updates (to be called from service)
     */
    public broadcastTransactionStatusUpdate(transaction) {
        try {
            this.logger.log(`Broadcasting status update for transaction ${transaction._id} - Status: ${transaction.status}`);

            // Broadcast to all connected clients
            this.server.emit('transactionStatusUpdate', {
                transactionId: transaction._id,
                ticketId: transaction.ticketId,
                status: transaction.status,
                updatedAt: new Date()
            });

            this.logger.log(`Status update broadcast complete for transaction ${transaction._id}`);
        } catch (error) {
            this.logger.error(`Error broadcasting transaction status update: ${error.message}`, error.stack);
        }
    }
}