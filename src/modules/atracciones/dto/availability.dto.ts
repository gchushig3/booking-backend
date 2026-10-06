import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from './create-atraccion.dto';

export class AvailabilityResponseDto {
  @ApiProperty({ description: 'Fecha de disponibilidad', example: '2026-10-10', format: 'date' })
  date: string;

  @ApiProperty({ description: 'Cupos disponibles para el turno indicado; si se omite hora, máximo disponible entre turnos.', example: 12, minimum: 0 })
  available_spots: number;

  @ApiProperty({ description: 'Horarios con al menos un cupo disponible para la fecha.', type: [String], example: ['10:00', '14:00'] })
  times: string[];

  @ApiPropertyOptional({ description: 'Modalidad consultada.', enum: ProductType, example: ProductType.GUIDED_TOUR })
  product_type?: ProductType;

  @ApiPropertyOptional({ description: 'Turno consultado; si se omite, available_spots es el máximo de los horarios.', example: '10:00' })
  time?: string;
}
