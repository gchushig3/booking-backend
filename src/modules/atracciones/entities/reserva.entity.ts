import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Atraccion } from './atraccion.entity';
import { ProductType } from '../dto/create-atraccion.dto';

@Entity('reservas_atracciones')
export class Reserva {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'idempotency_key', type: 'uuid', unique: true })
  idempotencyKey: string;

  @Column({ name: 'request_fingerprint', type: 'varchar', length: 64, nullable: true })
  requestFingerprint: string | null;

  @Column({ name: 'codigo_reserva', type: 'varchar', length: 40, unique: true })
  codigoReserva: string;

  @Column({ name: 'turno_id', type: 'uuid', nullable: true })
  turnoId: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', nullable: true })
  time: string;

  @Column({ type: 'int' })
  ticket_count: number;

  @Column({ name: 'num_adultos', type: 'int', default: 1 })
  numAdultos: number;

  @Column({ name: 'num_ninos', type: 'int', default: 0 })
  numNinos: number;

  @Column({ name: 'total_cupos_ocupados', type: 'int', default: 1 })
  totalCuposOcupados: number;

  @Column({ name: 'edades_ninos', type: 'jsonb', default: () => "'[]'::jsonb" })
  edadesNinos: number[];

  @Column({ name: 'subtotal', type: 'numeric', precision: 10, scale: 2, default: 0 })
  subtotal: string;

  @Column({ name: 'descuentos', type: 'numeric', precision: 10, scale: 2, default: 0 })
  descuentos: string;

  @Column({ name: 'monto_total', type: 'numeric', precision: 10, scale: 2, default: 0 })
  montoTotal: string;

  @Column({ name: 'paquete_id', type: 'uuid', nullable: true })
  paqueteId: string | null;

  @Column({ type: 'enum', enum: ProductType, enumName: 'booking_product_type_enum', nullable: true })
  product_type: ProductType | null;

  @Column({ type: 'varchar', length: 150 })
  customer_name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customer_email: string;

  @Column({ type: 'enum', enum: ['PENDIENTE', 'CONFIRMADA', 'CANCELADA'], enumName: 'booking_reservation_status_enum', default: 'CONFIRMADA' })
  status: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA';

  @ManyToOne(() => Atraccion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atraccion_id' })
  atraccion: Atraccion;

  @CreateDateColumn()
  createdAt: Date;
}
