import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtraccionesController } from './atracciones.controller';
import { AtraccionesService } from './atracciones.service';
import { Atraccion } from './entities/atraccion.entity';
import { Reserva } from './entities/reserva.entity';
import { AtraccionesSeeder } from './atracciones.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([Atraccion, Reserva])],
  controllers: [AtraccionesController],
  providers: [AtraccionesService, AtraccionesSeeder,],
  exports: [AtraccionesService],
})
export class AtraccionesModule {}
