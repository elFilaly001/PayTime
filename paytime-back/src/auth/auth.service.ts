import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RegisterDto, LoginDto } from './dtos/Auth.dto';
import { Exist } from 'src/Helpers/Exist.helper';
import { JWTHelperService } from 'src/Helpers/JWT.helpers';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel('Auth') private readonly AuthModel: any,
        private jwtHelper: JWTHelperService
    ) {}

    async Register(Data: RegisterDto) {
        await Exist(this.AuthModel, { Username: Data.Username }, false);
        await Exist(this.AuthModel, { Email: Data.Email }, false);
        
        try {
            const user = await this.AuthModel.create(Data);
            return user
        } catch (error) {
            throw error
        }
    }

    async Login(Data: LoginDto) {
        const user = await Exist(this.AuthModel, { Email: Data.Email }, true);
        const RefreshToken = await this.jwtHelper.createRefreshToken(user.id);
        const AccessToken = await this.jwtHelper.createAccessToken(user.id);

        return { User: user, Refresh: RefreshToken, Access: AccessToken };
    }


    async RefreshToken(RefreshToken: string) {
        try {
            const user = this.jwtHelper.verifyToken(RefreshToken);
            const AccessToken = this.jwtHelper.createAccessToken(user);
            return {User: user, Refresh: RefreshToken, Access: AccessToken};
        } catch (error) {
            throw error;
        }
    }
}
