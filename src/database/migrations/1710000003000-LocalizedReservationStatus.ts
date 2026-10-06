import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocalizedReservationStatus1710000003000 implements MigrationInterface {
  name = 'LocalizedReservationStatus1710000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN status DROP DEFAULT');
    await queryRunner.query("CREATE TYPE booking_reservation_status_localized_enum AS ENUM ('PENDIENTE','CONFIRMADA','CANCELADA')");
    await queryRunner.query(`ALTER TABLE reservas_atracciones ALTER COLUMN status TYPE booking_reservation_status_localized_enum
      USING (CASE status::text WHEN 'PENDING' THEN 'PENDIENTE' WHEN 'CONFIRMED' THEN 'CONFIRMADA' WHEN 'CANCELLED' THEN 'CANCELADA' ELSE status::text END)::booking_reservation_status_localized_enum`);
    await queryRunner.query('DROP TYPE booking_reservation_status_enum');
    await queryRunner.query('ALTER TYPE booking_reservation_status_localized_enum RENAME TO booking_reservation_status_enum');
    await queryRunner.query("ALTER TABLE reservas_atracciones ALTER COLUMN status SET DEFAULT 'CONFIRMADA'::booking_reservation_status_enum");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN status DROP DEFAULT');
    await queryRunner.query("CREATE TYPE booking_reservation_status_legacy_enum AS ENUM ('PENDIENTE','CONFIRMADA','CANCELADA')");
    await queryRunner.query(`ALTER TABLE reservas_atracciones ALTER COLUMN status TYPE booking_reservation_status_legacy_enum
      USING status::text::booking_reservation_status_legacy_enum`);
    await queryRunner.query('DROP TYPE booking_reservation_status_enum');
    await queryRunner.query('ALTER TYPE booking_reservation_status_legacy_enum RENAME TO booking_reservation_status_enum');
    await queryRunner.query("ALTER TABLE reservas_atracciones ALTER COLUMN status SET DEFAULT 'CONFIRMADA'::booking_reservation_status_enum");
  }
}
