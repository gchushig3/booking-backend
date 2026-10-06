import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequiredReservationAttraction1710000007000 implements MigrationInterface {
  name = 'RequiredReservationAttraction1710000007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN atraccion_id SET NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN atraccion_id DROP NOT NULL');
  }
}
