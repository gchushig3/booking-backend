import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { configureSwagger } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  const configuredOrigins = (process.env.CORS_ORIGIN ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4200'))
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: configuredOrigins.length ? configuredOrigins : false, credentials: true });
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  configureSwagger(app);
  await app.listen(process.env.PORT || 3000);
}

void bootstrap();
