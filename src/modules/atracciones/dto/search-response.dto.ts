import { ApiProperty } from '@nestjs/swagger';
import { AtraccionResponseDto } from './atraccion-response.dto';

export class SearchMetadataDto {
  @ApiProperty({ description: 'Total de resultados encontrados', example: 24 })
  total_results: number;

  @ApiProperty({ type: String, description: 'Token de página siguiente; actualmente la búsqueda devuelve null.', nullable: true, example: null })
  next_page: string | null;
}

export class SearchAtraccionesResponseDto {
  @ApiProperty({ type: [AtraccionResponseDto] })
  data: AtraccionResponseDto[];

  @ApiProperty({ type: SearchMetadataDto })
  metadata: SearchMetadataDto;

  @ApiProperty({ example: 'req-1720000000000' })
  request_id: string;
}

export class AtraccionesListMetaDto {
  @ApiProperty({ example: 24 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 3 }) lastPage: number;
}

export class AtraccionesListResponseDto {
  @ApiProperty({ type: [AtraccionResponseDto] }) data: AtraccionResponseDto[];
  @ApiProperty({ type: AtraccionesListMetaDto }) meta: AtraccionesListMetaDto;
}

export class BatchAtraccionesResponseDto {
  @ApiProperty({ example: 'batch-1720000000000' }) request_id: string;
  @ApiProperty({ type: [AtraccionResponseDto] }) data: AtraccionResponseDto[];
}
