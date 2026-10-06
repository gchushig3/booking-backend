import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReservationUserIntegrity1710000006000 implements MigrationInterface {
  name = 'ReservationUserIntegrity1710000006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE reservas_atracciones
      ADD CONSTRAINT fk_reserva_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE RESTRICT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT fk_reserva_user');
  }
}
