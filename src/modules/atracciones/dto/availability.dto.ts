import { ApiProperty } from '@nestjs/swagger';
import { ProductType } from './create-atraccion.dto';

export class AvailabilityResponseDto {
  @ApiProperty({ description: 'Fecha de disponibilidad', example: '2026-10-10', format: 'date' })
  date: string;

  @ApiProperty({ description: 'Cupos disponibles', example: 45 })
  available_spots: number;

  @ApiProperty({ description: 'Horarios de inicio disponibles', example: ['10:00', '14:00'] })
  times: string[];

  @ApiProperty({ description: 'Modalidad consultada', enum: ProductType, required: false })
  product_type?: ProductType;

  @ApiProperty({ description: 'Turno consultado', required: false, example: '09:00' })
  time?: string;
}
