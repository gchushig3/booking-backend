import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateComentarioDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  reservation_id: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 }) @IsInt() @Min(1) @Max(5)
  puntuacion: number;

  @ApiProperty({ minLength: 3, maxLength: 3000 }) @IsString() @MinLength(3) @MaxLength(3000)
  comentario: string;
}

export class ComentarioResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) atraccion_id: string;
  @ApiProperty({ format: 'uuid', required: false }) reserva_id: string | null;
  @ApiProperty({ minimum: 1, maximum: 5 }) puntuacion: number;
  @ApiProperty() comentario: string;
  @ApiProperty() fecha_creacion: Date;
}
