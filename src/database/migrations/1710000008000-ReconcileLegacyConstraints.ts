import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReconcileLegacyConstraints1710000008000 implements MigrationInterface {
  name = 'ReconcileLegacyConstraints1710000008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // CREATE TABLE IF NOT EXISTS in the initial migration cannot add checks/FKs
    // to tables that were created before migrations became the schema source.
    for (const [table, name, expression] of [
      ['disponibilidad_turnos', 'disponibilidad_turnos_capacidad_total_check', 'capacidad_total >= 0'],
      ['disponibilidad_turnos', 'disponibilidad_turnos_check', 'cupos_reservados >= 0 AND cupos_reservados <= capacidad_total'],
      ['pagos', 'pagos_monto_pagado_check', 'monto_pagado >= 0'],
      ['paquetes_experiencias', 'paquetes_experiencias_precio_unitario_check', 'precio_unitario >= 0'],
    ]) {
      const existing = await queryRunner.getTable(table);
      if (!existing?.checks.some(check => check.name === name)) {
        await queryRunner.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression})`);
      }
    }
    const comments = await queryRunner.getTable('comentarios');
    if (!comments?.foreignKeys.some(key => key.columnNames.join(',') === 'user_id' && key.referencedTableName === 'users')) {
      await queryRunner.query(`ALTER TABLE comentarios ADD CONSTRAINT comentarios_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
    }
  }

  async down(): Promise<void> {
    // Keep the original schema's integrity guarantees when rolling back this
    // reconciliation; these constraints also exist before it on a fresh DB.
  }
}
