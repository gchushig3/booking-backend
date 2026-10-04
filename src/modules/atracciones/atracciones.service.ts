import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';

import { Atraccion } from './entities/atraccion.entity';
import { Reserva } from './entities/reserva.entity';

export interface AuthenticatedUser {
  id: string;
  role?: string;
}

import { CreateAtraccionDto, ProductType } from './dto/create-atraccion.dto';
import { UpdateAtraccionDto } from './dto/update-atraccion.dto';
import { GetAtraccionesFilterDto } from './dto/get-atracciones-filter.dto';
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
    private readonly dataSource: DataSource,
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
    const productType = reserva.product_type ?? reserva.atraccion?.product_type ?? ProductType.SINGLE_TICKET;
    const price = this.getPackagePrice(reserva.atraccion, productType);
    const ticketCount = Number(reserva.ticket_count ?? 0);
    const photos = reserva.atraccion?.photos as Array<{ url?: string }> | null;

    return {
      reservation_id: reserva.id,
      status: reserva.status as ReservationStatus,
      ticket_count: ticketCount,
      product_type: productType,
      total_price: {
        currency: price.currency,
        total: ticketCount * price.total,
      },
      date: reserva.date,
      time: reserva.time,
      attraction: {
        id: reserva.atraccion?.id ?? '',
        name: reserva.atraccion?.name ?? reserva.atraccion?.nombre ?? 'Atracción',
        image_url: photos?.[0]?.url,
      },
    };
  }

  private getPackagePrice(attraction: Atraccion | null | undefined, productType: ProductType): { currency: string; total: number } {
    const base = this.normalizePrice(attraction?.price ?? { currency: 'USD', total: attraction?.precioTicket ?? 0 });
    const configured = attraction?.package_prices ?? {};
    const multiplier: Record<ProductType, number> = {
      [ProductType.SINGLE_TICKET]: 1,
      [ProductType.GUIDED_TOUR]: 1.5,
      [ProductType.PACKAGE]: 2,
    };
    const single = Number(configured.SINGLE_TICKET?.total ?? base.total);
    const guided = Math.max(Number(configured.GUIDED_TOUR?.total ?? base.total * multiplier[ProductType.GUIDED_TOUR]), single + 0.01);
    const complete = Math.max(Number(configured.PACKAGE?.total ?? base.total * multiplier[ProductType.PACKAGE]), guided + 0.01);
    const totals: Record<ProductType, number> = {
      [ProductType.SINGLE_TICKET]: single,
      [ProductType.GUIDED_TOUR]: guided,
      [ProductType.PACKAGE]: complete,
    };
    return { currency: configured[productType]?.currency ?? base.currency, total: Math.round(totals[productType] * 100) / 100 };
  }

  private mapAtraccionPayload(atr: Atraccion): any {
    const productType = atr.product_type ?? ProductType.SINGLE_TICKET;
    const price = atr.price ?? this.normalizePrice({ currency: 'USD', total: atr.precioTicket ?? 0 });
    const operator = atr.operator ?? this.normalizeOperator({ id: 0, name: 'Operador no definido' });

    return {
      id: atr.id,
      name: atr.name ?? atr.nombre,
      provincia: atr.provincia,
      region: atr.region,
      categoria: atr.categoria ?? atr.categories?.[0],
      imagenes: atr.imagenes ?? atr.photos ?? [],
      precioBase: Number(atr.precioBase ?? atr.precioTicket ?? 0),
      cuposTotales: atr.cuposTotales ?? 30,
      tipoExperienciaPermitidos: atr.tipoExperienciaPermitidos ?? Object.values(ProductType),
      horariosDisponibles: atr.horariosDisponibles ?? ['08:00', '10:00', '14:00'],
      long_description: atr.long_description ?? atr.descripcion,
      duration: atr.duration ?? `PT${this.parseDurationHours(atr.duration ?? String(atr.duracionHoras))}H`,
      price,
      package_prices: atr.package_prices ?? undefined,
      operator,
      product_type: productType,
      includes: atr.includes ?? ['Entrada'],
      categories: atr.categories ?? ['general'],
      badges: atr.badges ?? (atr.free_cancellation ? ['free_cancellation'] : []),
      locations: atr.locations ?? [],
      photos: atr.photos ?? [],
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
      package_prices: createAtraccionDto.package_prices ?? null,
      operator,
      product_type: createAtraccionDto.product_type ?? ProductType.SINGLE_TICKET,
      categories: createAtraccionDto.categories ?? ['general'],
      includes: createAtraccionDto.includes ?? ['Entrada'],
      supported_languages: createAtraccionDto.supported_languages ?? ['en-gb'],
      badges: createAtraccionDto.badges ?? [],
      locations: createAtraccionDto.locations ?? [],
      photos: createAtraccionDto.photos ?? [],
    });

    return await this.atraccionRepository.save(nuevaAtraccion);
  }

  async findAll(query: GetAtraccionesFilterDto): Promise<{
    data: Atraccion[];
    meta: { total: number; page: number; lastPage: number };
  }> {
    const { page = 1, limit = 100, product_type } = query;
    const [data, total] = await this.atraccionRepository.findAndCount({
      where: product_type ? { product_type } : {},
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
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
      package_prices: createAtraccionDto.package_prices ?? null,
      operator,
      product_type: createAtraccionDto.product_type ?? ProductType.SINGLE_TICKET,
      categories: createAtraccionDto.categories ?? ['general'],
      includes: createAtraccionDto.includes ?? ['Entrada'],
      supported_languages: createAtraccionDto.supported_languages ?? ['en-gb'],
      badges: createAtraccionDto.badges ?? [],
      locations: createAtraccionDto.locations ?? [],
      photos: createAtraccionDto.photos ?? [],
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
      package_prices: updateAtraccionDto.package_prices ?? atraccion.package_prices ?? null,
      operator,
      product_type: updateAtraccionDto.product_type ?? atraccion.product_type ?? ProductType.SINGLE_TICKET,
      categories: updateAtraccionDto.categories ?? atraccion.categories ?? ['general'],
      includes: updateAtraccionDto.includes ?? atraccion.includes ?? ['Entrada'],
      supported_languages: updateAtraccionDto.supported_languages ?? atraccion.supported_languages ?? ['en-gb'],
      badges: updateAtraccionDto.badges ?? atraccion.badges ?? [],
      locations: updateAtraccionDto.locations ?? atraccion.locations ?? [],
      photos: updateAtraccionDto.photos ?? atraccion.photos ?? [],
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

  async getAvailability(id: string, date: string, requestedProductType?: ProductType, time?: string): Promise<AvailabilityResponseDto> {
    const atraccion = await this.findOne(id);

    if (!date || Number.isNaN(Date.parse(date))) {
      throw new BadRequestException('La fecha de disponibilidad es obligatoria y debe tener formato ISO yyyy-mm-dd');
    }

    const reservas = await this.reservaRepository
      .createQueryBuilder('reserva')
      .leftJoinAndSelect('reserva.atraccion', 'atraccion')
      .where('atraccion.id = :id', { id })
      .andWhere('reserva.date = :date', { date })
      .andWhere('reserva.status IN (:...statuses)', { statuses: ['CONFIRMED', 'PENDING'] })
      .andWhere(time ? 'reserva.time = :time' : '1 = 1', time ? { time } : {})
      .getMany();

    const productType = requestedProductType ?? atraccion.product_type ?? ProductType.SINGLE_TICKET;
    if (!Object.values(ProductType).includes(productType)) {
      throw new BadRequestException('El tipo de producto no es válido');
    }
    const rules = this.getProductRules(productType);
    const times = atraccion.horariosDisponibles?.length ? atraccion.horariosDisponibles : ['09:00', '12:00', '15:00', '18:00'];
    const capacity = Number(atraccion.cuposTotales ?? rules.baseCapacity);
    const remainingByTime = new Map(times.map((slot) => [slot, Math.max(0, capacity - reservas
      .filter((reservation) => reservation.time === slot)
      .reduce((total, reservation) => total + Number(reservation.ticket_count ?? 0), 0))]));
    const availableSpots = time ? (remainingByTime.get(time) ?? 0) : Math.max(...remainingByTime.values());

    return {
      date,
      available_spots: availableSpots,
      times: times.filter((slot) => (remainingByTime.get(slot) ?? 0) > 0),
      product_type: productType,
      time,
    };
  }

  async reserve(
    id: string,
    dto: ReservationRequestDto,
    idempotencyKey: string,
    user: AuthenticatedUser,
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
      this.assertReservationOwner(reservaExistente, user);
      return this.buildReservationResponse(reservaExistente);
    }

    const productType = dto.product_type ?? atraccion.product_type ?? ProductType.SINGLE_TICKET;
    this.validateProductReservation(productType, dto.ticket_count);

    const guardada = await this.dataSource.transaction(async (manager) => {
      const lockedAttraction = await manager.getRepository(Atraccion).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!lockedAttraction) throw new NotFoundException(`Atracción con ID ${id} no encontrada`);
      const existing = await manager.getRepository(Reserva).findOne({ where: { idempotencyKey }, relations: ['atraccion'] });
      if (existing) { this.assertReservationOwner(existing, user); return existing; }
      const reservations = await manager.getRepository(Reserva).find({
        where: { atraccion: { id }, date: dto.date, time: dto.time, status: In(['CONFIRMED', 'PENDING']) },
      });
      const capacity = Number(lockedAttraction.cuposTotales ?? this.getProductRules(productType).baseCapacity);
      const remaining = Math.max(0, capacity - reservations.reduce((sum, reservation) => sum + Number(reservation.ticket_count), 0));
      if (dto.ticket_count > remaining) throw new BadRequestException('No hay suficientes cupos disponibles para esta fecha y turno');
      return manager.getRepository(Reserva).save(manager.getRepository(Reserva).create({
        idempotencyKey, date: dto.date, time: dto.time, ticket_count: dto.ticket_count, product_type: productType,
        customer_name: dto.customer_name, customer_email: dto.customer_email, status: 'CONFIRMED', userId: user.id, atraccion: lockedAttraction,
      }));
    });
    return this.buildReservationResponse({ ...guardada, atraccion });
  }

  async cancelReservation(
    reservationId: string,
    dto: CancelReservationRequestDto,
    idempotencyKey: string,
    user: AuthenticatedUser,
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
      this.assertReservationOwner(reservaPorKey, user);
      if (reservaPorKey.id !== reservationId) {
        throw new BadRequestException('La clave de idempotencia no corresponde a esta reserva');
      }
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

    this.assertReservationOwner(reserva, user);

    if (reserva.status === 'CANCELLED') {
      return this.buildReservationResponse(reserva);
    }

    reserva.status = 'CANCELLED';
    await this.reservaRepository.save(reserva);
    return this.buildReservationResponse(reserva);
  }

  private assertReservationOwner(reserva: Reserva, user: AuthenticatedUser): void {
    if (user.role !== 'ADMIN' && reserva.userId !== user.id) {
      throw new ForbiddenException('No tiene permiso para acceder a esta reserva');
    }
  }

  async getReservations(user: AuthenticatedUser): Promise<ReservationResponseDto[]> {
    const reservas = await this.reservaRepository.find({
      where: { userId: user.id },
      relations: ['atraccion'],
    });
    return reservas.map((res) => this.buildReservationResponse(res));
  }

  async getReservationById(reservationId: string, user: AuthenticatedUser): Promise<ReservationResponseDto> {
    const res = await this.reservaRepository.findOne({
      where: { id: reservationId },
      relations: ['atraccion'],
    });

    if (!res) {
      throw new NotFoundException(`Reserva con ID ${reservationId} no encontrada`);
    }

    this.assertReservationOwner(res, user);

    return this.buildReservationResponse(res);
  }
}
