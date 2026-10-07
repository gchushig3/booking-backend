import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ProductType } from './create-atraccion.dto';

export class SaveExperienceDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(100) nombre_paquete: string;
  @ApiProperty({ enum: ProductType }) @IsEnum(ProductType) tipo_experiencia: ProductType;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999.99) precio_unitario: number;
  @ApiProperty() @IsInt() @Min(1) min_participantes: number;
  @ApiProperty({ type: Number, required: false, nullable: true }) @IsOptional() @IsInt() @Min(1) max_participantes?: number | null;
}
export class SaveSlotDto {
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @ApiProperty() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time: string;
  @ApiProperty() @IsInt() @Min(0) capacidad_total: number;
}
