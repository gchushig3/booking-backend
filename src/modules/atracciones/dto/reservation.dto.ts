import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsEmail, IsOptional, IsEnum, IsArray, ValidateNested, Max, Matches, MaxLength, IsIn, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PriceDto } from './nested-types.dto';
import { ProductType } from './create-atraccion.dto';

export class ReservationRequestDto {
  @ApiProperty({ description: 'UUID del paquete seleccionado. Determina modalidad, precio, limites y politicas desde PostgreSQL.', format: 'uuid' })
  @IsUUID()
  paquete_id: string;

  @ApiProperty({ description: 'Fecha de la reserva.', example: '2026-10-10', format: 'date' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ description: 'Hora de inicio del turno seleccionado.', example: '10:00' })
  @IsString()
  @IsOptional()
  time?: string;

  @ApiPropertyOptional({ description: 'Compatibilidad; se interpreta como número de adultos cuando num_adultos no se envía.', example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  ticket_count?: number;

  @ApiPropertyOptional({ description: 'Número de adultos.', example: 2, minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  num_adultos?: number;

  @ApiPropertyOptional({ description: 'Niños participantes. El backend calcula precio y cupos a partir de sus edades y política del paquete.', type: () => [ChildDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChildDto)
  ninos?: ChildDto[];

  @ApiPropertyOptional({ description: 'Método del proveedor mock.', enum: ['CREDIT_CARD', 'PAYPAL'] })
  @IsOptional() @IsIn(['CREDIT_CARD', 'PAYPAL'])
  metodo_pago?: 'CREDIT_CARD' | 'PAYPAL';

  @ApiPropertyOptional({ description: 'Titular; no se procesa ni almacena PAN o CVV.', maxLength: 150 })
  @IsOptional() @IsString() @MaxLength(150)
  titular_tarjeta?: string;

  @ApiPropertyOptional({ description: 'Solo los últimos cuatro dígitos. Nunca enviar PAN completo ni CVV.', example: '4242', pattern: '^\\d{4}$' })
  @IsOptional() @Matches(/^\d{4}$/)
  ultimos_cuatro_digitos?: string;

  @ApiPropertyOptional({ description: 'Compatibilidad: si se envia, debe coincidir con tipo_experiencia del paquete_id. El servidor deriva la modalidad del paquete.', enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  product_type?: ProductType;

  @ApiProperty({ description: 'Nombre completo del cliente.', example: 'Juan Perez' })
  @IsString()
  customer_name: string;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  @IsEmail()
  @IsOptional()
  customer_email?: string;
}

export enum ReservationStatus {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  CANCELADA = 'CANCELADA',
}

export class ReservationPaymentResponseDto {
  @ApiProperty({ enum: ['SUCCESS'], example: 'SUCCESS' }) status: 'SUCCESS';
  @ApiProperty({ enum: ['CREDIT_CARD', 'PAYPAL'] }) metodo_pago: 'CREDIT_CARD' | 'PAYPAL';
  @ApiProperty({ example: 60 }) monto_pagado: number;
  @ApiProperty({ description: 'Referencia de transacción mock.' }) transaccion_hash: string;
  @ApiProperty({ format: 'date-time' }) fecha_pago: Date;
}

export class ReservationAttractionResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ format: 'url' }) image_url?: string;
}

export class ReservationResponseDto {
  @ApiProperty({ description: 'ID único de reserva.', format: 'uuid' }) reservation_id: string;
  @ApiProperty({ description: 'Estado persistido de la reserva.', enum: ReservationStatus, example: ReservationStatus.CONFIRMADA }) status: ReservationStatus;
  @ApiProperty({ example: 2 }) ticket_count: number;
  @ApiProperty({ example: 2 }) num_adultos: number;
  @ApiProperty({ example: 1 }) num_ninos: number;
  @ApiProperty({ example: 3 }) total_cupos_ocupados: number;
  @ApiProperty({ enum: ProductType }) product_type: ProductType;
  @ApiProperty({ type: PriceDto }) total_price: PriceDto;
  @ApiPropertyOptional({ description: 'Presente en la respuesta del checkout; no contiene datos sensibles de tarjeta.', type: ReservationPaymentResponseDto }) payment?: ReservationPaymentResponseDto;
  @ApiProperty({ example: '2026-10-10', format: 'date' }) date: string;
  @ApiPropertyOptional({ example: '10:00' }) time?: string;
  @ApiProperty({ type: ReservationAttractionResponseDto }) attraction: ReservationAttractionResponseDto;
}

export class ChildDto {
  @ApiProperty({ description: 'Edad individual del niño; rango 0 a 17 años.', example: 8, minimum: 0, maximum: 17 })
  @IsInt() @Min(0) @Max(17)
  edad: number;
}

export class CancelReservationRequestDto {
  @ApiProperty({ description: 'Razón de la cancelación.', example: 'Plan cancelado' })
  @IsString()
  reason: string;
}
