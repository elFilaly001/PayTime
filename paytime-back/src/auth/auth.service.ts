import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RegisterDto, LoginDto } from './dtos/Auth.dto';
import { Exist } from 'src/Helpers/Exist.helper';
import { JWTHelperService } from 'src/Helpers/JWT.helpers';
import  {MailHelper}  from 'src/Helpers/Mail.helper';
import { ConfigService } from '@nestjs/config';
import {VerifyPassword} from 'src/Helpers/Auth.helper';


@Injectable()
export class AuthService {
    constructor(
        @InjectModel('Auth') private readonly AuthModel: any,
        private jwtHelper: JWTHelperService,
        private configService: ConfigService
    ) {}
    
    async Register(Data: RegisterDto) {
        await Exist(this.AuthModel, { Username: Data.Username }, false);
        await Exist(this.AuthModel, { Email: Data.Email }, false);
        
        try {
            const user = await this.AuthModel.create(Data);
            const mailHelper = new MailHelper(this.configService);
            await mailHelper.sendVerificationEmail(user.Email, user.VerificationToken);
            return user
        } catch (error) {
            throw error
        }
    }

    async Login(Data: LoginDto) {
        const user = await Exist(this.AuthModel, { Email: Data.Email }, true);
        if (!VerifyPassword(Data.Password, user.Password)) throw new BadRequestException('Invalid Password');
        const RefreshToken = await this.jwtHelper.createRefreshToken(user.id);
        const AccessToken = await this.jwtHelper.createAccessToken(user.id);

        return { User: user, Refresh: RefreshToken, Access: AccessToken };
    }


    async RefreshToken(RefreshToken: string) {
        try {
            const user = await this.jwtHelper.verifyToken(RefreshToken);
            const AccessToken = await this.jwtHelper.createAccessToken(user);
            return { Access: AccessToken };
        } catch (error) {
            throw error;
        }
    }

    

}
