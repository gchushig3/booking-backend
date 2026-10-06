import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsISO8601, IsObject, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export const CATEGORIES = ['PERFORMANCE', 'ERROR', 'RESOURCE_ERROR', 'INTERACTION', 'VISIBILITY', 'VIEWPORT', 'CONNECTION', 'CAPABILITY', 'HTTP', 'DOMAIN'] as const;
export type Category = typeof CATEGORIES[number];
export const TYPES: Record<Category, readonly string[]> = {
  PERFORMANCE: ['navigation_timing', 'route_navigation'], ERROR: ['window_error', 'angular_error', 'unhandled_rejection'],
  RESOURCE_ERROR: ['resource_error'], INTERACTION: ['click'], VISIBILITY: ['visibility_change'],
  VIEWPORT: ['viewport'], CONNECTION: ['connection'], CAPABILITY: ['capabilities'], HTTP: ['http_request', 'http_error'], DOMAIN: ['application_event'],
};
export class BrowserEventDto {
  @ApiProperty({ enum: CATEGORIES }) @IsIn(CATEGORIES) category: Category;
  @ApiProperty({ description: 'Tipo permitido para la categoría.', maxLength: 50 }) @IsString() @MaxLength(50) type: string;
  @ApiProperty({ format: 'date-time' }) @IsISO8601() timestamp: string;
  @ApiProperty({ maxLength: 200 }) @IsString() @MaxLength(200) route: string;
  @ApiProperty({ format: 'uuid', description: 'Identificador aleatorio en memoria, sin identidad de usuario.' }) @IsUUID('4') sessionId: string;
  @ApiProperty({ description: 'Solo campos técnicos permitidos; plano, máximo 2 KiB.' }) @IsObject() payload: Record<string, unknown>;
}
export class BrowserBatchDto {
  @ApiProperty({ type: [BrowserEventDto], minItems: 1, maxItems: 20 })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BrowserEventDto)
  events: BrowserEventDto[];
}
export class TelemetryAcceptedDto {
  @ApiProperty({ example: 3 }) accepted: number;
}
export class PersistedBrowserEventDto extends BrowserEventDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'date-time', description: 'Fecha del servidor; timestamp es reportado por el navegador.' }) receivedAt: string;
}
export class TelemetrySummaryDto {
  @ApiProperty() sampleSize: number;
  @ApiProperty({ example: 100 }) sampleLimit: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, description: 'Conteos de eventos por categoría dentro de la muestra.' }) counts: Record<string, number>;
  @ApiProperty() navigationSamples: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Media de loadMs; null si hay menos de dos navegaciones completas.' }) averageLoadMs: number | null;
}
export class TelemetrySnapshotDto {
  @ApiProperty({ type: [PersistedBrowserEventDto] }) events: PersistedBrowserEventDto[];
  @ApiProperty({ type: TelemetrySummaryDto }) summary: TelemetrySummaryDto;
  @ApiProperty({ format: 'date-time' }) generatedAt: string;
}
