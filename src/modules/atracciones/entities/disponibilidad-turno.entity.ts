import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Atraccion } from './atraccion.entity';

@Entity('disponibilidad_turnos')
@Index('UQ_disponibilidad_atraccion_fecha_hora', ['atraccionId', 'fecha', 'horaInicio'], { unique: true })
export class DisponibilidadTurno {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'atraccion_id', type: 'uuid' }) atraccionId: string;
  @ManyToOne(() => Atraccion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atraccion_id' }) atraccion: Atraccion;
  @Column({ type: 'date' }) fecha: string;
  @Column({ name: 'hora_inicio', type: 'time' }) horaInicio: string;
  @Column({ name: 'capacidad_total', type: 'int' }) capacidadTotal: number;
  @Column({ name: 'cupos_reservados', type: 'int', default: 0 }) cuposReservados: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
