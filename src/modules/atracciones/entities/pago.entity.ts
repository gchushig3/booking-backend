import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Reserva } from './reserva.entity';

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'reserva_id', type: 'uuid' }) reservaId: string;
  @ManyToOne(() => Reserva, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'reserva_id' }) reserva: Reserva;
  @Column({ name: 'metodo_pago', type: 'enum', enum: ['CREDIT_CARD', 'PAYPAL'], enumName: 'booking_payment_method_enum' }) metodoPago: 'CREDIT_CARD' | 'PAYPAL';
  @Column({ name: 'titular_tarjeta', type: 'varchar', length: 150, nullable: true }) titularTarjeta: string | null;
  @Column({ name: 'ultimos_cuatro_digitos', type: 'varchar', length: 4, nullable: true }) ultimosCuatroDigitos: string | null;
  @Column({ name: 'monto_pagado', type: 'numeric', precision: 10, scale: 2 }) montoPagado: string;
  @Column({ name: 'transaccion_hash', type: 'varchar', length: 100, unique: true }) transaccionHash: string;
  @CreateDateColumn({ name: 'fecha_pago', type: 'timestamptz' }) fechaPago: Date;
}
