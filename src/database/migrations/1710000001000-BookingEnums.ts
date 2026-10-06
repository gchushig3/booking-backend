import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookingEnums1710000001000 implements MigrationInterface {
  name = 'BookingEnums1710000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("CREATE TYPE booking_user_role_enum AS ENUM ('CLIENTE','ADMIN')");
    await queryRunner.query("CREATE TYPE booking_reservation_status_enum AS ENUM ('PENDIENTE','CONFIRMADA','CANCELADA')");
    await queryRunner.query("CREATE TYPE booking_product_type_enum AS ENUM ('SINGLE_TICKET','GUIDED_TOUR','PACKAGE')");
    await queryRunner.query("CREATE TYPE booking_payment_method_enum AS ENUM ('CREDIT_CARD','PAYPAL')");

    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check, DROP CONSTRAINT IF EXISTS chk_users_role');
    await queryRunner.query('ALTER TABLE users ALTER COLUMN role DROP DEFAULT');
    await queryRunner.query('ALTER TABLE users ALTER COLUMN role TYPE booking_user_role_enum USING role::text::booking_user_role_enum');
    await queryRunner.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'CLIENTE'::booking_user_role_enum");

    await queryRunner.query('ALTER TABLE reservas_atracciones DROP CONSTRAINT IF EXISTS reservas_atracciones_status_check');
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN status DROP DEFAULT');
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN status TYPE booking_reservation_status_enum USING status::text::booking_reservation_status_enum');
    await queryRunner.query("ALTER TABLE reservas_atracciones ALTER COLUMN status SET DEFAULT 'CONFIRMADA'::booking_reservation_status_enum");
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN product_type TYPE booking_product_type_enum USING product_type::text::booking_product_type_enum');

    await queryRunner.query('ALTER TABLE atracciones DROP CONSTRAINT IF EXISTS atracciones_product_type_check');
    await queryRunner.query('ALTER TABLE atracciones ALTER COLUMN product_type DROP DEFAULT');
    await queryRunner.query('ALTER TABLE atracciones ALTER COLUMN product_type TYPE booking_product_type_enum USING product_type::text::booking_product_type_enum');
    await queryRunner.query("ALTER TABLE atracciones ALTER COLUMN product_type SET DEFAULT 'SINGLE_TICKET'::booking_product_type_enum");

    await queryRunner.query('ALTER TABLE paquetes_experiencias DROP CONSTRAINT IF EXISTS paquetes_experiencias_tipo_experiencia_check');
    await queryRunner.query('ALTER TABLE paquetes_experiencias ALTER COLUMN tipo_experiencia TYPE booking_product_type_enum USING tipo_experiencia::text::booking_product_type_enum');
    await queryRunner.query('ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check');
    await queryRunner.query('ALTER TABLE pagos ALTER COLUMN metodo_pago TYPE booking_payment_method_enum USING metodo_pago::text::booking_payment_method_enum');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE pagos ALTER COLUMN metodo_pago TYPE varchar(20) USING metodo_pago::text');
    await queryRunner.query('ALTER TABLE paquetes_experiencias ALTER COLUMN tipo_experiencia TYPE varchar(30) USING tipo_experiencia::text');
    await queryRunner.query('ALTER TABLE atracciones ALTER COLUMN product_type DROP DEFAULT');
    await queryRunner.query('ALTER TABLE atracciones ALTER COLUMN product_type TYPE varchar USING product_type::text');
    await queryRunner.query("ALTER TABLE atracciones ALTER COLUMN product_type SET DEFAULT 'SINGLE_TICKET'");
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN product_type TYPE varchar USING product_type::text');
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN status DROP DEFAULT');
    await queryRunner.query('ALTER TABLE reservas_atracciones ALTER COLUMN status TYPE varchar USING status::text');
    await queryRunner.query("ALTER TABLE reservas_atracciones ALTER COLUMN status SET DEFAULT 'CONFIRMADA'");
    await queryRunner.query('ALTER TABLE users ALTER COLUMN role DROP DEFAULT');
    await queryRunner.query('ALTER TABLE users ALTER COLUMN role TYPE varchar(20) USING role::text');
    await queryRunner.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'CLIENTE'");
    await queryRunner.query('DROP TYPE booking_payment_method_enum');
    await queryRunner.query('DROP TYPE booking_product_type_enum');
    await queryRunner.query('DROP TYPE booking_reservation_status_enum');
    await queryRunner.query('DROP TYPE booking_user_role_enum');
  }
}
