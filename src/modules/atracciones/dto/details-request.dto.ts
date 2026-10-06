import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ProductType } from './create-atraccion.dto';

export class DetailsRequestDto {
  @ApiProperty({ description: 'IDs de atracciones almacenadas como UUID; el DTO valida strings, no el formato UUID.', type: [String], example: ['8f45c29f-744d-4308-b2fa-b5d2222c7ab7'] })
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
