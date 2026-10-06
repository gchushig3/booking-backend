import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Atraccion } from './atraccion.entity';
import { ProductType } from '../dto/create-atraccion.dto';

@Entity('paquetes_experiencias')
export class PaqueteExperiencia {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'atraccion_id', type: 'uuid' }) atraccionId: string;
  @ManyToOne(() => Atraccion, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'atraccion_id' }) atraccion: Atraccion;
  @Column({ name: 'tipo_experiencia', type: 'enum', enum: ProductType, enumName: 'booking_product_type_enum' }) tipoExperiencia: ProductType;
  @Column({ name: 'nombre_paquete', type: 'varchar', length: 100 }) nombrePaquete: string;
  @Column({ type: 'text', nullable: true }) descripcion: string | null;
  @Column({ name: 'precio_unitario', type: 'numeric', precision: 10, scale: 2 }) precioUnitario: string;
  @Column({ name: 'min_participantes', type: 'int', default: 1 }) minParticipantes: number;
  @Column({ name: 'max_participantes', type: 'int', nullable: true }) maxParticipantes: number | null;
  @Column({ name: 'politicas_json', type: 'jsonb', default: () => "'{}'::jsonb" }) politicasJson: Record<string, unknown>;
}
