import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthDocument } from '../auth/Schema/Auth.schema';

describe('FriendsService', () => {
  let service: FriendsService;
  let userModel: Model<AuthDocument>;

  // Mock user data
  const user1Id = new Types.ObjectId().toString();
  const user2Id = new Types.ObjectId().toString();
  const mockUser1 = {
    _id: user1Id,
    Username: 'testUser1',
    Friend_Code: 'USER1CODE',
    Friend_list: [],
    Friend_requests: []
  };
  const mockUser2 = {
    _id: user2Id,
    Username: 'testUser2',
    Friend_Code: 'USER2CODE',
    Friend_list: [],
    Friend_requests: []
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: getModelToken('Auth'),
          useValue: {
            findById: jest.fn(),
            updateOne: jest.fn(),
            find: jest.fn()
          },
        },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    userModel = module.get<Model<AuthDocument>>(getModelToken('Auth'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendFriendRequest', () => {
    it('should send a friend request successfully', async () => {
      // Mock implementations
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve(mockUser1) as any;
        if (id === user2Id) return Promise.resolve(mockUser2) as any;
        return Promise.resolve(null);
      });
      jest.spyOn(userModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);

      const result = await service.sendFriendRequest(user1Id, { toUserId: user2Id });
      
      expect(result).toEqual({ success: true, message: 'Friend request sent' });
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: user2Id },
        {
          $push: {
            Friend_requests: expect.objectContaining({
              from: expect.any(Types.ObjectId),
              Username: 'testUser1',
              status: 'pending'
            })
          }
        }
      );
    });

    it('should throw BadRequestException when sending request to self', async () => {
      // Need to mock findById to actually return the user so it reaches the self-check
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve(mockUser1) as any;
        return Promise.resolve(null);
      });
      
      await expect(service.sendFriendRequest(user1Id, { toUserId: user1Id }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userModel, 'findById').mockResolvedValue(null);
      
      await expect(service.sendFriendRequest(user1Id, { toUserId: user2Id }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid user IDs', async () => {
      await expect(service.sendFriendRequest('invalid-id', { toUserId: 'another-invalid' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when users are already friends', async () => {
      // Setup user with existing friend
      const userWithFriend = {
        ...mockUser1,
        Friend_list: [{ _id: new Types.ObjectId(user2Id), Username: 'testUser2' }]
      };
      
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve(userWithFriend) as any;
        if (id === user2Id) return Promise.resolve(mockUser2) as any;
        return Promise.resolve(null);
      });
      
      await expect(service.sendFriendRequest(user1Id, { toUserId: user2Id }))
        .rejects.toThrow(BadRequestException);
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when recipient already sent a request', async () => {
      // Setup user with pending request from recipient
      const userWithPendingRequest = {
        ...mockUser1,
        Friend_requests: [{ 
          from: new Types.ObjectId(user2Id), 
          Username: 'testUser2', 
          status: 'pending' 
        }]
      };
      
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve(userWithPendingRequest) as any;
        if (id === user2Id) return Promise.resolve(mockUser2) as any;
        return Promise.resolve(null);
      });
      
      await expect(service.sendFriendRequest(user1Id, { toUserId: user2Id }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when request already sent', async () => {
      // Setup recipient with pending request from sender
      const recipientWithPendingRequest = {
        ...mockUser2,
        Friend_requests: [{ 
          from: new Types.ObjectId(user1Id), 
          Username: 'testUser1', 
          status: 'pending' 
        }]
      };
      
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve(mockUser1) as any;
        if (id === user2Id) return Promise.resolve(recipientWithPendingRequest) as any;
        return Promise.resolve(null);
      });
      
      await expect(service.sendFriendRequest(user1Id, { toUserId: user2Id }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept a friend request successfully', async () => {
      // Setup mock user with pending request
      const userWithRequest = {
        ...mockUser1,
        Friend_requests: [{ from: new Types.ObjectId(user2Id), Username: 'testUser2', status: 'pending' }]
      };
      
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve(userWithRequest) as any;
        if (id === user2Id) return Promise.resolve(mockUser2) as any;
        return Promise.resolve(null);
      });
      jest.spyOn(userModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);

      const result = await service.acceptFriendRequest(user1Id, { requestId: user2Id });
      
      expect(result).toEqual({ 
        success: true, 
        message: 'Friend request accepted',
        requesterUsername: 'testUser2'
      });
      expect(userModel.updateOne).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when request not found', async () => {
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve({...mockUser1, Friend_requests: []}) as any;
        if (id === user2Id) return Promise.resolve(mockUser2) as any;
        return Promise.resolve(null);
      });

      await expect(service.acceptFriendRequest(user1Id, { requestId: user2Id }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectFriendRequest', () => {
    it('should reject a friend request successfully', async () => {
      // Setup user with pending request
      const userWithRequest = {
        ...mockUser1,
        Friend_requests: [{ from: new Types.ObjectId(user2Id), Username: 'testUser2', status: 'pending' }]
      };
      
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve(userWithRequest) as any;
        return Promise.resolve(null);
      });
      
      jest.spyOn(userModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
      
      const result = await service.rejectFriendRequest(user1Id, { requestId: user2Id });
      
      expect(result).toEqual({ success: true, message: 'Friend request rejected' });
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: user1Id },
        {
          $pull: { 
            Friend_requests: { 
              from: expect.any(Types.ObjectId),
              status: 'pending'
            } 
          }
        }
      );
    });

    it('should throw BadRequestException when request not found', async () => {
      jest.spyOn(userModel, 'findById').mockImplementation((id) => {
        if (id === user1Id) return Promise.resolve({...mockUser1, Friend_requests: []}) as any;
        return Promise.resolve(null);
      });

      await expect(service.rejectFriendRequest(user1Id, { requestId: user2Id }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid user IDs', async () => {
      await expect(service.rejectFriendRequest('invalid-id', { requestId: 'invalid-req' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userModel, 'findById').mockResolvedValue(null);
      
      await expect(service.rejectFriendRequest(user1Id, { requestId: user2Id }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('searchUsers', () => {
    it('should find users matching search term', async () => {
      const mockUsers = [
        { _id: new Types.ObjectId(), Username: 'userMatch', Friend_Code: 'CODE1' },
        { _id: new Types.ObjectId(), Username: 'anotherMatch', Friend_Code: 'CODE2' }
      ];
      
      const mockFindExec = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUsers)
      };
      
      jest.spyOn(userModel, 'find').mockReturnValue(mockFindExec as any);
      
      const result = await service.searchUsers('match', user1Id);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('username', 'userMatch');
      expect(result[1]).toHaveProperty('username', 'anotherMatch');
    });

    it('should throw BadRequestException for invalid user ID', async () => {
      await expect(service.searchUsers('test', 'invalid-id'))
        .rejects.toThrow(BadRequestException);
    });

    it('should return empty array when no matches found', async () => {
      const mockFindExec = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      };
      
      jest.spyOn(userModel, 'find').mockReturnValue(mockFindExec as any);
      
      const result = await service.searchUsers('nomatch', user1Id);
      
      expect(result).toHaveLength(0);
      expect(userModel.find).toHaveBeenCalledWith({
        $or: [
          { Username: { $regex: 'nomatch', $options: 'i' } },
          { Friend_Code: { $regex: 'nomatch', $options: 'i' } }
        ],
        _id: { $ne: expect.any(Types.ObjectId) }
      });
    });
  });

  describe('getFriendRequests', () => {
    it('should return all friend requests for a user', async () => {
      const mockRequests = [
        { from: new Types.ObjectId(), Username: 'requester1', status: 'pending' },
        { from: new Types.ObjectId(), Username: 'requester2', status: 'pending' }
      ];
      
      jest.spyOn(userModel, 'findById').mockResolvedValue({
        ...mockUser1,
        Friend_requests: mockRequests
      } as any);
      
      const result = await service.getFriendRequests(user1Id);
      
      expect(result.requests).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should throw BadRequestException for invalid user ID', async () => {
      await expect(service.getFriendRequests('invalid-id'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userModel, 'findById').mockResolvedValue(null);
      
      await expect(service.getFriendRequests(user1Id))
        .rejects.toThrow(NotFoundException);
    });

    it('should return empty requests array when user has no requests', async () => {
      jest.spyOn(userModel, 'findById').mockResolvedValue({
        ...mockUser1,
        Friend_requests: []
      } as any);
      
      const result = await service.getFriendRequests(user1Id);
      
      expect(result.requests).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });
});
