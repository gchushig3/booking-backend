import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('observabilidad_eventos')
export class ObservabilidadEvento {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tipo_evento', type: 'varchar', length: 50 }) tipoEvento: string;
  @Column({ name: 'endpoint_ruta', type: 'varchar', length: 200 }) endpointRuta: string;
  @Column({ name: 'latencia_ms', type: 'int', nullable: true }) latenciaMs: number | null;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @Column({ name: 'payload_json', type: 'jsonb', default: () => "'{}'::jsonb" }) payloadJson: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
