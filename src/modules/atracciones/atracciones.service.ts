import { SaveExperienceDto, SaveSlotDto } from './dto/booking-settings.dto';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike, DataSource, QueryFailedError } from 'typeorm';

import { Atraccion } from './entities/atraccion.entity';
import { Reserva } from './entities/reserva.entity';
import { DisponibilidadTurno } from './entities/disponibilidad-turno.entity';
import { PaqueteExperiencia } from './entities/paquete-experiencia.entity';
import { participantCountAllowed } from './reservation-rules';
import { PricingService } from './pricing.service';
import { PaymentService } from './payments/payment.service';
import { ObservabilidadEvento } from './entities/observabilidad-evento.entity';
import { Pago } from './entities/pago.entity';
import { Comentario } from './entities/comentario.entity';
import { CreateComentarioDto, ComentarioResponseDto } from './dto/comentario.dto';
import { AtraccionResponseDto } from './dto/atraccion-response.dto';
import { PaqueteExperienciaResponseDto } from './dto/paquete-experiencia-response.dto';

export interface AuthenticatedUser {
  id: string;
  role?: string;
}

class MockPaymentDeclined extends Error {
  constructor(readonly event: { endpoint: string; userId: string; reason: string }) { super('Mock payment declined'); }
}

import { CreateAtraccionDto, ProductType } from './dto/create-atraccion.dto';
import { UpdateAtraccionDto } from './dto/update-atraccion.dto';
import { GetAtraccionesFilterDto } from './dto/get-atracciones-filter.dto';
import { SearchAtraccionesDto } from './dto/search-atracciones.dto';
import { DetailsRequestDto } from './dto/details-request.dto';
import { AtraccionesListResponseDto, BatchAtraccionesResponseDto, SearchAtraccionesResponseDto } from './dto/search-response.dto';
import { AvailabilityResponseDto } from './dto/availability.dto';
import {
  ReservationRequestDto,
  ReservationResponseDto,
  ReservationStatus,
  CancelReservationRequestDto,
} from './dto/reservation.dto';

