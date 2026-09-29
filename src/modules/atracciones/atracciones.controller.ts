import { Controller, Get, Post, Body, Patch, Put, Param, Delete, ParseUUIDPipe, Res, HttpCode, HttpStatus, Query, Header, Headers, HttpException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { AtraccionesService } from './atracciones.service';
import { CreateAtraccionDto } from './dto/create-atraccion.dto';
import { UpdateAtraccionDto } from './dto/update-atraccion.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AtraccionResponseDto } from './dto/atraccion-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { SearchAtraccionesDto } from './dto/search-atracciones.dto';
import { SearchAtraccionesResponseDto } from './dto/search-response.dto';
import { DetailsRequestDto } from './dto/details-request.dto';
import { AvailabilityResponseDto } from './dto/availability.dto';
import { ReservationRequestDto, ReservationResponseDto, CancelReservationRequestDto } from './dto/reservation.dto';

@ApiTags('Atracciones')
@Controller('atracciones')
export class AtraccionesController {
  private readonly uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(private readonly atraccionesService: AtraccionesService) {}

  private validateIdempotencyKey(idempotencyKey: string): void {
    if (!idempotencyKey || !this.uuidV4Regex.test(idempotencyKey)) {
      throw new BadRequestException('El encabezado Idempotency-Key debe ser un UUID v4 válido');
    }
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Búsqueda de atracciones (soporta paginación por tokens)' })
  @ApiResponse({ status: 200, description: 'Resultados de la búsqueda.', type: SearchAtraccionesResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request. Datos de entrada inválidos.' })
  search(@Body() searchDto: SearchAtraccionesDto) {
    return this.atraccionesService.search(searchDto);
  }

  @Post('details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener detalles de múltiples atracciones (Batch)' })
  @ApiResponse({ status: 200, description: 'Detalles de atracciones', type: SearchAtraccionesResponseDto })
  async getDetailsBatch(@Body() dto: DetailsRequestDto) {
    return this.atraccionesService.getDetailsBatch(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una nueva atracción' })
  @ApiResponse({ status: 201, description: 'La atracción ha sido creada exitosamente. Devuelve cabecera Location.', type: AtraccionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request. Datos de entrada inválidos.' })
  async create(
    @Body() createAtraccionDto: CreateAtraccionDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<AtraccionResponseDto> {
    const atraccion = await this.atraccionesService.create(createAtraccionDto);
    res.setHeader('Location', `/api/v1/atracciones/${atraccion.id || 'uuid-generado'}`);
    return atraccion as unknown as AtraccionResponseDto;
  }

  @Get()
  @Header('X-API-Deprecation-Date', '2027-12-31')
  @Header('Cache-Control', 'max-age=300')
  @ApiOperation({ summary: 'Obtener el listado paginado de atracciones' })
  @ApiResponse({ status: 200, description: 'Listado de atracciones recuperado exitosamente.', type: PaginatedResponseDto })
  findAll(@Query() query: PaginationQueryDto) {
    return this.atraccionesService.findAll(query);
  }

  @Get('health')
  @ApiOperation({ summary: 'Healthcheck del microservicio para el API Gateway (Reto 2)' })
  @ApiResponse({ status: 200, description: 'Servicio de atracciones operativo.' })
  checkHealth() {
    return { status: 'UP', timestamp: new Date().toISOString() };
  }

  @Get('reservations')
  @ApiOperation({ summary: 'Consultar el historial de reservas del usuario' })
  @ApiResponse({ status: 200, description: 'Listado de reservas.' })
  async getReservations(): Promise<ReservationResponseDto[]> {
    return await this.atraccionesService.getReservations();
  }

  @Get('reservations/:reservationId')
  @ApiOperation({ summary: 'Obtener detalle de una reserva específica' })
  @ApiParam({ name: 'reservationId', description: 'ID de la reserva', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Detalle de la reserva.', type: ReservationResponseDto })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada.' })
  async getReservationById(@Param('reservationId', ParseUUIDPipe) reservationId: string): Promise<ReservationResponseDto> {
    return await this.atraccionesService.getReservationById(reservationId);
  }

  @Get(':id')
  @Header('X-API-Deprecation-Date', '2027-12-31')
  @Header('Cache-Control', 'max-age=300')
  @ApiOperation({ summary: 'Obtener el detalle de una atracción por su ID' })
  @ApiParam({ name: 'id', description: 'UUID de la atracción', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Detalle de la atracción.', type: AtraccionResponseDto })
  @ApiResponse({ status: 404, description: 'Not Found. La atracción no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AtraccionResponseDto> {
    return (await this.atraccionesService.findOne(id)) as unknown as AtraccionResponseDto;
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de cupos' })
  @ApiParam({ name: 'id', description: 'UUID de la atracción', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Disponibilidad recuperada exitosamente.', type: AvailabilityResponseDto })
  @ApiResponse({ status: 404, description: 'Not Found. La atracción no existe.' })
  async getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') date: string
  ): Promise<AvailabilityResponseDto> {
    return await this.atraccionesService.getAvailability(id, date);
  }

  @Post(':id/reservations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una reserva de la atracción' })
  @ApiParam({ name: 'id', description: 'UUID de la atracción', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Reserva confirmada', type: ReservationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  @ApiResponse({ status: 409, description: 'Conflicto de Idempotencia.' })
  async reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() reservationDto: ReservationRequestDto
  ): Promise<ReservationResponseDto> {
    if (!idempotencyKey) {
      throw new HttpException('Idempotency-Key header is required', HttpStatus.BAD_REQUEST);
    }

    this.validateIdempotencyKey(idempotencyKey);

    return await this.atraccionesService.reserve(id, reservationDto, idempotencyKey);
  }

  @Post('reservations/:reservationId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reserva existente (Requiere Idempotency-Key)' })
  @ApiParam({ name: 'reservationId', description: 'ID de la reserva a cancelar', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Reserva cancelada exitosamente.', type: ReservationResponseDto })
  @ApiResponse({ status: 409, description: 'Conflicto de Idempotencia.' })
  async cancelReservation(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CancelReservationRequestDto
  ): Promise<ReservationResponseDto> {
    if (!idempotencyKey) {
      throw new HttpException('Idempotency-Key header is required', HttpStatus.BAD_REQUEST);
    }

    this.validateIdempotencyKey(idempotencyKey);

    return await this.atraccionesService.cancelReservation(reservationId, dto, idempotencyKey);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reemplazar completamente los datos de una atracción' })
  @ApiParam({ name: 'id', description: 'UUID de la atracción', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'La atracción ha sido reemplazada correctamente.' })
  @ApiResponse({ status: 400, description: 'Bad Request. Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'Not Found. La atracción no existe.' })
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createAtraccionDto: CreateAtraccionDto,
  ): void {
    this.atraccionesService.replace(id, createAtraccionDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente los datos de una atracción' })
  @ApiParam({ name: 'id', description: 'UUID de la atracción', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'La atracción ha sido actualizada.', type: AtraccionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request. Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'Not Found. La atracción no existe.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAtraccionDto: UpdateAtraccionDto,
  ): Promise<AtraccionResponseDto> {
    return (await this.atraccionesService.update(id, updateAtraccionDto)) as unknown as AtraccionResponseDto;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar o desactivar una atracción' })
  @ApiParam({ name: 'id', description: 'UUID de la atracción', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'La atracción ha sido eliminada correctamente.' })
  @ApiResponse({ status: 404, description: 'Not Found. La atracción no existe.' })
  remove(@Param('id', ParseUUIDPipe) id: string): void {
    this.atraccionesService.remove(id);
  }
}
