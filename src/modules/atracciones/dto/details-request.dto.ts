import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ProductType } from './create-atraccion.dto';

export class DetailsRequestDto {
  @ApiProperty({ description: 'Array de IDs de atracciones', example: ['PRahAzWtTraa'] })
  @IsArray()
  @IsString({ each: true })
  attractions: string[];

  @ApiProperty({ description: 'Idiomas solicitados', example: ['en-gb'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @ApiProperty({ description: 'Filtra por tipo de producto', enum: ProductType, required: false, example: ProductType.GUIDED_TOUR })
  @IsEnum(ProductType)
  @IsOptional()
  product_type?: ProductType;
}
