import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentReservationIntegrity1710000005000 implements MigrationInterface {
  name = 'CommentReservationIntegrity1710000005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS reserva_id uuid');
    await queryRunner.query('ALTER TABLE comentarios DROP CONSTRAINT IF EXISTS fk_comentario_reserva');
    await queryRunner.query(`ALTER TABLE comentarios ADD CONSTRAINT fk_comentario_reserva
      FOREIGN KEY (reserva_id) REFERENCES reservas_atracciones(id) ON DELETE CASCADE`);
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_comentario_reserva ON comentarios(reserva_id)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_comentarios_atraccion_fecha ON comentarios(atraccion_id, fecha_creacion DESC)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_comentarios_atraccion_fecha');
    await queryRunner.query('DROP INDEX IF EXISTS uq_comentario_reserva');
    await queryRunner.query('ALTER TABLE comentarios DROP CONSTRAINT IF EXISTS fk_comentario_reserva');
    await queryRunner.query('ALTER TABLE comentarios DROP COLUMN IF EXISTS reserva_id');
  }
}
