import { BadRequestException, Injectable } from '@nestjs/common';
import { PaqueteExperiencia } from './entities/paquete-experiencia.entity';

export interface ChildParticipant { edad: number }
export interface PricingBreakdown {
  numAdultos: number;
  numNinos: number;
  totalCuposOcupados: number;
  precioUnitario: number;
  subtotal: number;
  descuentos: number;
  montoTotal: number;
  currency: string;
}

@Injectable()
export class PricingService {
  calculate(pkg: PaqueteExperiencia, numAdultos: number, ninos: ChildParticipant[]): PricingBreakdown {
    if (!Number.isInteger(numAdultos) || numAdultos < 0 || !Array.isArray(ninos) || numAdultos + ninos.length < 1) {
      throw new BadRequestException('Debe incluir al menos un participante y cantidades enteras válidas.');
    }
    for (const child of ninos) {
      if (!Number.isInteger(child?.edad) || child.edad < 0 || child.edad > 17) {
        throw new BadRequestException('Cada niño debe tener una edad entera entre 0 y 17 años.');
      }
    }
    const price = Number(pkg.precioUnitario);
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException('El paquete tiene un precio inválido.');
    const policies = pkg.politicasJson ?? {};
    const rawFreeAge = policies.edad_nino_gratis_hasta;
    const freeAge = rawFreeAge === undefined ? -1 : Number(rawFreeAge);
    if (!Number.isInteger(freeAge) || freeAge < -1 || freeAge > 17) {
      throw new BadRequestException('La política edad_nino_gratis_hasta debe ser un entero entre 0 y 17.');
    }
    const paidChildren = ninos.filter(({ edad }) => edad > freeAge).length;
    const subtotal = Math.round((numAdultos + ninos.length) * price * 100) / 100;
    const total = Math.round((numAdultos + paidChildren) * price * 100) / 100;
    return {
      numAdultos, numNinos: ninos.length, totalCuposOcupados: numAdultos + ninos.length,
      precioUnitario: price, subtotal, descuentos: Math.round((subtotal - total) * 100) / 100,
      montoTotal: total, currency: 'USD',
    };
  }
}
