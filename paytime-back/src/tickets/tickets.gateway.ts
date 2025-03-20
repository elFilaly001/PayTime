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
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { WsGuard } from '../ws/ws.guard';
import { Types } from 'mongoose';

@UseGuards(WsGuard)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/tickets',
})
export class TicketsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TicketsGateway.name);
  private userSocketMap = new Map<string, string>();
  
  @WebSocketServer()
  server: Server;
  
  constructor(
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Tickets WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    try {
      // Get user ID from auth handshake data - same as Friends Gateway
      const userId = client.handshake.auth.userId;
      this.logger.log(`Connection attempt from user ${JSON.stringify(client.handshake)} with socket ${client.id}`);
      const token = client.handshake.headers.authorization;
      
      if (userId && token) {
        this.userSocketMap.set(userId, client.id);
        this.logger.log(`User ${userId} connected with socket ${client.id}`);
      } else {
        this.logger.warn(`Socket connected without authentication: ${client.id}`);
        // Don't disconnect - client can register later
      }
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    // Remove the disconnected user from the map
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
    
    // Confirm registration to client
    client.emit('registered', { 
      success: true, 
      userId 
    });
    
    this.logger.debug(`Currently connected users: ${Array.from(this.userSocketMap.entries()).map(([id, socket]) => `${id}:${socket}`).join(', ')}`);
  }
  
  @SubscribeMessage('createTicket')
  async handleCreateTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() createTicketDto: CreateTicketDto
  ) {
    try {
      
      // Find userId by socketId - simpler approach aligned with Friends Gateway
      let userId = null;
      for (const [uid, sid] of this.userSocketMap.entries()) {
        if (sid === client.id) {
          userId = uid;
          break;
        }
      }
      
      // If not found in socket map, try to extract from DTO or auth
      if (!userId && createTicketDto.userId) {
        userId = createTicketDto.userId;
        this.logger.log(`Using userId from DTO: ${userId}`);
      } else if (!userId && client.handshake.auth.userId) {
        userId = client.handshake.auth.userId;
        this.logger.log(`Using userId from auth: ${userId}`);
      }
      
      if (!userId) {
        this.logger.error(`No userId found for socket ${client.id}`);
        throw new WsException('User not authenticated');
      }
      
      // Ensure object ID is valid
      if (!Types.ObjectId.isValid(userId)) {
        throw new WsException('Invalid user ID format');
      }
      
      // Call the service with the user ID
      this.logger.log(`Creating ticket for user ${userId}`);
      const ticket = await this.ticketsService.createTicket(userId, createTicketDto);
      
      // BROADCAST to all participants (this is the key fix)
      this.broadcastNewTicket(ticket);
      
      // Emit the created ticket back to the client
      return { success: true, ticket };
    } catch (error) {
      this.logger.error(`Failed to create ticket: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  // Fix the broadcastNewTicket method
  private broadcastNewTicket(ticket) {
    try {
      this.logger.log(`Broadcasting ticket ${ticket._id} to all connected clients`);
      
      // First, broadcast to all participants (this is a more direct approach)
      this.server.emit('newTicket', ticket);
      
      this.logger.log(`Broadcast complete. Active connections: ${this.userSocketMap.size}`);
      this.logger.debug(`User-socket map: ${JSON.stringify(Array.from(this.userSocketMap.entries()))}`);
      
      // Additionally, try sending directly to participants if we can identify them
      if (ticket.participants && Array.isArray(ticket.participants)) {
        ticket.participants.forEach(participant => {
          const participantId = typeof participant === 'object' ? participant._id : participant;
          this.logger.debug(`Looking for socket for participant ${participantId}`);
          
          const socketId = this.userSocketMap.get(String(participantId));
          if (socketId) {
            this.logger.log(`Direct emit to participant ${participantId} on socket ${socketId}`);
          }
        });
      }
    } catch (error) {
      this.logger.error(`Error broadcasting ticket: ${error.message}`, error.stack);
    }
  }

  /**
   * Broadcasts a ticket status update to both parties involved
   * @param ticket The ticket with updated status
   */
  public broadcastTicketStatusUpdate(ticket) {
    try {
      this.logger.log(`Broadcasting status update for ticket ${ticket._id} - Status: ${ticket.status}`);
      
      // Broadcast to all connected clients (general update)
      this.server.emit('ticketStatusUpdate', {
        ticketId: ticket._id,
        status: ticket.status,
        updatedAt: new Date()
      });
      
      // Send direct notifications to the loaner and loanee
      if (ticket.loaner) {
        const loanerSocketId = this.userSocketMap.get(String(ticket.loaner));
        if (loanerSocketId) {
          this.logger.debug(`Sending status update to loaner ${ticket.loaner} (Socket: ${loanerSocketId})`);
          this.server.to(loanerSocketId).emit('ticketStatusUpdate', {
            ticketId: ticket._id,
            status: ticket.status,
            role: 'loaner',
            updatedAt: new Date()
          });
        }
      }
      
      if (ticket.loanee) {
        const loaneeSocketId = this.userSocketMap.get(String(ticket.loanee));
        if (loaneeSocketId) {
          this.logger.debug(`Sending status update to loanee ${ticket.loanee} (Socket: ${loaneeSocketId})`);
          this.server.to(loaneeSocketId).emit('ticketStatusUpdate', {
            ticketId: ticket._id,
            status: ticket.status,
            role: 'loanee',
            updatedAt: new Date()
          });
        }
      }
      
      this.logger.log(`Status update broadcast complete for ticket ${ticket._id}`);
    } catch (error) {
      this.logger.error(`Error broadcasting ticket status update: ${error.message}`, error.stack);
    }
  }
}

