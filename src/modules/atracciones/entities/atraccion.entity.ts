import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { ColumnNumericTransformer } from '../../../common/transformers/column-numeric.transformer';
import { Reserva } from './reserva.entity';
import { ProductType } from '../dto/create-atraccion.dto';

@Entity('atracciones')
export class Atraccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 100 })
  ciudad: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  provincia: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  region: string;

  @Column({ type: 'varchar', length: 80, default: 'Tours' })
  categoria: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  imagenes: { url: string }[];

  @Column('numeric', { precision: 10, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  precioBase: number;

  @Column({ type: 'int', default: 30 })
  cuposTotales: number;

  @Column({ type: 'jsonb', default: () => "'[\"SINGLE_TICKET\",\"GUIDED_TOUR\",\"PACKAGE\"]'::jsonb" })
  tipoExperienciaPermitidos: ProductType[];

  @Column({ type: 'jsonb', default: () => "'[\"08:00\",\"10:00\",\"14:00\"]'::jsonb" })
  horariosDisponibles: string[];

  @Column({ type: 'jsonb', nullable: true })
  price: { currency: string; total: number } | null;

  @Column({ type: 'jsonb', nullable: true })
  package_prices: Partial<Record<ProductType, { currency: string; total: number }>> | null;

  @Column({ type: 'jsonb', nullable: true })
  operator: { id: number; name: string } | null;

  @Column({ type: 'enum', enum: ProductType, enumName: 'booking_product_type_enum', default: ProductType.SINGLE_TICKET })
  product_type: ProductType;

  @Column({ type: 'jsonb', nullable: true })
  categories: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  includes: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  supported_languages: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  badges: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  locations: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  photos: unknown[] | null;

  @Column('numeric', {
    precision: 10,
    scale: 6,
    transformer: new ColumnNumericTransformer(),
  })
  latitud: number;

  @Column('numeric', {
    precision: 10,
    scale: 6,
    transformer: new ColumnNumericTransformer(),
  })
  longitud: number;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  precioTicket: number;

  @Column({ type: 'int' })
  duracionHoras: number;

  @Column({ type: 'boolean', default: true })
  estaActivo: boolean;

  get name(): string {
    return this.nombre;
  }

  set name(value: string) {
    this.nombre = value;
  }

  get long_description(): string {
    return this.descripcion;
  }

  set long_description(value: string) {
    this.descripcion = value;
  }

  get duration(): string {
    return this.duracionHoras ? `PT${this.duracionHoras}H` : 'PT2H';
  }

  set duration(value: string) {
    const match = value?.match(/PT(?:(\d+)H)?/i);
    this.duracionHoras = match && match[1] ? Number(match[1]) : 2;
  }

  get free_cancellation(): boolean {
    return this.estaActivo;
  }

  set free_cancellation(value: boolean) {
    this.estaActivo = value;
  }

  @OneToMany(() => Reserva, (reserva) => reserva.atraccion)
  reservas: Reserva[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
