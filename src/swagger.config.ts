import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorResponseDto } from './common/dto/api-error-response.dto';

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Booking Prototipo API')
    .setDescription('APIs activas de autenticación, atracciones, reservas, comentarios, ADMIN y observabilidad. Errores: 400 (validación), 401 (JWT), 403 (rol o propiedad), 404 (recurso), 409 (conflicto) y 429 (rate limiting). Las rutas administrativas requieren Bearer JWT y rol ADMIN. Solo se incluyen módulos montados; la cancelación y el checkout tienen semánticas de idempotencia distintas, descritas en cada operación.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'JWT-auth')
    .build();

  const document = SwaggerModule.createDocument(app, config, { extraModels: [ApiErrorResponseDto] });
  // These response schemas describe the existing global guards/exceptions.
  // They do not install handlers or change response serialization.
  for (const path of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const) {
      const operation = path[method];
      if (!operation) continue;
      operation.responses['429'] ??= { description: 'Rate limiting por IP: 100 solicitudes/minuto por defecto; ingesta 20 lotes/minuto y observabilidad ADMIN 60 solicitudes/minuto.' };
      for (const [status, response] of Object.entries(operation.responses)) {
        if (Number(status) >= 400 && !('$ref' in response)) {
          response.content ??= { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponseDto' } } };
        }
      }
    }
  }
  SwaggerModule.setup('api/docs', app, document);
}
