const fs = require('node:fs');
const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { AppModule } = require('../dist/app.module');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const ds = app.get(DataSource);
    const runner = ds.createQueryRunner();
    try {
      const names = ds.entityMetadatas.map(m => m.tableName).sort();
      const tables = [];
      for (const name of names) tables.push(await runner.getTable(name));
      const mismatches = [];
      const details = ds.entityMetadatas.map(meta => {
        const table = tables.find(t => t.name === meta.tableName);
        if (!table) throw new Error(`Missing table ${meta.tableName}`);
        for (const col of meta.columns) {
          const actual = table.columns.find(c => c.name === col.databaseName);
          if (!actual) { mismatches.push(`${meta.tableName}.${col.databaseName}: missing`); continue; }
          const expectedType = ds.driver.normalizeType(col);
          for (const [property, expected, found] of [
            ['type', expectedType, actual.type], ['nullable', col.isNullable, actual.isNullable],
            ['primary', col.isPrimary, actual.isPrimary],
            ['length', col.length || '', actual.length || ''],
            ['precision', col.precision, actual.precision], ['scale', col.scale, actual.scale],
          ]) {
            if (expected !== undefined && expected !== found) mismatches.push(`${meta.tableName}.${col.databaseName} ${property}: entity=${expected}, database=${found}`);
          }
          if (col.enum && JSON.stringify(col.enum.map(String)) !== JSON.stringify(actual.enum)) mismatches.push(`${meta.tableName}.${col.databaseName}: enum mismatch`);
          if (col.default !== undefined) {
            const expected = ds.driver.normalizeDefault(col);
            const clean = v => String(v).replace(/::[\w".\[\] ]+/g, '').replace(/^\((.*)\)$/, '$1');
            const normalize = value => {
              const result = clean(value);
              if (expectedType === 'jsonb') {
                try { return JSON.stringify(JSON.parse(result.replace(/^'|'$/g, ''))); } catch {}
              }
              return result;
            };
            if (normalize(expected) !== normalize(actual.default)) mismatches.push(`${meta.tableName}.${col.databaseName} default: entity=${expected}, database=${actual.default}`);
          }
        }
        return { name: meta.tableName, columns: table.columns, foreignKeys: table.foreignKeys, uniques: table.uniques, indices: table.indices, checks: table.checks };
      });
      const constraints = await ds.query(`SELECT c.relname AS table_name, p.conname, p.contype, pg_get_constraintdef(p.oid) AS definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,p.conname`);
      const indexes = await ds.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`);
      for (const table of details) {
        if (!table.columns.some(c => c.name === 'id' && c.isPrimary && !c.isNullable)) mismatches.push(`${table.name}: missing required id PK`);
      }
      for (const [name, columns] of [
        ['users', ['email']], ['users', ['cedula_dni']], ['reservas_atracciones', ['idempotency_key']],
        ['reservas_atracciones', ['codigo_reserva']], ['pagos', ['transaccion_hash']], ['comentarios', ['reserva_id']],
        ['disponibilidad_turnos', ['atraccion_id', 'fecha', 'hora_inicio']],
      ]) {
        const table = details.find(t => t.name === name);
        if (![...table.uniques, ...table.indices.filter(i => i.isUnique)].some(i => JSON.stringify(i.columnNames) === JSON.stringify(columns))) mismatches.push(`${name}: missing UNIQUE ${columns}`);
      }
      for (const [name, columns, target] of [
        ['paquetes_experiencias', 'atraccion_id', 'atracciones'], ['disponibilidad_turnos', 'atraccion_id', 'atracciones'],
        ['reservas_atracciones', 'atraccion_id', 'atracciones'], ['reservas_atracciones', 'userId', 'users'],
        ['reservas_atracciones', 'paquete_id,atraccion_id', 'paquetes_experiencias'], ['reservas_atracciones', 'turno_id,atraccion_id', 'disponibilidad_turnos'],
        ['pagos', 'reserva_id', 'reservas_atracciones'], ['comentarios', 'atraccion_id', 'atracciones'],
        ['comentarios', 'user_id', 'users'], ['comentarios', 'reserva_id', 'reservas_atracciones'],
      ]) {
        if (!details.find(t => t.name === name).foreignKeys.some(f => f.columnNames.join(',') === columns && f.referencedTableName === target)) mismatches.push(`${name}: missing FK ${columns} -> ${target}`);
      }
      for (const [name, fragment] of [
        ['disponibilidad_turnos', 'capacidad_total >= 0'], ['disponibilidad_turnos', 'cupos_reservados <= capacidad_total'],
        ['pagos', 'monto_pagado >='], ['paquetes_experiencias', 'precio_unitario >='], ['comentarios', 'puntuacion <= 5'],
        ['reservas_atracciones', 'total_cupos_ocupados = ticket_count'],
      ]) {
        if (!constraints.some(c => c.table_name === name && c.contype === 'c' && c.definition.includes(fragment))) mismatches.push(`${name}: missing CHECK ${fragment}`);
      }
      const migrations = await ds.query('SELECT name FROM migrations ORDER BY timestamp');
      const consistency = await ds.query(`SELECT
        (SELECT count(*) FROM reservas_atracciones WHERE atraccion_id IS NULL)::int AS missing_reservation_attractions,
        (SELECT count(*) FROM reservas_atracciones r LEFT JOIN users u ON u.id=r."userId" WHERE r."userId" IS NOT NULL AND u.id IS NULL)::int AS orphan_reservation_users,
        (SELECT count(*) FROM comentarios c LEFT JOIN users u ON u.id=c.user_id WHERE u.id IS NULL)::int AS orphan_comment_users,
        (SELECT count(*) FROM comentarios c JOIN reservas_atracciones r ON r.id=c.reserva_id WHERE c.atraccion_id<>r.atraccion_id OR c.user_id<>r."userId")::int AS mismatched_comments,
        (SELECT count(*) FROM disponibilidad_turnos WHERE cupos_reservados<0 OR cupos_reservados>capacidad_total)::int AS invalid_capacity,
        (SELECT count(*) FROM disponibilidad_turnos d WHERE d.cupos_reservados<>COALESCE((SELECT sum(r.total_cupos_ocupados) FROM reservas_atracciones r WHERE r.atraccion_id=d.atraccion_id AND r.date=d.fecha AND r.time::time=d.hora_inicio AND r.status IN ('PENDIENTE','CONFIRMADA')),0))::int AS inconsistent_capacity`);
      const version = await ds.query('SELECT version()');
      fs.mkdirSync('contracts/evidence', { recursive: true });
      fs.writeFileSync(process.env.DB_AUDIT_OUTPUT || 'contracts/evidence/database-audit.json', JSON.stringify({ version: version[0].version, synchronize: ds.options.synchronize, migrations, mismatches, consistency: consistency[0], tables: details, constraints, indexes }, null, 2));
      console.log(JSON.stringify({ tables: names, migrations: migrations.length, mismatches, consistency: consistency[0], synchronize: ds.options.synchronize }, null, 2));
      if (mismatches.length || Object.values(consistency[0]).some(v => v !== 0)) process.exitCode = 1;
    } finally { await runner.release(); }
  } finally { await app.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
