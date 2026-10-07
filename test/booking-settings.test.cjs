const test = require('node:test');
const assert = require('node:assert/strict');
const { AtraccionesService } = require('../dist/modules/atracciones/atracciones.service');
const { Atraccion } = require('../dist/modules/atracciones/entities/atraccion.entity');
const { DisponibilidadTurno } = require('../dist/modules/atracciones/entities/disponibilidad-turno.entity');
const { AtraccionesController } = require('../dist/modules/atracciones/atracciones.controller');

test('only ADMIN can mutate packages and slots', () => {
  for (const method of ['savePackage', 'updatePackage', 'saveSlot']) {
    assert.deepEqual(Reflect.getMetadata('roles', AtraccionesController.prototype[method]), ['ADMIN']);
  }
});
test('new attractions start without implicit capacity or hours', async () => {
  const repo = { create: value => value, save: async value => value };
  const service = new AtraccionesService(repo, {}, {}, {}, {});
  const attraction = await service.create({ name: 'Tour', long_description: 'Test attraction', duration: 'PT2H', product_type: 'GUIDED_TOUR' });
  assert.equal(attraction.cuposTotales, 0);
  assert.deepEqual(attraction.horariosDisponibles, []);
});
test('slot changes preserve reservations and enable the configured checkout time', async () => {
  const attraction = { id: 'a', horariosDisponibles: [] };
  const slot = { cuposReservados: 4, capacidadTotal: 10 };
  let saves = 0;
  const manager = { getRepository: entity => entity === Atraccion
    ? { findOne: async () => attraction, save: async value => value }
    : { findOne: async () => slot, save: async value => { saves++; return value; } } };
  const service = new AtraccionesService({}, {}, { transaction: fn => fn(manager) }, {}, {});
  const body = { date: '2026-10-10', time: '11:00', capacidad_total: 3 };
  await assert.rejects(service.saveSlot('a', body), /reservados/);
  assert.equal(saves, 0);
  await service.saveSlot('a', { ...body, capacidad_total: 8 });
  assert.equal(slot.capacidadTotal, 8);
  assert.equal(slot.cuposReservados, 4);
  assert.deepEqual(attraction.horariosDisponibles, ['11:00']);
  await assert.rejects(service.saveSlot('a', { ...body, date: '2026-02-30' }));
});
test('experience participant limits must be consistent', async () => {
  const service = new AtraccionesService({}, {}, {}, {}, {});
  await assert.rejects(service.savePackage('a', { min_participantes: 3, max_participantes: 2 }));
});

test('legacy availability fallback is preserved while new attractions stay closed', async () => {
  const attraction = { horariosDisponibles: [], cuposTotales: 30, product_type: 'SINGLE_TICKET' };
  const query = { leftJoinAndSelect() { return this; }, where() { return this; }, andWhere() { return this; }, getMany: async () => [] };
  const service = new AtraccionesService({ findOne: async () => attraction }, { createQueryBuilder: () => query }, { getRepository: () => ({ find: async () => [] }) }, {}, {});
  const legacy = await service.getAvailability('a', '2027-01-10');
  assert.equal(legacy.available_spots, 30);
  assert.deepEqual(legacy.times, ['09:00', '12:00', '15:00', '18:00']);
  attraction.cuposTotales = 0;
  const newlyCreated = await service.getAvailability('a', '2027-01-10');
  assert.equal(newlyCreated.available_spots, 0);
  assert.deepEqual(newlyCreated.times, []);
});