@Injectable()
export class AtraccionesService implements OnModuleInit, OnModuleDestroy {
  private readonly uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  private expirationTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Atraccion)
    private readonly atraccionRepository: Repository<Atraccion>,

    @InjectRepository(Reserva)
    private readonly reservaRepository: Repository<Reserva>,
    private readonly dataSource: DataSource,
    private readonly pricingService: PricingService,
    private readonly paymentService: PaymentService,
  ) {}

  onModuleInit(): void {
    this.expirationTimer = setInterval(() => void this.expirePendingReservations().catch(() => undefined), 60_000);
    this.expirationTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
  }

  async expirePendingReservations(): Promise<number> {
    const ttlMinutes = Math.max(1, Number(process.env.PENDING_RESERVATION_TTL_MINUTES ?? 15));
    const cutoff = new Date(Date.now() - ttlMinutes * 60_000);
    const expired = await this.reservaRepository.createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.atraccion', 'attraction')
      .where('reservation.status = :status', { status: 'PENDIENTE' })
      .andWhere('reservation.createdAt < :cutoff', { cutoff })
      .getMany();
    let released = 0;
    for (const reservation of expired) {
      const before = reservation.status;
      const current = await this.cancelLockedReservation(reservation);
      if (before === 'PENDIENTE' && current.status === 'CANCELADA') released++;
    }
    return released;
  }

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
        return { baseCapacity: 25, minParticipants: 2, maxParticipants: 10 };
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
      num_adultos: reserva.numAdultos ?? ticketCount,
      num_ninos: reserva.numNinos ?? 0,
      total_cupos_ocupados: reserva.totalCuposOcupados ?? ticketCount,
      product_type: productType,
      total_price: {
        currency: price.currency,
        total: Number(reserva.montoTotal ?? ticketCount * price.total),
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

  private async buildCheckoutResponse(reserva: Reserva): Promise<ReservationResponseDto> {
    const payment = await this.dataSource.getRepository(Pago).findOne({ where: { reservaId: reserva.id } });
    if (!payment) throw new ConflictException({ code: 'IDEMPOTENCY_RESULT_INCOMPLETE', message: 'La reserva existente no tiene un pago registrado.' });
    return {
      ...this.buildReservationResponse(reserva),
      payment: { status: 'SUCCESS', metodo_pago: payment.metodoPago, monto_pagado: Number(payment.montoPagado),
        transaccion_hash: payment.transaccionHash, fecha_pago: payment.fechaPago },
    };
  }

  private validateSelectedPackage(pkg: PaqueteExperiencia | null, attractionId: string, requestedType?: ProductType): ProductType {
    if (!pkg) throw new NotFoundException('Paquete seleccionado no encontrado.');
    if (pkg.atraccionId !== attractionId) throw new BadRequestException('El paquete seleccionado no pertenece a esta atraccion.');
    if (!Object.values(ProductType).includes(pkg.tipoExperiencia)) throw new BadRequestException('La modalidad del paquete no es valida.');
    if (requestedType !== undefined && requestedType !== pkg.tipoExperiencia) throw new BadRequestException('product_type debe coincidir con la modalidad del paquete seleccionado.');
    return pkg.tipoExperiencia;
  }

  private checkoutFingerprint(id: string, dto: ReservationRequestDto, user: AuthenticatedUser, adults: number, children: { edad: number }[], type: ProductType, time: string): string {
    const canonical = JSON.stringify({ userId: user.id, attractionId: id, paquete_id: dto.paquete_id.toLowerCase(), date: dto.date, time, productType: type,
      adults, childAges: children.map(({ edad }) => edad), customerName: dto.customer_name.trim(),
      customerEmail: dto.customer_email?.trim().toLowerCase() ?? null, method: dto.metodo_pago ?? 'CREDIT_CARD',
      cardholder: dto.titular_tarjeta?.trim() ?? null, lastFour: dto.ultimos_cuatro_digitos ?? null });
    return createHash('sha256').update(canonical).digest('hex');
  }

  private assertIdempotentCheckout(existing: Reserva, id: string, fingerprint: string, user: AuthenticatedUser, packageId: string): void {
    if (existing.userId !== user.id) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'La clave ya fue utilizada por otra cuenta.' });
    if (existing.paqueteId !== packageId || existing.atraccion?.id !== id || (existing.requestFingerprint && existing.requestFingerprint !== fingerprint)) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'La clave ya fue utilizada para otra operación o solicitud.' });
    }
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

  mapAtraccionPayload(atr: Atraccion): AtraccionResponseDto {
    const productType = atr.product_type ?? ProductType.SINGLE_TICKET;
    const price = atr.price ?? this.normalizePrice({ currency: 'USD', total: atr.precioTicket ?? 0 });
    const operator = atr.operator ?? this.normalizeOperator({ id: 0, name: 'Operador no definido' });

    return {
      id: atr.id,
      name: atr.name ?? atr.nombre,
      provincia: atr.provincia,
      region: atr.region,
      categoria: atr.categoria ?? atr.categories?.[0],
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

  async search(searchDto: SearchAtraccionesDto): Promise<SearchAtraccionesResponseDto> {
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

  async getDetailsBatch(dto: DetailsRequestDto): Promise<BatchAtraccionesResponseDto> {
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
      cuposTotales: 0, horariosDisponibles: [], tipoExperienciaPermitidos: [createAtraccionDto.product_type],
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

  async findAll(query: GetAtraccionesFilterDto): Promise<AtraccionesListResponseDto> {
    const { page = 1, limit = 100, product_type, q } = query;
    const [data, total] = await this.atraccionRepository.findAndCount({
      where: { ...(product_type ? { product_type } : {}), ...(q?.trim() ? { nombre: ILike('%' + q.trim().replace(/[\\%_]/g, '\\$&') + '%') } : {}) },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: data.map((attraction) => this.mapAtraccionPayload(attraction)),
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

    const turnos = await this.dataSource.getRepository(DisponibilidadTurno).find({ where: { atraccionId: id, fecha: date, ...(time ? { horaInicio: time } : {}) } });
    if (turnos.length) {
      const times = turnos.filter((slot) => slot.capacidadTotal > slot.cuposReservados).map((slot) => slot.horaInicio.slice(0, 5));
      const selected = time ? turnos.find((slot) => slot.horaInicio.startsWith(time)) : undefined;
      return { date, available_spots: selected ? selected.capacidadTotal - selected.cuposReservados : Math.max(0, ...turnos.map((slot) => slot.capacidadTotal - slot.cuposReservados)), times, product_type: requestedProductType, time };
    }

    const reservas = await this.reservaRepository
      .createQueryBuilder('reserva')
      .leftJoinAndSelect('reserva.atraccion', 'atraccion')
      .where('atraccion.id = :id', { id })
      .andWhere('reserva.date = :date', { date })
      .andWhere('reserva.status IN (:...statuses)', { statuses: ['CONFIRMADA', 'PENDIENTE'] })
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
    const availableSpots = time ? (remainingByTime.get(time) ?? 0) : Math.max(0, ...remainingByTime.values());

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

    const numAdults = dto.num_adultos ?? dto.ticket_count ?? 0;
    const children = dto.ninos ?? [];
    if (!Number.isInteger(numAdults) || numAdults < 0 || numAdults + children.length < 1) throw new BadRequestException('Debe enviar participantes válidos.');
    const occupiedCount = numAdults + children.length;

    this.validateIdempotencyKey(idempotencyKey);

    if (!dto.paquete_id) throw new BadRequestException('paquete_id es obligatorio.');
    const packageId = dto.paquete_id.toLowerCase();
    const selectedPackage = await this.dataSource.getRepository(PaqueteExperiencia).findOne({ where: { id: packageId } });
    const productType = this.validateSelectedPackage(selectedPackage, id, dto.product_type);
    if (atraccion.tipoExperienciaPermitidos?.length && !atraccion.tipoExperienciaPermitidos.includes(productType)) {
      throw new BadRequestException('La modalidad del paquete no esta disponible para esta atraccion.');
    }
    const selectedTime = dto.time ?? atraccion.horariosDisponibles?.[0] ?? '09:00';
    if (!atraccion.horariosDisponibles?.includes(selectedTime)) {
      throw new BadRequestException('La hora seleccionada no corresponde a un turno válido de la atracción.');
    }

    const fingerprint = this.checkoutFingerprint(id, dto, user, numAdults, children, productType, selectedTime);
    const reservaExistente = await this.reservaRepository.findOne({ where: { idempotencyKey }, relations: ['atraccion'] });
    if (reservaExistente) {
      this.assertIdempotentCheckout(reservaExistente, id, fingerprint, user, packageId);
      return this.buildCheckoutResponse(reservaExistente);
    }

    let guardada: Reserva;
    try {
      guardada = await this.dataSource.transaction(async (manager) => {
      const lockedAttraction = await manager.getRepository(Atraccion).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!lockedAttraction) throw new NotFoundException(`Atracción con ID ${id} no encontrada`);
      if (!lockedAttraction.tipoExperienciaPermitidos?.includes(productType)) throw new BadRequestException('La modalidad seleccionada no está disponible para esta atracción.');
      if (!lockedAttraction.horariosDisponibles?.includes(selectedTime)) throw new BadRequestException('La hora seleccionada no corresponde a un turno válido de la atracción.');
      const existing = await manager.getRepository(Reserva).findOne({ where: { idempotencyKey }, relations: ['atraccion'] });
      if (existing) { this.assertIdempotentCheckout(existing, id, fingerprint, user, packageId); return existing; }
      const packageRepository = manager.getRepository(PaqueteExperiencia);
      const experiencePackage = await packageRepository.findOne({ where: { id: packageId }, lock: { mode: 'pessimistic_read' } });
      const lockedProductType = this.validateSelectedPackage(experiencePackage, lockedAttraction.id, dto.product_type);
      if (lockedProductType !== productType) throw new BadRequestException('La modalidad del paquete cambio durante el checkout; revisa la seleccion.');
      const minParticipants = experiencePackage.minParticipantes;
      const maxParticipants = experiencePackage.maxParticipantes;
      if (!participantCountAllowed(occupiedCount, minParticipants, maxParticipants)) {
        throw new BadRequestException(`La modalidad ${productType} requiere entre ${minParticipants} y ${maxParticipants ?? 'sin límite'} participantes.`);
      }
      const pricing = this.pricingService.calculate(experiencePackage, numAdults, children);
      const slots = manager.getRepository(DisponibilidadTurno);
      await slots.createQueryBuilder().insert().into(DisponibilidadTurno).values({ atraccionId: id, fecha: dto.date, horaInicio: selectedTime, capacidadTotal: Number(lockedAttraction.cuposTotales ?? this.getProductRules(productType).baseCapacity) }).orIgnore().execute();
      const slot = await slots.findOne({ where: { atraccionId: id, fecha: dto.date, horaInicio: selectedTime }, lock: { mode: 'pessimistic_write' } });
      if (!slot || slot.atraccionId !== lockedAttraction.id || slot.cuposReservados + pricing.totalCuposOcupados > slot.capacidadTotal) {
        throw new ConflictException({ statusCode: 409, code: 'INSUFFICIENT_AVAILABILITY', message: 'No hay suficientes cupos disponibles para esta fecha y turno.' });
      }
      // PostgreSQL does not share a distributed transaction with a future real provider.
      // The mock is side-effect free; production capture needs compensation/outbox semantics.
      const payment = await this.paymentService.process({ amount: pricing.montoTotal,
        method: dto.metodo_pago ?? 'CREDIT_CARD', cardholder: dto.titular_tarjeta, lastFour: dto.ultimos_cuatro_digitos });
      if (payment.status === 'FAILED') throw new MockPaymentDeclined({ endpoint: `/atracciones/${id}/reservations`, userId: user.id, reason: payment.reason });
      slot.cuposReservados += pricing.totalCuposOcupados;
      await slots.save(slot);
      const reservationRepo = manager.getRepository(Reserva);
      const reservation = await reservationRepo.save(reservationRepo.create({
        idempotencyKey, requestFingerprint: fingerprint, codigoReserva: `BR-${idempotencyKey.replace(/-/g, '').toUpperCase()}`,
        turnoId: slot.id, date: dto.date, time: selectedTime, ticket_count: pricing.totalCuposOcupados,
        numAdultos: numAdults, numNinos: children.length, totalCuposOcupados: pricing.totalCuposOcupados,
        edadesNinos: children.map(({ edad }) => edad), subtotal: String(pricing.subtotal),
        descuentos: String(pricing.descuentos), montoTotal: String(pricing.montoTotal), paqueteId: experiencePackage.id,
        product_type: productType, customer_name: dto.customer_name, customer_email: dto.customer_email,
        status: 'CONFIRMADA', userId: user.id, atraccion: lockedAttraction,
      }));
      await manager.getRepository(Pago).save(manager.getRepository(Pago).create({
        reservaId: reservation.id, metodoPago: dto.metodo_pago ?? 'CREDIT_CARD',
        titularTarjeta: dto.titular_tarjeta ?? null, ultimosCuatroDigitos: dto.ultimos_cuatro_digitos ?? null,
        montoPagado: String(pricing.montoTotal), transaccionHash: payment.transactionHash,
      }));
      await manager.getRepository(ObservabilidadEvento).save(manager.getRepository(ObservabilidadEvento).create({
        tipoEvento: 'RESERVATION_CONFIRMED', endpointRuta: `/atracciones/${id}/reservations`, userId: user.id,
        payloadJson: { reservationId: reservation.id, amount: pricing.montoTotal, occupiedSeats: pricing.totalCuposOcupados },
      }));
      await manager.getRepository(ObservabilidadEvento).save(manager.getRepository(ObservabilidadEvento).create({
        tipoEvento: 'PAYMENT_SUCCESS', endpointRuta: `/atracciones/${id}/reservations`, userId: user.id,
        payloadJson: { reservationId: reservation.id, amount: pricing.montoTotal },
      }));
      return reservation;
      });
    } catch (error) {
      if (error instanceof MockPaymentDeclined) {
        await this.dataSource.getRepository(ObservabilidadEvento).save({ tipoEvento: 'CHECKOUT_FAIL',
          endpointRuta: error.event.endpoint, userId: error.event.userId, payloadJson: { reason: error.event.reason } });
        throw new ConflictException({ code: 'PAYMENT_FAILED', message: 'Pago rechazado; no se creó reserva ni se retuvieron cupos.' });
      }
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        const raced = await this.reservaRepository.findOne({ where: { idempotencyKey }, relations: ['atraccion'] });
        if (raced) {
          this.assertIdempotentCheckout(raced, id, fingerprint, user, packageId);
          return this.buildCheckoutResponse(raced);
        }
      }
      throw error;
    }
    return this.buildCheckoutResponse({ ...guardada, atraccion });
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
      if (reservaPorKey.status === 'CANCELADA') {
        return this.buildReservationResponse(reservaPorKey);
      }

      return this.cancelLockedReservation(reservaPorKey);
    }

    const reserva = await this.reservaRepository.findOne({
      where: { id: reservationId },
      relations: ['atraccion'],
    });

    if (!reserva) {
      throw new NotFoundException(`Reserva con ID ${reservationId} no encontrada`);
    }

    this.assertReservationOwner(reserva, user);

    if (reserva.status === 'CANCELADA') {
      return this.buildReservationResponse(reserva);
    }

    return this.cancelLockedReservation(reserva);
  }

  async getAttractionResponse(id: string): Promise<AtraccionResponseDto> {
    return this.mapAtraccionPayload(await this.findOne(id));
  }

  async savePackage(id: string, dto: SaveExperienceDto, packageId?: string) {
    if (dto.max_participantes != null && dto.max_participantes < dto.min_participantes) throw new BadRequestException('El máximo debe ser mayor o igual al mínimo.');
    return this.dataSource.transaction(async (manager) => {
      const attractions = manager.getRepository(Atraccion);
      const attraction = await attractions.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!attraction) throw new NotFoundException('Atracción no encontrada.');
      const repo = manager.getRepository(PaqueteExperiencia);
      const pkg = packageId ? await repo.findOne({ where: { id: packageId, atraccionId: id }, lock: { mode: 'pessimistic_write' } }) : repo.create({ atraccionId: id, politicasJson: {} });
      if (!pkg) throw new NotFoundException('Experiencia no encontrada.');
      Object.assign(pkg, { nombrePaquete: dto.nombre_paquete.trim(), tipoExperiencia: dto.tipo_experiencia, precioUnitario: String(dto.precio_unitario), minParticipantes: dto.min_participantes, maxParticipantes: dto.max_participantes ?? null });
      attraction.tipoExperienciaPermitidos = [...new Set([...(attraction.tipoExperienciaPermitidos ?? []), dto.tipo_experiencia])];
      await attractions.save(attraction);
      await repo.save(pkg);
      return { id: pkg.id };
    });
  }

  async saveSlot(id: string, dto: SaveSlotDto) {
    const parsed = new Date(dto.date + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dto.date) throw new BadRequestException('Fecha inválida.');
    return this.dataSource.transaction(async (manager) => {
      const attractions = manager.getRepository(Atraccion);
      const attraction = await attractions.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!attraction) throw new NotFoundException('Atracción no encontrada.');
      const repo = manager.getRepository(DisponibilidadTurno);
      let slot = await repo.findOne({ where: { atraccionId: id, fecha: dto.date, horaInicio: dto.time }, lock: { mode: 'pessimistic_write' } });
      if (!slot) slot = repo.create({ atraccionId: id, fecha: dto.date, horaInicio: dto.time, cuposReservados: 0 });
      if (dto.capacidad_total < slot.cuposReservados) throw new ConflictException('La capacidad no puede ser menor que los cupos ya reservados.');
      slot.capacidadTotal = dto.capacidad_total;
      attraction.horariosDisponibles = [...new Set([...(attraction.horariosDisponibles ?? []), dto.time])];
      await attractions.save(attraction);
      return repo.save(slot);
    });
  }

  async getPackages(attractionId: string): Promise<PaqueteExperienciaResponseDto[]> {
    await this.findOne(attractionId);
    const packages = await this.dataSource.getRepository(PaqueteExperiencia).find({
      where: { atraccionId: attractionId },
      order: { tipoExperiencia: 'ASC', nombrePaquete: 'ASC' },
    });
    return packages.map((experiencePackage) => ({
      id: experiencePackage.id,
      atraccion_id: experiencePackage.atraccionId,
      tipo_experiencia: experiencePackage.tipoExperiencia,
      nombre_paquete: experiencePackage.nombrePaquete,
      descripcion: experiencePackage.descripcion,
      precio_unitario: Number(experiencePackage.precioUnitario),
      moneda: 'USD',
      min_participantes: experiencePackage.minParticipantes,
      max_participantes: experiencePackage.maxParticipantes,
      politicas_json: experiencePackage.politicasJson ?? {},
    }));
  }

  private async cancelLockedReservation(reserva: Reserva): Promise<ReservationResponseDto> {
    const cancelled = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Reserva);
      // Lock only the reservation row. Locking with its optional/soft-deleted attraction LEFT JOIN
      // makes PostgreSQL reject FOR UPDATE against the nullable join side.
      const current = await repo.findOne({ where: { id: reserva.id }, lock: { mode: 'pessimistic_write' } });
      if (!current || current.status === 'CANCELADA') return current;
      current.atraccion = await manager.getRepository(Atraccion).findOneByOrFail({ id: reserva.atraccion.id });
      const slotRepo = manager.getRepository(DisponibilidadTurno);
      const slot = await slotRepo.findOne({ where: { atraccionId: current.atraccion.id, fecha: current.date, horaInicio: current.time }, lock: { mode: 'pessimistic_write' } });
      if (current.status === 'CONFIRMADA' || current.status === 'PENDIENTE') {
        const occupiedSeats = current.totalCuposOcupados ?? current.ticket_count;
        if (!slot || slot.cuposReservados < occupiedSeats) {
          throw new ConflictException('El turno no tiene una reserva de cupos consistente; no se liberaron cupos.');
        }
        slot.cuposReservados -= occupiedSeats;
        await slotRepo.save(slot);
      }
      current.status = 'CANCELADA';
      return repo.save(current);
    });
    return this.buildReservationResponse(cancelled ?? reserva);
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

  async getAllReservations(): Promise<ReservationResponseDto[]> {
    const reservations = await this.reservaRepository.find({ relations: ['atraccion'], order: { createdAt: 'DESC' } });
    return reservations.map((reservation) => this.buildReservationResponse(reservation));
  }

  async createComment(attractionId: string, dto: CreateComentarioDto, user: AuthenticatedUser): Promise<ComentarioResponseDto> {
    await this.findOne(attractionId);
    const reservation = await this.reservaRepository.findOne({ where: {
      id: dto.reservation_id, userId: user.id, status: 'CONFIRMADA', atraccion: { id: attractionId },
    } });
    if (!reservation) throw new ForbiddenException('Se requiere una reserva CONFIRMADA propia para esta atracción.');
    const repo = this.dataSource.getRepository(Comentario);
    try {
      const comment = await repo.save(repo.create({ atraccionId: attractionId, userId: user.id,
        reservaId: reservation.id, puntuacion: dto.puntuacion, comentario: dto.comentario.trim() }));
      return { id: comment.id, atraccion_id: attractionId, reserva_id: reservation.id,
        puntuacion: comment.puntuacion, comentario: comment.comentario, fecha_creacion: comment.fechaCreacion };
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException('La reserva ya tiene un comentario asociado.');
      }
      throw error;
    }
  }

  async getComments(attractionId: string): Promise<ComentarioResponseDto[]> {
    await this.findOne(attractionId);
    const comments = await this.dataSource.getRepository(Comentario).find({ where: { atraccionId: attractionId }, order: { fechaCreacion: 'DESC' } });
    return comments.map((comment) => ({ id: comment.id, atraccion_id: comment.atraccionId,
      reserva_id: comment.reservaId, puntuacion: comment.puntuacion, comentario: comment.comentario, fecha_creacion: comment.fechaCreacion }));
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
