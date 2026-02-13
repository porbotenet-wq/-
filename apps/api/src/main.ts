import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: '*' });

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`[STSphera API] Running on port ${port}`);
}

bootstrap();
