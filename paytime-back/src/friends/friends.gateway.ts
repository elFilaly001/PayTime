import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { FriendsService } from './friends.service';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthDocument, Auth as User } from '../auth/Schema/Auth.schema';
import { FriendRequestActionDto } from './dto/Friends.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/friends',
})
export class FriendsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private userSocketMap = new Map<string, string>();
  private logger = new Logger('FriendsGateway');

  constructor(
    private readonly friendsService: FriendsService,
    @InjectModel(User.name) private userModel: Model<AuthDocument>
  ) {}

  afterInit(server: Server) {
    this.logger.log('Friends WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    try {
      // Get user ID from auth token or handshake data
      const userId = client.handshake.auth.userId; // or however you're passing the user ID
      if (userId) {
        this.userSocketMap.set(userId, client.id);
        this.logger.log(`User ${userId} connected with socket ${client.id}`);
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

  @SubscribeMessage('sendFriendRequest')
  async handleSendFriendRequest(client: Socket, payload: { fromUserId: string, toUserId: string }) {
    try {
      const { fromUserId, toUserId } = payload;
      if (!fromUserId || !toUserId) {
        this.logger.error('Invalid friend request payload');
        return;
      }

      // Get sender's info for the notification
      const fromUser = await this.userModel.findById(fromUserId);
      if (!fromUser) {
        this.logger.error(`User ${fromUserId} not found`);
        return;
      }

      await this.friendsService.sendFriendRequest(fromUserId, { toUserId });

      const recipientSocketId = this.userSocketMap.get(toUserId);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('newFriendRequest', {
          fromUserId,
          fromUsername: fromUser.Username
        });
        
        // After sending the request, clean up the socket connection
        this.userSocketMap.delete(toUserId);
        client.leave(this.getUserRoom(toUserId));
      }

      this.logger.log(`Friend request sent and socket cleaned up for ${toUserId}`);
    } catch (error) {
      this.logger.error(`Error sending friend request: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('acceptFriendRequest')
  async handleAcceptFriendRequest(client: Socket, payload: { fromUserId: string, toUserId: string }) {
    try {
      const { fromUserId, toUserId } = payload;
      if (!fromUserId || !toUserId) {
        this.logger.error('Invalid accept request payload');
        return;
      }

      // Process acceptance in database
      const friendRequestActionDto = { requestId: fromUserId };
      await this.friendsService.acceptFriendRequest(toUserId, friendRequestActionDto);

      // Get user info for notification
      const toUser = await this.userModel.findById(toUserId);
      
      // Notify both users through their respective rooms
      const senderRoom = this.getUserRoom(fromUserId);
      const accepterRoom = this.getUserRoom(toUserId);

      // Notify sender
      this.server.to(senderRoom).emit('friendRequestAccepted', {
        friend: toUserId,
        fromUsername: toUser?.Username
      });

      // Notify accepter
      this.server.to(accepterRoom).emit('friendRequestAccepted', {
        friend: fromUserId,
        fromUsername: toUser?.Username
      });

      this.logger.log(`Friend request accepted: Notified rooms ${senderRoom} and ${accepterRoom}`);
    } catch (error) {
      this.logger.error(`Error accepting friend request: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('rejectFriendRequest')
  async handleRejectFriendRequest(client: Socket, payload: { fromUserId: string, toUserId: string }) {
    try {
      const { fromUserId, toUserId } = payload;
      
      this.logger.log(`Rejecting friend request: from=${fromUserId}, to=${toUserId}`);
      
      // Convert to the format expected by the service
      const friendRequestActionDto = { requestId: fromUserId };
      
      // Process rejection in database
      await this.friendsService.rejectFriendRequest(toUserId, friendRequestActionDto);
      
      this.logger.log(`Friend request from ${fromUserId} to ${toUserId} rejected successfully`);
    } catch (error) {
      this.logger.error(`Error rejecting friend request: ${error.message}`);
      client.emit('error', { 
        message: `Error rejecting friend request: ${error.message}` 
      });
    }
  }

  async getUserById(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`Invalid user ID: ${userId}`);
        return null;
      }
      
      return await this.userModel.findById(userId);
    } catch (error) {
      this.logger.error(`Error getting user by ID: ${error.message}`);
      return null;
    }
  }

  notifyUserOfFriendRequest(toUserId: string, fromUserId: string, fromUsername: string) {
    try {
      const recipientSocketId = this.userSocketMap.get(toUserId);
      
      if (recipientSocketId) {
        this.logger.log(`Notifying user ${toUserId} of friend request from ${fromUserId}`);
        this.server.to(recipientSocketId).emit('newFriendRequest', {
          fromUserId,
          fromUsername
        });
      } else {
        this.logger.log(`User ${toUserId} is not online, no notification sent`);
      }
    } catch (error) {
      this.logger.error(`Error notifying user of friend request: ${error.message}`);
    }
  }

  notifyUserOfAcceptedRequest(toUserId: string, fromUserId: string, fromUsername: string) {
    try {
      const recipientSocketId = this.userSocketMap.get(toUserId);
      
      if (recipientSocketId) {
        this.logger.log(`Notifying user ${toUserId} that ${fromUserId} accepted their request`);
        this.server.to(recipientSocketId).emit('friendRequestAccepted', {
          friend: fromUserId,
          fromUsername
        });
      } else {
        this.logger.log(`User ${toUserId} is not online, no notification sent`);
      }
    } catch (error) {
      this.logger.error(`Error notifying user of accepted request: ${error.message}`);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(client: Socket, roomId: string) {
    try {
      await client.join(roomId);
      this.logger.log(`Client ${client.id} joined room ${roomId}`);
      
      // Optionally notify others in the room
      client.emit('userJoined', {
        message: `A user has joined the room ${roomId}`
      });
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      client.emit('error', {
        message: 'Failed to join room'
      });
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(client: Socket, roomId: string) {
    try {
      await client.leave(roomId);
      this.logger.log(`Client ${client.id} left room ${roomId}`);
      
      // Optionally notify others in the room
      client.to(roomId).emit('userLeft', {
        message: `A user has left the room ${roomId}`
      });
    } catch (error) {
      this.logger.error(`Error leaving room: ${error.message}`);
    }
  }

  // Example of sending message to a specific room
  @SubscribeMessage('sendMessageToRoom')
  handleMessageToRoom(client: Socket, payload: { room: string; message: string }) {
    try {
      this.server.to(payload.room).emit('roomMessage', {
        message: payload.message,
        from: client.id
      });
    } catch (error) {
      this.logger.error(`Error sending message to room: ${error.message}`);
    }
  }

  private getUserRoom(userId: string): string {
    return `user_${userId}`;
  }
}