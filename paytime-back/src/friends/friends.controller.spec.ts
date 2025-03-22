import { Test, TestingModule } from '@nestjs/testing';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { FriendsGateway } from './friends.gateway';
import { Types } from 'mongoose';
import { AuthGuard } from '../auth/auth.guard';
import { BadRequestException } from '@nestjs/common'; // Add this import

// Mock the AuthGuard
jest.mock('../auth/auth.guard', () => ({
  AuthGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn().mockReturnValue(true)
  }))
}));

describe('FriendsController', () => {
  let controller: FriendsController;
  let friendsService: FriendsService;
  let friendsGateway: FriendsGateway;

  // Mock user data
  const user1Id = new Types.ObjectId().toString();
  const user2Id = new Types.ObjectId().toString();
  const mockUser = { id: user1Id, Username: 'testUser' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [
        {
          provide: FriendsService,
          useValue: {
            sendFriendRequest: jest.fn(),
            acceptFriendRequest: jest.fn(),
            rejectFriendRequest: jest.fn(),
            searchUsers: jest.fn(),
            getFriendRequests: jest.fn()
          }
        },
        {
          provide: FriendsGateway,
          useValue: {
            getUserById: jest.fn(),
            notifyUserOfFriendRequest: jest.fn(),
            notifyUserOfAcceptedRequest: jest.fn()
          }
        }
      ],
    })
    // Override the guard to avoid dependency issues
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: jest.fn().mockReturnValue(true) })
    .compile();

    controller = module.get<FriendsController>(FriendsController);
    friendsService = module.get<FriendsService>(FriendsService);
    friendsGateway = module.get<FriendsGateway>(FriendsGateway);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addFriend', () => {
    it('should send a friend request and notify', async () => {
      // Setup
      const req = { user: { id: user1Id } };
      const friendRequestDto = { toUserId: user2Id };
      
      jest.spyOn(friendsService, 'sendFriendRequest').mockResolvedValue({ 
        success: true, 
        message: 'Friend request sent' 
      });
      
      jest.spyOn(friendsGateway, 'getUserById').mockResolvedValue({ 
        _id: user1Id, 
        Username: 'testUser' 
      } as any);
      
      const result = await controller.addFriend(req, friendRequestDto);
      
      expect(result).toEqual({ success: true, message: 'Friend request sent' });
      expect(friendsService.sendFriendRequest).toHaveBeenCalledWith(user1Id, friendRequestDto);
      expect(friendsGateway.notifyUserOfFriendRequest).toHaveBeenCalledWith(
        user2Id,
        user1Id,
        'testUser'
      );
    });

    it('should handle service errors gracefully', async () => {
      const req = { user: { id: user1Id } };
      const friendRequestDto = { toUserId: user2Id };
      const errorMessage = 'Cannot send friend request to yourself';
      
      jest.spyOn(friendsService, 'sendFriendRequest')
        .mockRejectedValue(new BadRequestException(errorMessage));
      
      await expect(controller.addFriend(req, friendRequestDto))
        .rejects.toThrow(BadRequestException);
      
      // Verify gateway notification was not called after error
      expect(friendsGateway.notifyUserOfFriendRequest).not.toHaveBeenCalled();
    });
  
    it('should handle missing user gracefully', async () => {
      const req = { user: { id: user1Id } };
      const friendRequestDto = { toUserId: user2Id };
      
      jest.spyOn(friendsService, 'sendFriendRequest').mockResolvedValue({ 
        success: true, 
        message: 'Friend request sent' 
      });
      
      // User not found in gateway
      jest.spyOn(friendsGateway, 'getUserById').mockResolvedValue(null);
      
      const result = await controller.addFriend(req, friendRequestDto);
      
      expect(result).toEqual({ success: true, message: 'Friend request sent' });
      // Should not attempt to notify without a valid user
      expect(friendsGateway.notifyUserOfFriendRequest).not.toHaveBeenCalled();
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept a friend request and notify', async () => {
      // Setup
      const req = { user: { id: user1Id } };
      const actionDto = { requestId: user2Id };
      
      jest.spyOn(friendsService, 'acceptFriendRequest').mockResolvedValue({ 
        success: true, 
        message: 'Friend request accepted',
        requesterUsername: 'requester'
      });
      
      jest.spyOn(friendsGateway, 'getUserById').mockResolvedValue({ 
        _id: user1Id, 
        Username: 'testUser' 
      } as any);
      
      const result = await controller.acceptFriendRequest(req, actionDto);
      
      expect(result).toEqual({ 
        success: true, 
        message: 'Friend request accepted',
        requesterUsername: 'requester'
      });
      
      expect(friendsService.acceptFriendRequest).toHaveBeenCalledWith(user1Id, actionDto);
      expect(friendsGateway.notifyUserOfAcceptedRequest).toHaveBeenCalledWith(
        user2Id,
        user1Id,
        'testUser'
      );
    });

    it('should handle service errors gracefully', async () => {
      const req = { user: { id: user1Id } };
      const actionDto = { requestId: user2Id };
      const errorMessage = 'Friend request not found';
      
      jest.spyOn(friendsService, 'acceptFriendRequest')
        .mockRejectedValue(new BadRequestException(errorMessage));
      
      await expect(controller.acceptFriendRequest(req, actionDto))
        .rejects.toThrow(BadRequestException);
      
      // Verify gateway notification was not called after error
      expect(friendsGateway.notifyUserOfAcceptedRequest).not.toHaveBeenCalled();
    });
  
    it('should handle missing user gracefully', async () => {
      const req = { user: { id: user1Id } };
      const actionDto = { requestId: user2Id };
      
      jest.spyOn(friendsService, 'acceptFriendRequest').mockResolvedValue({ 
        success: true, 
        message: 'Friend request accepted',
        requesterUsername: 'requester'
      });
      
      // User not found in gateway
      jest.spyOn(friendsGateway, 'getUserById').mockResolvedValue(null);
      
      const result = await controller.acceptFriendRequest(req, actionDto);
      
      expect(result).toEqual({ 
        success: true, 
        message: 'Friend request accepted',
        requesterUsername: 'requester'
      });
      
      // Should not attempt to notify without a valid user
      expect(friendsGateway.notifyUserOfAcceptedRequest).not.toHaveBeenCalled();
    });
  });

  describe('rejectFriendRequest', () => {
    it('should reject a friend request', async () => {
      // Setup
      const req = { user: { id: user1Id } };
      const actionDto = { requestId: user2Id };
      
      jest.spyOn(friendsService, 'rejectFriendRequest').mockResolvedValue({ 
        success: true, 
        message: 'Friend request rejected' 
      });
      
      const result = await controller.rejectFriendRequest(req, actionDto);
      
      expect(result).toEqual({ success: true, message: 'Friend request rejected' });
      expect(friendsService.rejectFriendRequest).toHaveBeenCalledWith(user1Id, actionDto);
    });
  });

  describe('searchUsers', () => {
    it('should search for users', async () => {
      // Setup
      const req = { user: { id: user1Id } };
      const searchDto = { searchTerm: 'test' };
      
      // Use valid ObjectId format (24 hex characters)
      const mockId1 = new Types.ObjectId().toString();
      const mockId2 = new Types.ObjectId().toString();
      
      const mockResults = [
        { id: new Types.ObjectId(mockId1), username: 'match1', friendCode: 'code1' },
        { id: new Types.ObjectId(mockId2), username: 'match2', friendCode: 'code2' }
      ];
      
      jest.spyOn(friendsService, 'searchUsers').mockResolvedValue(mockResults);
      
      const result = await controller.searchUsers(req, searchDto);
      
      expect(result).toEqual(mockResults);
      expect(friendsService.searchUsers).toHaveBeenCalledWith('test', user1Id);
    });

    it('should handle empty search term gracefully', async () => {
      const req = { user: { id: user1Id } };
      const searchDto = { searchTerm: '' };
      
      jest.spyOn(friendsService, 'searchUsers').mockResolvedValue([]);
      
      const result = await controller.searchUsers(req, searchDto);
      
      expect(result).toEqual([]);
      expect(friendsService.searchUsers).toHaveBeenCalledWith('', user1Id);
    });
  
    it('should handle service errors gracefully', async () => {
      const req = { user: { id: user1Id } };
      const searchDto = { searchTerm: 'test' };
      
      jest.spyOn(friendsService, 'searchUsers')
        .mockRejectedValue(new BadRequestException('Invalid search'));
      
      await expect(controller.searchUsers(req, searchDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getFriendRequests', () => {
    it('should get all friend requests', async () => {
      // Setup
      const req = { user: { id: user1Id } };
      
      // Use a valid ObjectId
      const reqUserId = new Types.ObjectId().toString();
      
      // Use type assertion to bypass strict typing
      const mockRequests = { 
        requests: [{ 
          from: new Types.ObjectId(reqUserId), 
          Username: 'user2name', 
          status: 'pending', 
          createdAt: new Date() 
        }],
        count: 1,
        userId: user1Id
      } as any; // Use type assertion to avoid strict typings
      
      jest.spyOn(friendsService, 'getFriendRequests').mockResolvedValue(mockRequests);
      
      const result = await controller.getFriendRequests(req);
      
      expect(result).toEqual(mockRequests);
      expect(friendsService.getFriendRequests).toHaveBeenCalledWith(user1Id);
    });
  });
});
