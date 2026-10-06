import { MigrationInterface, QueryRunner } from 'typeorm';

export class ParticipantSnapshots1710000002000 implements MigrationInterface {
  name = 'ParticipantSnapshots1710000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reservas_atracciones ADD COLUMN num_ninos integer NOT NULL DEFAULT 0');
    await queryRunner.query('ALTER TABLE reservas_atracciones ADD COLUMN total_cupos_ocupados integer NOT NULL DEFAULT 0');
    await queryRunner.query('UPDATE reservas_atracciones SET num_adultos = ticket_count, num_ninos = 0, total_cupos_ocupados = ticket_count');
    await queryRunner.query(`ALTER TABLE reservas_atracciones ADD CONSTRAINT chk_reservation_seat_snapshot
      CHECK (num_adultos >= 0 AND num_ninos >= 0 AND total_cupos_ocupados = num_adultos + num_ninos AND total_cupos_ocupados = ticket_count)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT IF EXISTS chk_reservation_seat_snapshot');
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP COLUMN IF EXISTS total_cupos_ocupados, DROP COLUMN IF EXISTS num_ninos');
  }
}
