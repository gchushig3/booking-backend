import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObservabilidadEvento } from '../atracciones/entities/observabilidad-evento.entity';
import { AdminTelemetryController, TelemetryController } from './observabilidad.controller';
import { ObservabilidadService } from './observabilidad.service';
@Module({ imports: [TypeOrmModule.forFeature([ObservabilidadEvento])], controllers: [TelemetryController, AdminTelemetryController], providers: [ObservabilidadService] })
export class ObservabilidadModule {}
