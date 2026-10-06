import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse,
  ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam,
  ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuthenticatedUser, AtraccionesService } from './atracciones.service';
import { ComentarioResponseDto, CreateComentarioDto } from './dto/comentario.dto';

@ApiTags('Comentarios')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('atracciones/:id/comentarios')
export class ComentariosController {
  constructor(private readonly attractions: AtraccionesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Comentar una atracción', description: 'Requiere JWT y una reserva CONFIRMADA propia para la atracción. Cada reserva admite un comentario.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'UUID de la atracción.' })
  @ApiCreatedResponse({ type: ComentarioResponseDto })
  @ApiBadRequestResponse({ description: 'Puntuación fuera de 1..5 o cuerpo inválido.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Se requiere una reserva CONFIRMADA propia para esta atracción.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  @ApiConflictResponse({ description: 'La reserva ya tiene un comentario.' })
  @ApiBody({ type: CreateComentarioDto })
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateComentarioDto, @Req() req: { user: AuthenticatedUser }) {
    return this.attractions.createComment(id, dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar comentarios de una atracción' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ComentarioResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'El id no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  list(@Param('id', ParseUUIDPipe) id: string) { return this.attractions.getComments(id); }
}
