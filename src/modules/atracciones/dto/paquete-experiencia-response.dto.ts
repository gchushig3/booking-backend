import { ApiProperty } from '@nestjs/swagger';
import { ProductType } from './create-atraccion.dto';

export class PaqueteExperienciaResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) atraccion_id: string;
  @ApiProperty({ enum: ProductType }) tipo_experiencia: ProductType;
  @ApiProperty({ example: 'Experiencia GUIDED_TOUR' }) nombre_paquete: string;
  @ApiProperty({ type: String, nullable: true }) descripcion: string | null;
  @ApiProperty({ minimum: 0, example: 35.5 }) precio_unitario: number;
  @ApiProperty({ example: 'USD' }) moneda: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) min_participantes: number;
  @ApiProperty({ type: 'integer', minimum: 1, nullable: true }) max_participantes: number | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) politicas_json: Record<string, unknown>;
}
