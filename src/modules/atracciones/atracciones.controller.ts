import { SaveExperienceDto, SaveSlotDto } from './dto/booking-settings.dto';
import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse,
  ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation,
  ApiParam, ApiQuery, ApiResponse, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AtraccionesService, AuthenticatedUser } from './atracciones.service';
import { CreateAtraccionDto, ProductType } from './dto/create-atraccion.dto';
import { UpdateAtraccionDto } from './dto/update-atraccion.dto';
import { AtraccionResponseDto } from './dto/atraccion-response.dto';
import { PaqueteExperienciaResponseDto } from './dto/paquete-experiencia-response.dto';
import { GetAtraccionesFilterDto } from './dto/get-atracciones-filter.dto';
import { SearchAtraccionesDto } from './dto/search-atracciones.dto';
import { AtraccionesListResponseDto, BatchAtraccionesResponseDto, SearchAtraccionesResponseDto } from './dto/search-response.dto';
import { DetailsRequestDto } from './dto/details-request.dto';
import { AvailabilityResponseDto } from './dto/availability.dto';
import { CancelReservationRequestDto, ReservationRequestDto, ReservationResponseDto } from './dto/reservation.dto';
import { Public } from '../../common/auth/public.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';

@ApiTags('Atracciones')
@Controller('atracciones')
@UseGuards(JwtAuthGuard)
export class AtraccionesController {
  private readonly uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(private readonly atraccionesService: AtraccionesService) {}

  private validateIdempotencyKey(key: string): void {
    if (!key || !this.uuidV4Regex.test(key)) throw new BadRequestException('El encabezado X-Idempotency-Key debe ser un UUID v4 válido.');
  }

  @Public()
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar atracciones', description: 'Pública. Actualmente aplica product_type y rows; los demás campos del DTO se aceptan pero no filtran, ordenan ni convierten moneda. next_page devuelto es null.' })
  @ApiOkResponse({ type: SearchAtraccionesResponseDto })
  @ApiBadRequestResponse({ description: 'DTO de búsqueda inválido.' })
  @ApiBody({ type: SearchAtraccionesDto })
  search(@Body() dto: SearchAtraccionesDto): Promise<SearchAtraccionesResponseDto> { return this.atraccionesService.search(dto); }

