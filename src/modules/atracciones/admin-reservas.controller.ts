import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { AtraccionesService } from './atracciones.service';
import { ReservationResponseDto } from './dto/reservation.dto';

@ApiTags('Administración')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/reservas')
export class AdminReservasController {
  constructor(private readonly attractions: AtraccionesService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar todas las reservas', description: 'Requiere Bearer JWT y rol ADMIN.' })
  @ApiOkResponse({ type: ReservationResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere rol ADMIN.' })
  list(): Promise<ReservationResponseDto[]> { return this.attractions.getAllReservations(); }
}
