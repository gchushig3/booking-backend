import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtraccionesController } from './atracciones.controller';
import { AtraccionesService } from './atracciones.service';
import { Atraccion } from './entities/atraccion.entity';
import { Reserva } from './entities/reserva.entity';
import { DisponibilidadTurno } from './entities/disponibilidad-turno.entity';
import { PaqueteExperiencia } from './entities/paquete-experiencia.entity';
import { Pago } from './entities/pago.entity';
import { Comentario } from './entities/comentario.entity';
import { ObservabilidadEvento } from './entities/observabilidad-evento.entity';
import { PricingService } from './pricing.service';
import { PaymentService } from './payments/payment.service';
import { MockPaymentProvider } from './payments/mock-payment.provider';
import { PAYMENT_PROVIDER } from './payments/payment-provider.interface';
import { AdminReservasController } from './admin-reservas.controller';
import { ComentariosController } from './comentarios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Atraccion, Reserva, DisponibilidadTurno, PaqueteExperiencia, Pago, Comentario, ObservabilidadEvento])],
  controllers: [AtraccionesController, AdminReservasController, ComentariosController],
  providers: [AtraccionesService, PricingService, PaymentService, MockPaymentProvider, { provide: PAYMENT_PROVIDER, useExisting: MockPaymentProvider }],
  exports: [AtraccionesService],
})
export class AtraccionesModule {}
