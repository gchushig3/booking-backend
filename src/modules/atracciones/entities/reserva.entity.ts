import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Atraccion } from './atraccion.entity';
import { ProductType } from '../dto/create-atraccion.dto';

@Entity('reservas_atracciones')
export class Reserva {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  idempotencyKey: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', nullable: true })
  time: string;

  @Column({ type: 'int' })
  ticket_count: number;

  @Column({ type: 'varchar', nullable: true })
  product_type: ProductType | null;

  @Column({ type: 'varchar', length: 150 })
  customer_name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customer_email: string;

  @Column({ type: 'varchar', default: 'CONFIRMED' })
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';

  @ManyToOne(() => Atraccion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atraccion_id' })
  atraccion: Atraccion;

  @CreateDateColumn()
  createdAt: Date;
}
