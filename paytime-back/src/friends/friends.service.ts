import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthDocument, Auth as User } from '../auth/Schema/Auth.schema';
import { FriendRequestActionDto, FriendRequestDto } from './dto/Friends.dto';

@Injectable()
export class FriendsService {
  private readonly logger = new Logger('FriendsService');

  constructor(
    @InjectModel(User.name) private userModel: Model<AuthDocument>,
  ) {}

  async sendFriendRequest(fromUserId: string, data: FriendRequestDto) {
    this.logger.debug(`Attempting to send friend request from ${fromUserId} to ${data.toUserId}`);
    
    if (!Types.ObjectId.isValid(fromUserId) || !Types.ObjectId.isValid(data.toUserId)) {
      throw new BadRequestException('Invalid user IDs');
    }

    // Check if users exist
    const fromUser = await this.userModel.findById(fromUserId);
    const toUser = await this.userModel.findById(data.toUserId);

    if (!fromUser || !toUser) {
      throw new NotFoundException('One or both users not found');
    }

    // Prevent sending friend request to self
    if (fromUserId === data.toUserId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    // Check if they're already friends (more thorough check)
    const alreadyFriends = fromUser.Friend_list.some(
      friend => friend._id?.toString() === data.toUserId || 
                friend.toString() === data.toUserId
    );

    if (alreadyFriends) {
      throw new BadRequestException('Already friends with this user');
    }

    // Check if the recipient has already sent a request to the sender
    const recipientRequestedSender = fromUser.Friend_requests.some(
      req => req.from.toString() === data.toUserId && req.status === 'pending'
    );

    if (recipientRequestedSender) {
      throw new BadRequestException('This user has already sent you a friend request. Accept it instead.');
    }

    // Check if sender already sent a request to recipient
    const existingRequest = toUser.Friend_requests.find(
      req => req.from.toString() === fromUserId && req.status === 'pending'
    );

    if (existingRequest) {
      throw new BadRequestException('Friend request already sent');
    }

    // Add the friend request to recipient's list
    const result = await this.userModel.updateOne(
      { _id: data.toUserId },
      {
        $push: {
          Friend_requests: {
            from: new Types.ObjectId(fromUserId),
            Username: fromUser.Username,
            status: 'pending',
            createdAt: new Date()
          }
        }
      }
    );

    this.logger.log(`Friend request sent from ${fromUserId} to ${data.toUserId}. DB result: ${JSON.stringify(result)}`);

    return { success: true, message: 'Friend request sent' };
  }

  async acceptFriendRequest(userId: string, data: FriendRequestActionDto) {
    this.logger.debug(`Attempting to accept friend request from ${data.requestId} by ${userId}`);
    
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(data.requestId)) {
      throw new BadRequestException('Invalid user or request ID');
    }

    // Get the user who is accepting the request
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get the user who sent the request
    const requester = await this.userModel.findById(data.requestId);
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    // Find the friend request
    const requestIndex = user.Friend_requests.findIndex(
      req => req.from.toString() === data.requestId && req.status === 'pending'
    );

    if (requestIndex === -1) {
      throw new BadRequestException('Friend request not found');
    }

    // Get the requester's username
    const requesterUsername = requester.Username || user.Friend_requests[requestIndex].Username;

    // 1. Remove the friend request from the recipient
    const updateRecipient = await this.userModel.updateOne(
      { _id: userId },
      {
        $pull: { 
          Friend_requests: { 
            from: new Types.ObjectId(data.requestId),
            status: 'pending'
          } 
        },
        $addToSet: { 
          Friend_list: {
            _id: new Types.ObjectId(data.requestId),
            Username: requesterUsername
          } 
        }
      }
    );

    // 2. Add the recipient to the requester's friend list with username
    const updateRequester = await this.userModel.updateOne(
      { _id: data.requestId },
      {
        $addToSet: { 
          Friend_list: {
            _id: new Types.ObjectId(userId),
            Username: user.Username
          } 
        }
      }
    );

    this.logger.log(`Friend request accepted: ${userId} accepted ${data.requestId}`);
    this.logger.debug(`Recipient update result: ${JSON.stringify(updateRecipient)}`);
    this.logger.debug(`Requester update result: ${JSON.stringify(updateRequester)}`);

    return { 
      success: true,
      message: 'Friend request accepted',
      requesterUsername
    };
  }

  async rejectFriendRequest(userId: string, data: FriendRequestActionDto) {
    this.logger.debug(`Attempting to reject friend request from ${data.requestId} by ${userId}`);
    
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(data.requestId)) {
      throw new BadRequestException('Invalid user or request ID');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const requestIndex = user.Friend_requests.findIndex(
      req => req.from.toString() === data.requestId && req.status === 'pending'
    );

    if (requestIndex === -1) {
      throw new BadRequestException('Friend request not found');
    }

    const result = await this.userModel.updateOne(
      { _id: userId },
      {
        $pull: { 
          Friend_requests: { 
            from: new Types.ObjectId(data.requestId),
            status: 'pending'
          } 
        }
      }
    );

    this.logger.log(`Friend request rejected: ${userId} rejected ${data.requestId}`);
    this.logger.debug(`Rejection result: ${JSON.stringify(result)}`);

    return { success: true, message: 'Friend request rejected' };
  }

  async searchUsers(searchTerm: string, currentUserId: string) {
    this.logger.debug(`Searching users with term: ${searchTerm} , current user: ${currentUserId}`);

    if (!Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Invalid user ID');
    }

    
    const searchQuery = {
      $or: [
        { Username: { $regex: searchTerm, $options: 'i' } },
        { Friend_Code: { $regex: searchTerm, $options: 'i' } }
      ],
      _id: { $ne: new Types.ObjectId(currentUserId) }
    };

    const users = await this.userModel
      .find(searchQuery)
      .select('Username Friend_Code')
      .exec();

    return users.map(user => ({
      id: user._id,
      username: user.Username,
      friendCode: user.Friend_Code
    }));
  }


  async getFriendRequests(userId: string) {
    this.logger.debug(`Getting friend requests for user: ${userId}`);

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Log what we found
    this.logger.debug(`Found ${user.Friend_requests?.length || 0} friend requests`);
    
    // Enhanced response for debugging
    return {
      requests: user.Friend_requests || [],
      count: user.Friend_requests?.length || 0,
      userId: userId
    };
  }
}