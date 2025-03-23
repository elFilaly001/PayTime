import { IsString, IsNotEmpty } from 'class-validator';

export class FriendRequestActionDto {
    @IsString()
    @IsNotEmpty()
    requestId: string;
  }

  export class FriendRequestDto {
    @IsString()
    @IsNotEmpty()
    toUserId: string;
  }

  export class SearchUsersDto {
    @IsString()
    @IsNotEmpty()
    searchTerm: string;
  }