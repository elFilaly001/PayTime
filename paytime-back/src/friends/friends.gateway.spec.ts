import { Test, TestingModule } from '@nestjs/testing';
import { FriendsGateway } from './friends.gateway';
import { FriendsService } from './friends.service';
import { getModelToken } from '@nestjs/mongoose';
import { Socket, Server } from 'socket.io';
import { Model, Types } from 'mongoose';
import { AuthDocument } from '../auth/Schema/Auth.schema';

describe('FriendsGateway', () => {
  let gateway: FriendsGateway;
  let friendsService: FriendsService;
  let userModel: Model<AuthDocument>;

  const mockSocket = {
    id: 'test-socket-id',
    handshake: {
      auth: { userId: 'test-user-id' }
    },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis()
  } as unknown as Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsGateway,
        {
          provide: FriendsService,
          useValue: {
            sendFriendRequest: jest.fn(),
            acceptFriendRequest: jest.fn(),
            rejectFriendRequest: jest.fn()
          }
        },
        {
          provide: getModelToken('Auth'),
          useValue: {
            findById: jest.fn()
          }
        }
      ],
    }).compile();

    gateway = module.get<FriendsGateway>(FriendsGateway);
    friendsService = module.get<FriendsService>(FriendsService);
    userModel = module.get<Model<AuthDocument>>(getModelToken('Auth'));
    
    // Mock server
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    } as unknown as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should add user to socket map', () => {
      gateway.handleConnection(mockSocket);
      
      // Use private method accessor to verify map contents
      const userSocketMap = (gateway as any).userSocketMap;
      expect(userSocketMap.get('test-user-id')).toBe('test-socket-id');
    });
  });

  describe('handleDisconnect', () => {
    it('should remove user from socket map', () => {
      // Setup
      (gateway as any).userSocketMap.set('test-user-id', 'test-socket-id');
      
      gateway.handleDisconnect(mockSocket);
      
      // Verify user is removed
      const userSocketMap = (gateway as any).userSocketMap;
      expect(userSocketMap.has('test-user-id')).toBeFalsy();
    });
  });

  describe('handleRegister', () => {
    it('should register a user with their socket', () => {
      gateway.handleRegister(mockSocket, 'user-123');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('registered', {
        success: true,
        userId: 'user-123'
      });
      
      const userSocketMap = (gateway as any).userSocketMap;
      expect(userSocketMap.get('user-123')).toBe('test-socket-id');
    });

    it('should handle missing userId gracefully', () => {
      // Reset all mocks to start fresh
      jest.clearAllMocks();
      
      // Test with empty userId
      gateway.handleRegister(mockSocket, '');
      
      // The actual implementation doesn't emit anything when userId is empty
      // It just logs an error and returns early
      expect(mockSocket.emit).not.toHaveBeenCalled();
      
      // If you want to verify logging behavior, you would need to mock the logger:
      // const logSpy = jest.spyOn(gateway['logger'], 'error');
      // expect(logSpy).toHaveBeenCalledWith('Registration attempted without userId');
    });
  });

  describe('handleSendFriendRequest', () => {
    it('should process and notify about friend request', async () => {
      // Mock dependencies
      const user1Id = new Types.ObjectId().toString();
      const user2Id = new Types.ObjectId().toString();
      const mockUser = { _id: user1Id, Username: 'testUser' };
      
      jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(friendsService, 'sendFriendRequest').mockResolvedValue({ success: true, message: 'Request sent' });
      
      // Setup recipient socket
      (gateway as any).userSocketMap.set(user2Id, 'recipient-socket-id');
      
      await gateway.handleSendFriendRequest(mockSocket, { fromUserId: user1Id, toUserId: user2Id });
      
      expect(friendsService.sendFriendRequest).toHaveBeenCalledWith(user1Id, { toUserId: user2Id });
      expect(gateway.server.to).toHaveBeenCalledWith('recipient-socket-id');
      expect(gateway.server.emit).toHaveBeenCalledWith('newFriendRequest', {
        fromUserId: user1Id,
        fromUsername: 'testUser'
      });
    });
  });

  describe('handleJoinRoom and handleLeaveRoom', () => {
    it('should join a room', async () => {
      await gateway.handleJoinRoom(mockSocket, 'test-room');
      
      expect(mockSocket.join).toHaveBeenCalledWith('test-room');
      expect(mockSocket.emit).toHaveBeenCalledWith('userJoined', {
        message: expect.stringContaining('test-room')
      });
    });

    it('should leave a room', async () => {
      await gateway.handleLeaveRoom(mockSocket, 'test-room');
      
      expect(mockSocket.leave).toHaveBeenCalledWith('test-room');
    });
  });

  describe('handleAcceptFriendRequest', () => {
    it('should process and notify about accepted friend request', async () => {
      // Mock data
      const user1Id = new Types.ObjectId().toString();
      const user2Id = new Types.ObjectId().toString();
      const mockUser = { _id: user2Id, Username: 'acceptingUser' };
      
      // Mock service and database calls
      jest.spyOn(friendsService, 'acceptFriendRequest').mockResolvedValue({
        success: true,
        message: 'Friend request accepted',
        requesterUsername: 'requester'
      });
      
      jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser as any);
      
      // Execute the method
      await gateway.handleAcceptFriendRequest(mockSocket, { 
        fromUserId: user1Id, 
        toUserId: user2Id 
      });
      
      // Verify correct calls were made
      expect(friendsService.acceptFriendRequest).toHaveBeenCalledWith(
        user2Id, 
        { requestId: user1Id }
      );
      
      // Verify notification to both sender and accepter rooms
      expect(gateway.server.to).toHaveBeenCalledWith(`user_${user1Id}`);
      expect(gateway.server.to).toHaveBeenCalledWith(`user_${user2Id}`);
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'friendRequestAccepted',
        expect.objectContaining({
          friend: expect.any(String),
          fromUsername: 'acceptingUser'
        })
      );
    });
  
    it('should handle errors gracefully', async () => {
      // Mock an error response
      jest.spyOn(friendsService, 'acceptFriendRequest')
        .mockRejectedValue(new Error('Test error'));
      
      // Execute the method
      await gateway.handleAcceptFriendRequest(mockSocket, { 
        fromUserId: 'user1', 
        toUserId: 'user2' 
      });
      
      // Verify error handling
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error', 
        { message: 'Test error' }
      );
    });
  });
  
  describe('handleRejectFriendRequest', () => {
    it('should process friend request rejection', async () => {
      // Mock data
      const user1Id = new Types.ObjectId().toString();
      const user2Id = new Types.ObjectId().toString();
      const mockUser = { _id: user2Id, Username: 'rejectingUser' };
      
      // Mock service and database calls
      jest.spyOn(friendsService, 'rejectFriendRequest').mockResolvedValue({
        success: true,
        message: 'Friend request rejected'
      });
      
      jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser as any);
      
      // Execute the method
      await gateway.handleRejectFriendRequest(mockSocket, { 
        fromUserId: user1Id, 
        toUserId: user2Id 
      });
      
      // Verify correct calls were made
      expect(friendsService.rejectFriendRequest).toHaveBeenCalledWith(
        user2Id, 
        { requestId: user1Id }
      );
      
      // Verify notification to sender room
      expect(gateway.server.to).toHaveBeenCalledWith(`user_${user1Id}`);
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'friendRequestRejected',
        expect.objectContaining({
          friend: user2Id,
          fromUsername: 'rejectingUser'
        })
      );
    });
  });
  
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const userId = new Types.ObjectId().toString();
      const mockUser = { _id: userId, Username: 'testUser' };
      
      jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser as any);
      
      const result = await gateway.getUserById(userId);
      
      expect(result).toEqual(mockUser);
      expect(userModel.findById).toHaveBeenCalledWith(userId);
    });
    
    it('should return null for invalid ObjectId', async () => {
      const result = await gateway.getUserById('invalid-id');
      
      expect(result).toBeNull();
      expect(userModel.findById).not.toHaveBeenCalled();
    });
  });
  
  describe('notifyUserOfFriendRequest', () => {
    it('should notify online user of friend request', () => {
      // Mock setup
      const toUserId = 'recipient-id';
      const fromUserId = 'sender-id';
      const fromUsername = 'sender-name';
      
      // Setup recipient socket
      (gateway as any).userSocketMap.set(toUserId, 'recipient-socket-id');
      
      // Execute notification
      gateway.notifyUserOfFriendRequest(toUserId, fromUserId, fromUsername);
      
      // Verify correct notification was sent
      expect(gateway.server.to).toHaveBeenCalledWith('recipient-socket-id');
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'newFriendRequest',
        {
          fromUserId,
          fromUsername
        }
      );
    });
    
    it('should handle offline user gracefully', () => {
      // Mock setup - user not in socket map
      const toUserId = 'offline-user';
      const fromUserId = 'sender-id';
      const fromUsername = 'sender-name';
      
      // Execute notification
      gateway.notifyUserOfFriendRequest(toUserId, fromUserId, fromUsername);
      
      // Verify no notification attempted
      expect(gateway.server.to).not.toHaveBeenCalled();
      expect(gateway.server.emit).not.toHaveBeenCalled();
    });
  });
  
  describe('handleCheckUserOnline', () => {
    it('should return online status for connected user', () => {
      // Setup mock connected user
      (gateway as any).userSocketMap.set('online-user', 'socket-id');
      
      // Call the method
      gateway.handleCheckUserOnline(mockSocket, 'online-user');
      
      // Verify correct response
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'userOnlineStatus',
        expect.objectContaining({
          userId: 'online-user',
          isOnline: true,
          connectedUsers: expect.any(Array)
        })
      );
    });
    
    it('should return offline status for disconnected user', () => {
      // Call the method for a user not in the map
      gateway.handleCheckUserOnline(mockSocket, 'offline-user');
      
      // Verify correct response
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'userOnlineStatus',
        expect.objectContaining({
          userId: 'offline-user',
          isOnline: false,
          connectedUsers: expect.any(Array)
        })
      );
    });
  });
});
