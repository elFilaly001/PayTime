import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

@Module({})
export class StripeModule {

  static forRootAsync(): DynamicModule {
    return {
      module: StripeModule,
      imports: [ConfigModule],
      controllers: [StripeController],
      providers: [
        {
          provide: 'STRIPE_API_KEY',
          useFactory: (configService: ConfigService) => configService.get('STRIPE_SECRET_KEY'),
          inject: [ConfigService],
        },
        StripeService,
      ],
      exports: [StripeService],
      global: true
    };
  }
}
