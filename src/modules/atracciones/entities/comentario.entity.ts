import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Atraccion } from './atraccion.entity';
import { Reserva } from './reserva.entity';

@Entity('comentarios')
@Check('CHK_comentario_puntuacion', 'puntuacion BETWEEN 1 AND 5')
export class Comentario {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'atraccion_id', type: 'uuid' }) atraccionId: string;
  @ManyToOne(() => Atraccion, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'atraccion_id' }) atraccion: Atraccion;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'reserva_id', type: 'uuid', nullable: true, unique: true }) reservaId: string | null;
  @ManyToOne(() => Reserva, { onDelete: 'CASCADE', nullable: true }) @JoinColumn({ name: 'reserva_id' }) reserva: Reserva | null;
  @Column({ type: 'int' }) puntuacion: number;
  @Column({ type: 'text' }) comentario: string;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamptz' }) fechaCreacion: Date;
}
