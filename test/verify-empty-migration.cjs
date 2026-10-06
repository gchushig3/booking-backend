require('dotenv').config();
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must point to a PostgreSQL account allowed to create a temporary database.');
  const sourceUrl = new URL(process.env.DATABASE_URL);
  const temporaryDatabase = `booking_migration_${randomUUID().replaceAll('-', '')}`;
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${temporaryDatabase}"`);
    const testUrl = new URL(sourceUrl);
    testUrl.pathname = `/${temporaryDatabase}`;
    const migration = spawnSync(process.execPath, ['node_modules/typeorm/cli.js', 'migration:run', '-d', 'dist/database/data-source.js'], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl.toString() }, encoding: 'utf8',
    });
    if (migration.status !== 0) throw new Error(migration.stderr || migration.stdout);
    const target = new Client({ connectionString: testUrl.toString() });
    await target.connect();
    const tables = await target.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    const enumValues = await target.query(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'booking_reservation_status_enum' ORDER BY e.enumsortorder`);
    const definitions = await target.query(`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'`);
    const foreignKeys = await target.query(`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype = 'f'`);
    const checks = await target.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype = 'c'`);
    await target.end();
    const present = new Set(tables.rows.map((row) => row.table_name));
    for (const table of ['users', 'atracciones', 'paquetes_experiencias', 'disponibilidad_turnos', 'reservas_atracciones', 'pagos', 'comentarios', 'observabilidad_eventos']) {
      if (!present.has(table)) throw new Error(`Fresh migration omitted table ${table}`);
    }
    assertEnum(enumValues.rows.map((row) => row.enumlabel), ['PENDIENTE', 'CONFIRMADA', 'CANCELADA']);
    const allIndexes = definitions.rows.map((row) => row.indexdef.toLowerCase()).join('\n');
    for (const column of ['email', 'cedula_dni', 'codigo_reserva', 'atraccion_id, fecha, hora_inicio']) {
      if (!allIndexes.includes(column)) throw new Error(`Fresh migration omitted required unique/search index for ${column}`);
    }
    if (!checks.rows.some((row) => row.definition.includes('puntuacion >= 1') && row.definition.includes('puntuacion <= 5'))) {
      throw new Error('Fresh migration omitted the comment score CHECK constraint.');
    }
    const relations = foreignKeys.rows.map((row) => row.definition).join('\n');
    if (!relations.includes('(paquete_id, atraccion_id)') || !relations.includes('(turno_id, atraccion_id)')) {
      throw new Error('Fresh migration omitted the reservation package/attraction/slot composite foreign keys.');
    }
    process.stdout.write(`Fresh PostgreSQL migration succeeded (${temporaryDatabase}).\n`);
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${temporaryDatabase}" WITH (FORCE)`);
    await admin.end();
  }
}

function assertEnum(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Unexpected reservation status enum: ${actual.join(',')}`);
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
