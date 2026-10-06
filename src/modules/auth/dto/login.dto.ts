import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ana@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ writeOnly: true, minLength: 1, maxLength: 72 })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
