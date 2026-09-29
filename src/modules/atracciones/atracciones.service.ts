import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Atraccion } from './entities/atraccion.entity';
import { Reserva } from './entities/reserva.entity';

import { CreateAtraccionDto, ProductType } from './dto/create-atraccion.dto';
import { UpdateAtraccionDto } from './dto/update-atraccion.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SearchAtraccionesDto } from './dto/search-atracciones.dto';
import { DetailsRequestDto } from './dto/details-request.dto';
import { AvailabilityResponseDto } from './dto/availability.dto';
import {
  ReservationRequestDto,
  ReservationResponseDto,
  ReservationStatus,
  CancelReservationRequestDto,
} from './dto/reservation.dto';

@Injectable()
export class AtraccionesService {
  private readonly uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    @InjectRepository(Atraccion)
    private readonly atraccionRepository: Repository<Atraccion>,

    @InjectRepository(Reserva)
    private readonly reservaRepository: Repository<Reserva>,
  ) {}

  private validateIdempotencyKey(idempotencyKey?: string): void {
    if (!idempotencyKey || !this.uuidV4Regex.test(idempotencyKey.trim())) {
      throw new BadRequestException('El encabezado Idempotency-Key debe ser un UUID v4 válido');
    }
  }

  private normalizePrice(price?: { currency?: string; total?: number } | null): { currency: string; total: number } {
    return {
      currency: price?.currency || 'USD',
      total: Number(price?.total ?? 0),
    };
  }

  private normalizeOperator(operator?: { id?: number; name?: string } | null): { id: number; name: string } {
    return {
      id: Number(operator?.id ?? 0),
      name: operator?.name || 'Operador no definido',
    };
  }

  private parseDurationHours(duration?: string): number {
    if (!duration) {
      return 2;
    }

    const match = duration.match(/PT(?:(\d+)H)?/i);
    return match && match[1] ? Number(match[1]) : 2;
  }

  private getProductRules(productType: ProductType): { baseCapacity: number; minParticipants: number; maxParticipants: number } {
    switch (productType) {
      case ProductType.SINGLE_TICKET:
        return { baseCapacity: 60, minParticipants: 1, maxParticipants: 20 };
      case ProductType.GUIDED_TOUR:
        return { baseCapacity: 25, minParticipants: 2, maxParticipants: 20 };
      case ProductType.PACKAGE:
        return { baseCapacity: 15, minParticipants: 1, maxParticipants: 12 };
      default:
        return { baseCapacity: 30, minParticipants: 1, maxParticipants: 20 };
    }
  }

  private validateProductReservation(productType: ProductType, ticketCount: number): void {
    const rules = this.getProductRules(productType);

    if (!Number.isInteger(ticketCount) || ticketCount < rules.minParticipants) {
      throw new BadRequestException(
        `El tipo ${productType} requiere al menos ${rules.minParticipants} participante(s) para confirmar la reserva.`,
      );
    }

    if (ticketCount > rules.maxParticipants) {
      throw new BadRequestException(
        `El tipo ${productType} no admite más de ${rules.maxParticipants} participante(s) por reserva.`,
      );
    }
  }

  private buildReservationResponse(reserva: Reserva): ReservationResponseDto {
    const price = this.normalizePrice(reserva.atraccion?.price ?? { currency: 'USD', total: 0 });
    const ticketCount = Number(reserva.ticket_count ?? 0);

    return {
      reservation_id: reserva.id,
      status: reserva.status as ReservationStatus,
      ticket_count: ticketCount,
      total_price: {
        currency: price.currency,
        total: ticketCount * price.total,
      },
    };
  }

  private mapAtraccionPayload(atr: Atraccion): any {
    const productType = atr.product_type ?? ProductType.SINGLE_TICKET;
    const price = atr.price ?? this.normalizePrice({ currency: 'USD', total: atr.precioTicket ?? 0 });
    const operator = atr.operator ?? this.normalizeOperator({ id: 0, name: 'Operador no definido' });

    return {
      id: atr.id,
      name: atr.name ?? atr.nombre,
      long_description: atr.long_description ?? atr.descripcion,
      duration: atr.duration ?? `PT${this.parseDurationHours(atr.duration ?? String(atr.duracionHoras))}H`,
      price,
      operator,
      product_type: productType,
      includes: atr.includes ?? ['Entrada'],
      categories: atr.categories ?? ['general'],
      badges: atr.free_cancellation ? ['free_cancellation'] : [],
      locations: atr.locations || [],
      photos: atr.photos || [],
      supported_languages: atr.supported_languages ?? ['en-gb'],
      free_cancellation: atr.free_cancellation ?? true,
      ratings: { number_of_reviews: 0, score: 5.0 },
      url: {
        web: `https://www.booking.com/attractions/nl/${atr.id}`,
        app: `booking://attractions/product?slug=${atr.id}`,
      },
    };
  }

  async search(searchDto: SearchAtraccionesDto): Promise<any> {
    const where: any = {};
    if (searchDto.product_type) {
      where.product_type = searchDto.product_type;
    }

    const atracciones = await this.atraccionRepository.find({
      where,
      take: searchDto.rows || 20,
    });

    return {
      data: atracciones.map((atr) => this.mapAtraccionPayload(atr)),
      metadata: {
        total_results: atracciones.length,
        next_page: null,
      },
      request_id: `req-${Date.now()}`,
    };
  }

  async getDetailsBatch(dto: DetailsRequestDto): Promise<any> {
    if (!dto.attractions || dto.attractions.length === 0) {
      return { request_id: `req-${Date.now()}`, data: [] };
    }

    const query: any = {
      where: { id: In(dto.attractions) },
    };

    if (dto.product_type) {
      query.where.product_type = dto.product_type;
    }

    const atracciones = await this.atraccionRepository.find(query);

    const data = atracciones.map((atr) => ({
      ...this.mapAtraccionPayload(atr),
      supported_languages: dto.languages || atr.supported_languages || ['en-gb'],
    }));

    return {
      request_id: `batch-${Date.now()}`,
      data,
    };
  }

  async create(createAtraccionDto: CreateAtraccionDto): Promise<Atraccion> {
    const price = this.normalizePrice(createAtraccionDto.price);
    const operator = this.normalizeOperator(createAtraccionDto.operator);

    const nuevaAtraccion = this.atraccionRepository.create({
      nombre: createAtraccionDto.name,
      descripcion: createAtraccionDto.long_description,
      ciudad: createAtraccionDto.locations?.[0]?.country ?? 'Quito',
      latitud: createAtraccionDto.locations?.[0]?.coordinates?.latitude ?? 0,
      longitud: createAtraccionDto.locations?.[0]?.coordinates?.longitude ?? 0,
      precioTicket: Number(price.total ?? 0),
      duracionHoras: this.parseDurationHours(createAtraccionDto.duration),
      estaActivo: createAtraccionDto.free_cancellation ?? true,
      price,
      operator,
      product_type: createAtraccionDto.product_type ?? ProductType.SINGLE_TICKET,
      categories: createAtraccionDto.categories ?? ['general'],
      includes: createAtraccionDto.includes ?? ['Entrada'],
      supported_languages: createAtraccionDto.supported_languages ?? ['en-gb'],
    });

    return await this.atraccionRepository.save(nuevaAtraccion);
  }

  async findAll(query: PaginationQueryDto): Promise<Atraccion[]> {
    const { limit = 10, offset = 0 } = query;
    return await this.atraccionRepository.find({
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string): Promise<Atraccion> {
    const atraccion = await this.atraccionRepository.findOne({ where: { id } });
    if (!atraccion) {
      throw new NotFoundException(`Atracción con ID ${id} no encontrada`);
    }
    return atraccion;
  }

  async replace(id: string, createAtraccionDto: CreateAtraccionDto): Promise<Atraccion> {
    await this.findOne(id);

    const price = this.normalizePrice(createAtraccionDto.price);
    const operator = this.normalizeOperator(createAtraccionDto.operator);

    await this.atraccionRepository.update(id, {
      nombre: createAtraccionDto.name,
      descripcion: createAtraccionDto.long_description,
      ciudad: createAtraccionDto.locations?.[0]?.country ?? 'Quito',
      latitud: createAtraccionDto.locations?.[0]?.coordinates?.latitude ?? 0,
      longitud: createAtraccionDto.locations?.[0]?.coordinates?.longitude ?? 0,
      precioTicket: Number(price.total ?? 0),
      duracionHoras: this.parseDurationHours(createAtraccionDto.duration),
      estaActivo: createAtraccionDto.free_cancellation ?? true,
      price,
      operator,
      product_type: createAtraccionDto.product_type ?? ProductType.SINGLE_TICKET,
      categories: createAtraccionDto.categories ?? ['general'],
      includes: createAtraccionDto.includes ?? ['Entrada'],
      supported_languages: createAtraccionDto.supported_languages ?? ['en-gb'],
    });

    return await this.findOne(id);
  }

  async update(id: string, updateAtraccionDto: UpdateAtraccionDto): Promise<Atraccion> {
    const atraccion = await this.findOne(id);
    const price = this.normalizePrice(updateAtraccionDto.price ?? atraccion.price ?? undefined);
    const operator = this.normalizeOperator(updateAtraccionDto.operator ?? atraccion.operator ?? undefined);

    const atraccionActualizada = Object.assign(atraccion, {
      nombre: updateAtraccionDto.name ?? atraccion.nombre,
      descripcion: updateAtraccionDto.long_description ?? atraccion.descripcion,
      ciudad: updateAtraccionDto.locations?.[0]?.country ?? atraccion.ciudad,
      latitud: updateAtraccionDto.locations?.[0]?.coordinates?.latitude ?? atraccion.latitud,
      longitud: updateAtraccionDto.locations?.[0]?.coordinates?.longitude ?? atraccion.longitud,
      precioTicket: Number(price.total ?? atraccion.precioTicket ?? 0),
      duracionHoras: this.parseDurationHours(updateAtraccionDto.duration) || atraccion.duracionHoras,
      estaActivo: updateAtraccionDto.free_cancellation ?? atraccion.free_cancellation ?? true,
      price,
      operator,
      product_type: updateAtraccionDto.product_type ?? atraccion.product_type ?? ProductType.SINGLE_TICKET,
      categories: updateAtraccionDto.categories ?? atraccion.categories ?? ['general'],
      includes: updateAtraccionDto.includes ?? atraccion.includes ?? ['Entrada'],
      supported_languages: updateAtraccionDto.supported_languages ?? atraccion.supported_languages ?? ['en-gb'],
    });

    return await this.atraccionRepository.save(atraccionActualizada);
  }

  async delete(id: string): Promise<void> {
    const atraccion = await this.findOne(id);
    await this.atraccionRepository.softRemove(atraccion);
  }

  async remove(id: string): Promise<void> {
    await this.delete(id);
  }

  async getAvailability(id: string, date: string): Promise<AvailabilityResponseDto> {
    const atraccion = await this.findOne(id);

    if (!date || Number.isNaN(Date.parse(date))) {
      throw new BadRequestException('La fecha de disponibilidad es obligatoria y debe tener formato ISO yyyy-mm-dd');
    }

    const reservas = await this.reservaRepository
      .createQueryBuilder('reserva')
      .leftJoinAndSelect('reserva.atraccion', 'atraccion')
      .where('atraccion.id = :id', { id })
      .andWhere('reserva.date = :date', { date })
      .andWhere('reserva.status != :cancelledStatus', { cancelledStatus: 'CANCELLED' })
      .getMany();

    const rules = this.getProductRules(atraccion.product_type ?? ProductType.SINGLE_TICKET);
    const reservedSeats = reservas.reduce((total, reserva) => total + Number(reserva.ticket_count ?? 0), 0);
    const availableSpots = Math.max(0, rules.baseCapacity - reservedSeats);

    return {
      date,
      available_spots: availableSpots,
      times: ['09:00', '12:00', '15:00', '18:00'],
    };
  }

  async reserve(
    id: string,
    dto: ReservationRequestDto,
    idempotencyKey: string,
  ): Promise<ReservationResponseDto> {
    const atraccion = await this.findOne(id);

    if (!dto?.date || Number.isNaN(Date.parse(dto.date))) {
      throw new BadRequestException('La fecha de la reserva es obligatoria y debe tener formato yyyy-mm-dd');
    }

    if (!dto?.customer_name || dto.customer_name.trim().length < 2) {
      throw new BadRequestException('El nombre del cliente es obligatorio');
    }

    if (!Number.isInteger(dto.ticket_count) || dto.ticket_count < 1) {
      throw new BadRequestException('El campo ticket_count debe ser un entero positivo');
    }

    this.validateIdempotencyKey(idempotencyKey);

    const reservaExistente = await this.reservaRepository.findOne({
      where: { idempotencyKey },
      relations: ['atraccion'],
    });

    if (reservaExistente) {
      return this.buildReservationResponse(reservaExistente);
    }

    const productType = atraccion.product_type ?? ProductType.SINGLE_TICKET;
    this.validateProductReservation(productType, dto.ticket_count);

    const availability = await this.getAvailability(id, dto.date);
    if (availability.available_spots < dto.ticket_count) {
      throw new BadRequestException(`No hay cupos suficientes para la fecha ${dto.date} para ${productType}.`);
    }

    const nuevaReserva = this.reservaRepository.create({
      idempotencyKey,
      date: dto.date,
      time: dto.time,
      ticket_count: dto.ticket_count,
      customer_name: dto.customer_name,
      customer_email: dto.customer_email,
      status: 'CONFIRMED',
      atraccion,
    });

    const guardada = await this.reservaRepository.save(nuevaReserva);
    return this.buildReservationResponse({ ...guardada, atraccion });
  }

  async cancelReservation(
    reservationId: string,
    dto: CancelReservationRequestDto,
    idempotencyKey: string,
  ): Promise<ReservationResponseDto> {
    this.validateIdempotencyKey(idempotencyKey);

    if (!dto?.reason || dto.reason.trim().length < 3) {
      throw new BadRequestException('La razón de cancelación es obligatoria');
    }

    const reservaPorKey = await this.reservaRepository.findOne({
      where: { idempotencyKey },
      relations: ['atraccion'],
    });

    if (reservaPorKey) {
      if (reservaPorKey.status === 'CANCELLED') {
        return this.buildReservationResponse(reservaPorKey);
      }

      reservaPorKey.status = 'CANCELLED';
      await this.reservaRepository.save(reservaPorKey);
      return this.buildReservationResponse(reservaPorKey);
    }

    const reserva = await this.reservaRepository.findOne({
      where: { id: reservationId },
      relations: ['atraccion'],
    });

    if (!reserva) {
      throw new NotFoundException(`Reserva con ID ${reservationId} no encontrada`);
    }

    if (reserva.status === 'CANCELLED') {
      return this.buildReservationResponse(reserva);
    }

    reserva.status = 'CANCELLED';
    await this.reservaRepository.save(reserva);
    return this.buildReservationResponse(reserva);
  }

  async getReservations(): Promise<ReservationResponseDto[]> {
    const reservas = await this.reservaRepository.find({ relations: ['atraccion'] });
    return reservas.map((res) => this.buildReservationResponse(res));
  }

  async getReservationById(reservationId: string): Promise<ReservationResponseDto> {
    const res = await this.reservaRepository.findOne({
      where: { id: reservationId },
      relations: ['atraccion'],
    });

    if (!res) {
      throw new NotFoundException(`Reserva con ID ${reservationId} no encontrada`);
    }

    return this.buildReservationResponse(res);
  }
}
