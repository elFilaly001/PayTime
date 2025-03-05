import { Controller, Post, Body, Req, UseGuards, Logger } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendRequestActionDto, FriendRequestDto, SearchUsersDto } from './dto/Friends.dto';
import { AuthGuard } from '../auth/auth.guard';
import { FriendsGateway } from './friends.gateway';

@Controller('friends')
export class FriendsController {
  private readonly logger = new Logger('FriendsController');

  constructor(
    private readonly friendsService: FriendsService,
    private readonly friendsGateway: FriendsGateway  
  ) {}

  @Post("add-friend")
  @UseGuards(AuthGuard)
  async addFriend(@Req() req, @Body() friendRequestDto: FriendRequestDto) { 
    this.logger.log(`Friend request received via REST API: ${req.user.id} -> ${friendRequestDto.toUserId}`);
    
    // Process the request through the service
    const result = await this.friendsService.sendFriendRequest(req.user.id, friendRequestDto);
    const fromUser = await this.friendsGateway.getUserById(req.user.id);
    
    // Notify the recipient through the gateway if they're online
    if (fromUser) {
      this.friendsGateway.notifyUserOfFriendRequest(
        friendRequestDto.toUserId, 
        req.user.id, 
        fromUser.Username
      );
    }
    
    return result;
  }

  @Post('accept-friend-request')
  @UseGuards(AuthGuard)
  async acceptFriendRequest(@Req() req, @Body() friendRequestActionDto: FriendRequestActionDto) { 
    this.logger.log(`Friend request accept via REST API: ${req.user.id} accepts ${friendRequestActionDto.requestId}`);
    
    const result = await this.friendsService.acceptFriendRequest(req.user.id, friendRequestActionDto);
    
    // Notify both users through the gateway
    const currentUser = await this.friendsGateway.getUserById(req.user.id);
    if (currentUser) {
      this.friendsGateway.notifyUserOfAcceptedRequest(
        friendRequestActionDto.requestId,
        req.user.id,
        currentUser.Username
      );
    }
    
    return result;
  }

  @Post('reject-friend-request')
  @UseGuards(AuthGuard)
  async rejectFriendRequest(@Req() req, @Body() friendRequestActionDto: FriendRequestActionDto) { 
    this.logger.log(`Friend request reject via REST API: ${req.user.id} rejects ${friendRequestActionDto.requestId}`);
    
    return this.friendsService.rejectFriendRequest(req.user.id, friendRequestActionDto);
  }

  @Post('search')
  @UseGuards(AuthGuard)
  async searchUsers(@Req() req, @Body() searchDto: SearchUsersDto) {
    this.logger.log(`User search request received via REST API from user: ${req.user.id}`);
    return this.friendsService.searchUsers(searchDto.searchTerm, req.user.id);
  }
}