import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Documentation only: Nest exceptions and the existing domain error objects. */
export class ApiErrorResponseDto {
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Mensaje del error; array cuando falla ValidationPipe.' })
  message: string | string[];
  @ApiPropertyOptional({ type: 'integer', description: 'Presente en las excepciones HTTP estándar de Nest.' }) statusCode?: number;
  @ApiPropertyOptional({ description: 'Nombre del error HTTP estándar.' }) error?: string;
  @ApiPropertyOptional({ description: 'Código de dominio cuando la implementación lo proporciona; p. ej. IDEMPOTENCY_KEY_REUSED.' }) code?: string;
}
