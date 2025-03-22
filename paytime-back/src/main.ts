import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(cookieParser(process.env.COOKIE_SECRET || 'your-secret-key'));
  
  app.enableCors({
    origin: 
      // Include all common development origins
      ['http://172.27.160.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT ?? 3000); 
}
bootstrap();
