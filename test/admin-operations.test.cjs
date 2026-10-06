const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { DataSource } = require('typeorm');
const { AppModule } = require('../dist/app.module');
const { User } = require('../dist/modules/auth/entities/user.entity');

test('ADMIN attraction CRUD and reservations remain operational in PostgreSQL', async t => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
  const db = app.get(DataSource); const users = db.getRepository(User); const ids = [];
  let attractionId;
  const tokens = {};
  const body = { name: 'ADMIN regression ' + randomUUID(), long_description: 'Temporary attraction for ADMIN regression.', duration: 'PT2H', product_type: 'GUIDED_TOUR', includes: [], categories: ['tour_guiado'], locations: [], photos: [], supported_languages: ['es'], free_cancellation: true };
  const request = (role, method, route, payload) => fetch(base + route, { method, headers: { authorization: `Bearer ${tokens[role]}`, 'content-type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  try {
    for (const role of ['ADMIN', 'CLIENTE']) {
      const user = await users.save(users.create({ name: 'Admin regression', email: `${randomUUID()}@example.test`, role, passwordHash: 'test-hash', cedula_dni: null })); ids.push(user.id);
      tokens[role] = await app.get(JwtService).signAsync({ sub: user.id, role, type: 'user' });
    }
    await t.test('ADMIN creates and lists a persisted attraction', async () => {
      const response = await request('ADMIN', 'POST', '/atracciones', body); assert.equal(response.status, 201);
      attractionId = (await response.json()).id;
      const detail = await request('ADMIN', 'GET', `/atracciones/${attractionId}`); assert.equal(detail.status, 200); assert.equal((await detail.json()).name, body.name);
      assert.equal((await request('ADMIN', 'GET', '/atracciones?page=1&limit=10')).status, 200);
      assert.equal((await db.query('SELECT nombre FROM atracciones WHERE id=$1', [attractionId]))[0].nombre, body.name);
    });
    await t.test('CLIENTE cannot create, edit, replace or deactivate attractions', async () => {
      for (const [method, route, payload] of [['POST', '/atracciones', body], ['PATCH', `/atracciones/${attractionId}`, { name: 'Denied mutation' }], ['PUT', `/atracciones/${attractionId}`, body], ['DELETE', `/atracciones/${attractionId}`]]) assert.equal((await request('CLIENTE', method, route, payload)).status, 403);
      assert.equal((await db.query('SELECT nombre FROM atracciones WHERE id=$1', [attractionId]))[0].nombre, body.name);
    });
    await t.test('ADMIN updates then deactivates without deleting the row', async () => {
      assert.equal((await request('ADMIN', 'PATCH', `/atracciones/${attractionId}`, { name: body.name + ' edited' })).status, 200);
      assert.equal((await request('ADMIN', 'DELETE', `/atracciones/${attractionId}`)).status, 204);
      const row = (await db.query('SELECT nombre, "deletedAt" FROM atracciones WHERE id=$1', [attractionId]))[0];
      assert.equal(row.nombre, body.name + ' edited'); assert.ok(row.deletedAt);
    });
    await t.test('ADMIN lists reservations and CLIENTE receives 403', async () => {
      const response = await request('ADMIN', 'GET', '/admin/reservas'); assert.equal(response.status, 200); assert.ok(Array.isArray(await response.json()));
      assert.equal((await request('CLIENTE', 'GET', '/admin/reservas')).status, 403);
    });
  } finally {
    if (attractionId) await db.query('DELETE FROM atracciones WHERE id=$1', [attractionId]);
    for (const id of ids) await users.delete(id);
    await app.close();
  }
});
