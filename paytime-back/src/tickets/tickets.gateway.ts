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
import { Logger, Injectable , UseGuards } from '@nestjs/common';
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
      
      // Emit the created ticket back to the client
      return { success: true, ticket };
    } catch (error) {
      this.logger.error(`Failed to create ticket: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
}

