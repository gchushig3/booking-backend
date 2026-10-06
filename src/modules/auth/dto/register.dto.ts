import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsEcuadorianId } from '../../../common/validators/ecuadorian-id.validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Pérez', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'ana@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ writeOnly: true, minLength: 8, maxLength: 72, description: 'El backend almacena únicamente un hash.' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: '1710034065', minLength: 10, maxLength: 10, description: 'Cédula ecuatoriana válida. El registro asigna el rol CLIENTE.' })
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  @IsEcuadorianId()
  cedula_dni: string;
}
