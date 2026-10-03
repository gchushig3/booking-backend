import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ProductType } from './create-atraccion.dto';

export class GetAtraccionesFilterDto {
  @ApiPropertyOptional({ description: 'Página actual', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Elementos por página', default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Tipo de producto', enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  product_type?: ProductType;
}