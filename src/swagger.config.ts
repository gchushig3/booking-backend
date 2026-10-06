import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Booking Prototipo API')
    .setDescription('API activa del módulo de atracciones. Errores: 400 (validación), 401 (JWT), 403 (rol o propiedad), 404 (recurso) y 409 (disponibilidad, pago o idempotencia). Las rutas administrativas requieren Bearer JWT y rol ADMIN.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'JWT-auth')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
