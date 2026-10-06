import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReservationIntegrity1710000004000 implements MigrationInterface {
  name = 'ReservationIntegrity1710000004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'reservas_atracciones'`);
    const names = new Set<string>(columns.map((row: { column_name: string }) => row.column_name));
    if (names.has('idempotencyKey') && !names.has('idempotency_key')) {
      await queryRunner.query('ALTER TABLE reservas_atracciones RENAME COLUMN "idempotencyKey" TO idempotency_key');
    }
    await queryRunner.query('ALTER TABLE reservas_atracciones ADD COLUMN IF NOT EXISTS request_fingerprint varchar(64)');
    await queryRunner.query('ALTER TABLE reservas_atracciones ADD COLUMN IF NOT EXISTS codigo_reserva varchar(40)');
    await queryRunner.query('ALTER TABLE reservas_atracciones ADD COLUMN IF NOT EXISTS turno_id uuid');
    await queryRunner.query(`UPDATE reservas_atracciones SET codigo_reserva = 'BR-' || upper(replace(id::text, '-', '')) WHERE codigo_reserva IS NULL`);
    await queryRunner.query(`UPDATE reservas_atracciones r SET turno_id = d.id FROM disponibilidad_turnos d
      WHERE r.turno_id IS NULL AND d.atraccion_id = r.atraccion_id AND d.fecha = r.date AND r.time IS NOT NULL AND r.time <> '' AND d.hora_inicio = r.time::time`);
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN codigo_reserva SET NOT NULL');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_reservas_codigo_reserva ON reservas_atracciones(codigo_reserva)');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_paquete_id_atraccion ON paquetes_experiencias(id, atraccion_id)');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_id_atraccion ON disponibilidad_turnos(id, atraccion_id)');
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT IF EXISTS reservas_atracciones_paquete_id_fkey');
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT IF EXISTS fk_reserva_paquete_atraccion');
    await queryRunner.query(`ALTER TABLE reservas_atracciones ADD CONSTRAINT fk_reserva_paquete_atraccion
      FOREIGN KEY (paquete_id, atraccion_id) REFERENCES paquetes_experiencias(id, atraccion_id)`);
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT IF EXISTS fk_reserva_turno_atraccion');
    await queryRunner.query(`ALTER TABLE reservas_atracciones ADD CONSTRAINT fk_reserva_turno_atraccion
      FOREIGN KEY (turno_id, atraccion_id) REFERENCES disponibilidad_turnos(id, atraccion_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT IF EXISTS fk_reserva_turno_atraccion');
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT IF EXISTS fk_reserva_paquete_atraccion');
    await queryRunner.query('DROP INDEX IF EXISTS uq_turno_id_atraccion');
    await queryRunner.query('DROP INDEX IF EXISTS uq_paquete_id_atraccion');
    await queryRunner.query('DROP INDEX IF EXISTS uq_reservas_codigo_reserva');
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP COLUMN IF EXISTS codigo_reserva, DROP COLUMN IF EXISTS request_fingerprint, DROP COLUMN IF EXISTS turno_id');
  }
}
