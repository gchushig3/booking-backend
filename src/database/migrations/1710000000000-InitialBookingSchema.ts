import { MigrationInterface, QueryRunner } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function sqlStatements(relativePath: string): string[] {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
    .split(';').map((statement) => statement.trim()).filter(Boolean);
}

export class InitialBookingSchema1710000000000 implements MigrationInterface {
  name = 'InitialBookingSchema1710000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of [
      ...sqlStatements('docker/init/01-init-atracciones.sql'),
      ...sqlStatements('docker/init/03-package-pricing-columns.sql'),
      ...sqlStatements('src/database/booking-schema.sql'),
    ]) await queryRunner.query(statement);

    await queryRunner.query(`ALTER TABLE reservas_atracciones
      ADD COLUMN IF NOT EXISTS codigo_reserva varchar(40),
      ADD COLUMN IF NOT EXISTS turno_id uuid,
      ADD COLUMN IF NOT EXISTS request_fingerprint varchar(64),
      ADD COLUMN IF NOT EXISTS num_adultos integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS edades_ninos jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS descuentos numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS monto_total numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paquete_id uuid REFERENCES paquetes_experiencias(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('CLIENTE','ADMIN'))`);
    await queryRunner.query(`ALTER TABLE reservas_atracciones ADD CONSTRAINT chk_reserva_participants CHECK (ticket_count > 0 AND num_adultos >= 0)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_reservas_user_created ON reservas_atracciones("userId", "createdAt" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_eventos_type_created ON observabilidad_eventos(tipo_evento, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_comments_attraction_created ON comentarios(atraccion_id, fecha_creacion DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_comments_attraction_created');
    await queryRunner.query('DROP INDEX IF EXISTS idx_eventos_type_created');
    await queryRunner.query('DROP INDEX IF EXISTS idx_reservas_user_created');
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT IF EXISTS chk_reserva_participants');
    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role');
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP COLUMN IF EXISTS paquete_id, DROP COLUMN IF EXISTS monto_total, DROP COLUMN IF EXISTS descuentos, DROP COLUMN IF EXISTS subtotal, DROP COLUMN IF EXISTS edades_ninos, DROP COLUMN IF EXISTS num_adultos');
    await queryRunner.query('DROP TABLE IF EXISTS observabilidad_eventos, comentarios, pagos, paquetes_experiencias, disponibilidad_turnos CASCADE');
  }
}
