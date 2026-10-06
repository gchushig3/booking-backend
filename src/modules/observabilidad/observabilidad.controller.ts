import { Body, Controller, Get, HttpCode, Post, Sse } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth/public.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { BrowserBatchDto, TelemetryAcceptedDto, TelemetrySnapshotDto, TelemetrySummaryDto } from './telemetry.dto';
import { ObservabilidadService } from './observabilidad.service';

@ApiTags('Observabilidad')
@Controller('observabilidad')
export class TelemetryController {
  constructor(private readonly service: ObservabilidadService) {}
  @Public() @Post('eventos') @HttpCode(202)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Ingesta pública limitada de eventos de navegador', description: 'Telemetría no verificada, sin identidad de usuario. Máximo 20 eventos, 2 KiB por payload, 48 KiB por batch y 20 batches/minuto por IP. No acepta datos arbitrarios.' })
  @ApiBody({ type: BrowserBatchDto }) @ApiResponse({ status: 202, type: TelemetryAcceptedDto, description: 'Batch persistido.' })
  @ApiBadRequestResponse({ description: 'DTO, categoría, tipo, tamaño o payload inválido.' })
  @ApiResponse({ status: 429, description: 'Límite de ingesta excedido.' })
  ingest(@Body() batch: BrowserBatchDto) { return this.service.ingest(batch); }
}
@ApiTags('Observabilidad ADMIN') @ApiBearerAuth('JWT-auth') @Roles('ADMIN')
@Throttle({ default: { limit: 60, ttl: 60000 } })
@ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' }) @ApiForbiddenResponse({ description: 'Solo ADMIN.' })
@Controller('admin/observabilidad')
export class AdminTelemetryController {
  constructor(private readonly service: ObservabilidadService) {}
  @Sse('stream')
  @ApiOperation({ summary: 'Stream SSE de snapshots persistidos; JWT ADMIN en Authorization', description: 'Evento snapshot con JSON tras persistencia; reconciliacion cada 15 segundos. Reconectar cada 55 segundos para revalidar JWT. Sin tokens en URL.' })
  @ApiOkResponse({ description: 'text/event-stream; event: snapshot; data: TelemetrySnapshotDto.', content: { 'text/event-stream': { schema: { type: 'string' } } } })
  stream() { return this.service.stream(); }
  @Get('eventos') @ApiOperation({ summary: 'Últimos 100 eventos de navegador persistidos y resumen de la muestra' }) @ApiOkResponse({ type: TelemetrySnapshotDto, description: 'Eventos sanitizados y métricas reales de la muestra.' })
  recent() { return this.service.recent(); }
  @Get('resumen') @ApiOperation({ summary: 'Resumen de los últimos 100 eventos de navegador' }) @ApiOkResponse({ type: TelemetrySummaryDto, description: 'Conteos y promedio de carga si existen al menos dos navegaciones.' })
  async summary() { return (await this.service.recent()).summary; }
}
