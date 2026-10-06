import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Ana Pérez' }) name: string;
  @ApiProperty({ example: 'ana@example.com' }) email: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT de acceso; duración configurada por el backend.' }) accessToken: string;
  @ApiProperty({ type: AuthenticatedUserResponseDto }) user: AuthenticatedUserResponseDto;
}
