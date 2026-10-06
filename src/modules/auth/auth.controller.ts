import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { AuthResponse, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una cuenta CLIENTE' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ type: AuthResponseDto, description: 'Cuenta CLIENTE creada; devuelve JWT y datos públicos del usuario.' })
  @ApiBadRequestResponse({ description: 'DTO inválido o cédula ecuatoriana inválida.' })
  @ApiConflictResponse({ description: 'Email o cédula ya registrados.' })
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'DTO inválido.' })
  @ApiUnauthorizedResponse({ description: 'Credenciales incorrectas.' })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }
}