  @Public()
  @Post('details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener detalles batch de atracciones' })
  @ApiOkResponse({ type: BatchAtraccionesResponseDto })
  @ApiBadRequestResponse({ description: 'DTO de detalles inválido.' })
  @ApiBody({ type: DetailsRequestDto })
  getDetailsBatch(@Body() dto: DetailsRequestDto): Promise<BatchAtraccionesResponseDto> { return this.atraccionesService.getDetailsBatch(dto); }

  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @Post()
  @ApiOperation({ summary: 'Crear atracción', description: 'Requiere Bearer JWT y rol ADMIN.' })
  @ApiCreatedResponse({ type: AtraccionResponseDto, description: 'Atracción creada; incluye cabecera Location.', headers: { Location: { description: 'Ruta del recurso creado.', schema: { type: 'string', example: '/api/v1/atracciones/{id}' } } } })
  @ApiBadRequestResponse({ description: 'DTO inválido.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere rol ADMIN.' })
  @ApiBody({ type: CreateAtraccionDto })
  async create(@Body() dto: CreateAtraccionDto, @Res({ passthrough: true }) res: Response): Promise<AtraccionResponseDto> {
    const attraction = await this.atraccionesService.create(dto);
    res.setHeader('Location', `/api/v1/atracciones/${attraction.id}`);
    return this.atraccionesService.mapAtraccionPayload(attraction);
  }

  @Public()
  @Get()
  @Header('X-API-Deprecation-Date', '2027-12-31')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Listar atracciones paginadas' })
  @ApiOkResponse({ type: AtraccionesListResponseDto })
  @ApiBadRequestResponse({ description: 'Parámetros de paginación o modalidad inválidos.' })
  findAll(@Query() query: GetAtraccionesFilterDto): Promise<AtraccionesListResponseDto> { return this.atraccionesService.findAll(query); }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Consultar estado del servicio de atracciones' })
  @ApiOkResponse({ schema: { type: 'object', required: ['status', 'timestamp'], properties: { status: { type: 'string', enum: ['UP'] }, timestamp: { type: 'string', format: 'date-time' } }, example: { status: 'UP', timestamp: '2026-10-05T12:00:00.000Z' } } })
  checkHealth() { return { status: 'UP', timestamp: new Date().toISOString() }; }

  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @Post(':id/paquetes')
  @ApiOperation({ summary: 'Crear experiencia reservable', description: 'Requiere rol ADMIN.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere rol ADMIN.' })
  @ApiBadRequestResponse({ description: 'UUID o datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Atracción o experiencia no encontrada.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCreatedResponse({ schema: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } })
  savePackage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveExperienceDto) {
    return this.atraccionesService.savePackage(id, dto);
  }

  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @Put(':id/paquetes/:packageId')
  @ApiOperation({ summary: 'Editar experiencia reservable', description: 'Requiere rol ADMIN. Las reservas existentes conservan sus importes.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere rol ADMIN.' })
  @ApiBadRequestResponse({ description: 'UUID o datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Atracción o experiencia no encontrada.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'packageId', type: String, format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } })
  updatePackage(@Param('id', ParseUUIDPipe) id: string, @Param('packageId', ParseUUIDPipe) packageId: string, @Body() dto: SaveExperienceDto) {
    return this.atraccionesService.savePackage(id, dto, packageId);
  }

  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @Put(':id/availability')
  @ApiOperation({ summary: 'Configurar capacidad de un turno', description: 'Requiere rol ADMIN. No permite reducir la capacidad por debajo de los cupos reservados.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere rol ADMIN.' })
  @ApiBadRequestResponse({ description: 'UUID o datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Atracción o experiencia no encontrada.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiConflictResponse({ description: 'La capacidad es menor que los cupos reservados.' })
  @ApiOkResponse({ schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, atraccionId: { type: 'string', format: 'uuid' }, fecha: { type: 'string', format: 'date' }, horaInicio: { type: 'string' }, capacidadTotal: { type: 'integer' }, cuposReservados: { type: 'integer' }, createdAt: { type: 'string', format: 'date-time' } } } })
  saveSlot(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveSlotDto) {
    return this.atraccionesService.saveSlot(id, dto);
  }

  @Public()
  @Get(':id/paquetes')
  @ApiOperation({ summary: 'Listar paquetes, modalidades, precios y políticas de una atracción' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID de la atracción.' })
  @ApiOkResponse({ type: PaqueteExperienciaResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'El id no es un UUID válido.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  getPackages(@Param('id', ParseUUIDPipe) id: string): Promise<PaqueteExperienciaResponseDto[]> { return this.atraccionesService.getPackages(id); }

  @ApiBearerAuth('JWT-auth')
  @Get('reservations')
  @ApiOperation({ summary: 'Listar mis reservas' })
  @ApiOkResponse({ type: ReservationResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  getReservations(@Req() req: { user: AuthenticatedUser }): Promise<ReservationResponseDto[]> { return this.atraccionesService.getReservations(req.user); }

  @ApiBearerAuth('JWT-auth')
  @Get('reservations/:reservationId')
  @ApiOperation({ summary: 'Consultar detalle de una reserva propia' })
  @ApiParam({ name: 'reservationId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiBadRequestResponse({ description: 'El id no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'La reserva pertenece a otro usuario.' })
  @ApiNotFoundResponse({ description: 'Reserva no encontrada.' })
  getReservationById(@Param('reservationId', ParseUUIDPipe) id: string, @Req() req: { user: AuthenticatedUser }): Promise<ReservationResponseDto> {
    return this.atraccionesService.getReservationById(id, req.user);
  }

  @Public()
  @Get(':id')
  @Header('X-API-Deprecation-Date', '2027-12-31')
  @Header('Cache-Control', 'max-age=300')
  @ApiOperation({ summary: 'Consultar detalle de una atracción' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AtraccionResponseDto })
  @ApiBadRequestResponse({ description: 'El id no es un UUID válido.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  getAttraction(@Param('id', ParseUUIDPipe) id: string): Promise<AtraccionResponseDto> { return this.atraccionesService.getAttractionResponse(id); }

  @Public()
  @Get(':id/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad para una fecha y turno' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'date', required: true, type: String, example: '2026-10-10', description: 'Fecha en formato YYYY-MM-DD.' })
  @ApiQuery({ name: 'product_type', required: false, enum: ProductType })
  @ApiQuery({ name: 'time', required: false, type: String, example: '10:00', description: 'Si se envía, available_spots corresponde a este turno.' })
  @ApiOkResponse({ type: AvailabilityResponseDto, description: 'Devuelve date, available_spots, times y los filtros enviados.' })
  @ApiBadRequestResponse({ description: 'Fecha faltante/incorrecta o modalidad inválida.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  getAvailability(@Param('id', ParseUUIDPipe) id: string, @Query('date') date: string,
    @Query('product_type') productType?: ProductType, @Query('time') time?: string): Promise<AvailabilityResponseDto> {
    return this.atraccionesService.getAvailability(id, date, productType, time);
  }

  @ApiBearerAuth('JWT-auth')
  @Post(':id/reservations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Checkout y creación de reserva', description: 'Requiere JWT. Misma key + mismo payload normalizado + mismo propietario devuelve la reserva y pago originales, sin duplicarlos. Misma key con payload incompatible, otra atracción o propietario: 409 IDEMPOTENCY_KEY_REUSED. paquete_id determina modalidad, precio y políticas en el servidor; pago mediante proveedor mock.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID de la atracción.' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' }, description: 'UUID v4 obligatorio y estable para reintentos de la misma operación.' })
  @ApiCreatedResponse({ type: ReservationResponseDto, description: 'Reserva confirmada y pago mock procesado.' })
  @ApiBadRequestResponse({ description: 'DTO/header invalido, paquete de otra atraccion o product_type diferente del paquete seleccionado.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiNotFoundResponse({ description: 'Atraccion o paquete_id no encontrado.' })
  @ApiConflictResponse({ description: '409 INSUFFICIENT_AVAILABILITY, PAYMENT_FAILED o IDEMPOTENCY_KEY_REUSED si la key tiene otro payload/propietario.' })
  @ApiBody({ type: ReservationRequestDto })
  async reserve(@Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReservationRequestDto,
    @Req() req: { user: AuthenticatedUser; headers: { 'x-idempotency-key'?: string } }): Promise<ReservationResponseDto> {
    const key = req.headers['x-idempotency-key'];
    if (!key) throw new BadRequestException('El encabezado X-Idempotency-Key es obligatorio.');
    this.validateIdempotencyKey(key);
    return this.atraccionesService.reserve(id, dto, key, req.user);
  }

  @ApiBearerAuth('JWT-auth')
  @Post('reservations/:reservationId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reserva propia', description: 'Requiere JWT y propiedad de la reserva, o rol ADMIN. Cancelar una reserva ya CANCELADA devuelve su estado sin liberar cupos de nuevo. Se exige UUID v4, pero no se persiste una key/fingerprint independiente de cancelación: una key nueva actúa sobre reservationId. Si la key corresponde a un checkout de otra reserva devuelve 400; no se compara reason para idempotencia.' })
  @ApiParam({ name: 'reservationId', type: String, format: 'uuid' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' }, description: 'UUID v4 obligatorio. Repetir la cancelación de la misma reserva no vuelve a liberar cupos; ver la semántica real en la descripción de la operación.' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiBadRequestResponse({ description: 'DTO inválido, reason insuficiente, header ausente/inválido o key de un checkout de otra reserva.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'La reserva pertenece a otro usuario.' })
  @ApiNotFoundResponse({ description: 'Reserva no encontrada.' })
  @ApiConflictResponse({ description: 'El turno no tiene una reserva de cupos consistente; no se liberaron cupos.' })
  @ApiBody({ type: CancelReservationRequestDto })
  async cancelReservation(@Param('reservationId', ParseUUIDPipe) id: string, @Body() dto: CancelReservationRequestDto,
    @Req() req: { user: AuthenticatedUser; headers: { 'x-idempotency-key'?: string } }): Promise<ReservationResponseDto> {
    const key = req.headers['x-idempotency-key'];
    if (!key) throw new BadRequestException('El encabezado X-Idempotency-Key es obligatorio.');
    this.validateIdempotencyKey(key);
    return this.atraccionesService.cancelReservation(id, dto, key, req.user);
  }

  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reemplazar una atracción', description: 'Requiere Bearer JWT y rol ADMIN.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Reemplazo completado sin cuerpo.' })
  @ApiBadRequestResponse({ description: 'UUID o DTO inválido.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere rol ADMIN.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  @ApiBody({ type: CreateAtraccionDto })
  async replace(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAtraccionDto): Promise<void> { await this.atraccionesService.replace(id, dto); }

  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente una atracción', description: 'Requiere Bearer JWT y rol ADMIN.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AtraccionResponseDto })
  @ApiBadRequestResponse({ description: 'UUID o DTO inválido.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere rol ADMIN.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  @ApiBody({ type: UpdateAtraccionDto })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAtraccionDto): Promise<AtraccionResponseDto> {
    return this.atraccionesService.mapAtraccionPayload(await this.atraccionesService.update(id, dto));
  }

  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar una atracción (soft delete)', description: 'Requiere Bearer JWT y rol ADMIN.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Atracción desactivada sin cuerpo.' })
  @ApiBadRequestResponse({ description: 'El id no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere rol ADMIN.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> { await this.atraccionesService.remove(id); }
}
