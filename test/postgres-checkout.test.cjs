const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');
const { DataSource } = require('typeorm');
const { Atraccion } = require('../dist/modules/atracciones/entities/atraccion.entity');
const { PaqueteExperiencia } = require('../dist/modules/atracciones/entities/paquete-experiencia.entity');
const { DisponibilidadTurno } = require('../dist/modules/atracciones/entities/disponibilidad-turno.entity');
const { Reserva } = require('../dist/modules/atracciones/entities/reserva.entity');
const { Pago } = require('../dist/modules/atracciones/entities/pago.entity');
const { ObservabilidadEvento } = require('../dist/modules/atracciones/entities/observabilidad-evento.entity');
const { User } = require('../dist/modules/auth/entities/user.entity');
const { AtraccionesService } = require('../dist/modules/atracciones/atracciones.service');

test('PostgreSQL checkout concurrency, cancellation, and payment failure', async (t) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const ds = app.get(DataSource);
  const service = app.get(AtraccionesService);
  const attractionRepo = ds.getRepository(Atraccion);
  const packageRepo = ds.getRepository(PaqueteExperiencia);
  const slotRepo = ds.getRepository(DisponibilidadTurno);
  const reservationRepo = ds.getRepository(Reserva);
  const paymentRepo = ds.getRepository(Pago);
  const eventRepo = ds.getRepository(ObservabilidadEvento);
  const userRepo = ds.getRepository(User);
  const testEmail = `checkout-${randomUUID()}@example.test`;
  const port = app.getHttpServer().address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const authResponse = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Checkout Integration', email: testEmail, password: 'Integration123!', cedula_dni: '1710034065' }) });
  assert.equal(authResponse.status, 201);
  const authData = await authResponse.json();
  const authHeaders = { 'content-type': 'application/json', authorization: `Bearer ${authData.accessToken}` };
  const adminUser = await userRepo.save(userRepo.create({ name: 'Admin integration', email: `admin-${randomUUID()}@example.test`, cedula_dni: null, role: 'ADMIN', passwordHash: 'test-hash' }));
  const adminToken = await app.get(JwtService).signAsync({ sub: adminUser.id, role: 'ADMIN', type: 'user' });
  const adminHeaders = { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` };
  const clientAdminAttempt = await fetch(`${baseUrl}/admin/reservas`, { headers: authHeaders });
  const adminSuccess = await fetch(`${baseUrl}/admin/reservas`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(clientAdminAttempt.status, 403, 'CLIENTE token cannot call an ADMIN route');
  assert.equal(adminSuccess.status, 200, 'ADMIN token can call the administrative reservations route');
  const attraction = await attractionRepo.save(attractionRepo.create({
    nombre: 'Integration checkout', descripcion: 'Attraction created by PostgreSQL integration test.', ciudad: 'Quito',
    provincia: 'Pichincha', region: 'Sierra', categoria: 'Test', latitud: 0, longitud: 0, precioTicket: 30,
    precioBase: 30, cuposTotales: 10, duracionHoras: 2, estaActivo: true,
    tipoExperienciaPermitidos: ['SINGLE_TICKET'], horariosDisponibles: ['10:00'], product_type: 'SINGLE_TICKET',
  }));
  const pkg = await packageRepo.save(packageRepo.create({
    atraccionId: attraction.id, tipoExperiencia: 'SINGLE_TICKET', nombrePaquete: 'Integration package',
    precioUnitario: '30', minParticipantes: 1, maxParticipantes: null,
    politicasJson: { edad_nino_gratis_hasta: 10, cancelacion: { permitida: true, horas_antes: 24 } },
  }));
  const request = (adults = 1, children = [], date = '2027-01-10') => ({
    paquete_id: pkg.id, date, time: '10:00', num_adultos: adults, ninos: children,
    product_type: 'SINGLE_TICKET', customer_name: 'Integration Test', metodo_pago: 'CREDIT_CARD',
  });
  const reserve = async (key, body = request()) => {
    const response = await fetch(`${baseUrl}/atracciones/${attraction.id}/reservations`, {
      method: 'POST', headers: { ...authHeaders, 'x-idempotency-key': key }, body: JSON.stringify(body),
    });
    return { response, data: await response.json() };
  };
  let foreignAttractionId;
  try {
    const attractionList = await fetch(`${baseUrl}/atracciones?page=1&limit=100&product_type=SINGLE_TICKET`).then((response) => response.json());
    const attractionSearch = await fetch(`${baseUrl}/atracciones/search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currency: 'USD', cities: [], countries: [],
        dates: { start_date: '2027-01-01', end_date: '2027-01-31' }, rows: 100,
        sort: { by: 'most_popular' }, product_type: 'SINGLE_TICKET' }),
    }).then((response) => response.json());
    const attractionDetail = await fetch(`${baseUrl}/atracciones/${attraction.id}`).then((response) => response.json());
    const batchDetails = await fetch(`${baseUrl}/atracciones/details`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attractions: [attraction.id], product_type: 'SINGLE_TICKET' }),
    }).then((response) => response.json());
    const commonKeys = Object.keys(attractionDetail).sort();
    assert.deepEqual(Object.keys(attractionList.data.find((item) => item.id === attraction.id)).sort(), commonKeys);
    assert.deepEqual(Object.keys(attractionSearch.data.find((item) => item.id === attraction.id)).sort(), commonKeys);
    assert.deepEqual(Object.keys(batchDetails.data[0]).sort(), commonKeys);
    assert.equal(attractionDetail.name, 'Integration checkout');

    const attractionPackages = await fetch(`${baseUrl}/atracciones/${attraction.id}/paquetes`).then((response) => response.json());
    assert.equal(attractionPackages.length, 1);
    assert.equal(attractionPackages[0].tipo_experiencia, 'SINGLE_TICKET');
    assert.equal(attractionPackages[0].precio_unitario, 30);
    assert.equal(attractionPackages[0].min_participantes, 1);
    assert.equal(attractionPackages[0].politicas_json.edad_nino_gratis_hasta, 10);

    const pkgB = await packageRepo.save(packageRepo.create({
      atraccionId: attraction.id, tipoExperiencia: pkg.tipoExperiencia, nombrePaquete: 'Package B same modality',
      precioUnitario: '80', minParticipantes: 3, maxParticipantes: 4, politicasJson: { edad_nino_gratis_hasta: 0 },
    }));
    const packageBody = (packageId, adults = 2, children = [{ edad: 8 }], date = '2027-02-01') => {
      const body = { ...request(adults, children, date), paquete_id: packageId };
      delete body.product_type; // Derive the modality from the selected package.
      return body;
    };
    await t.test('reserves A and B of the same modality with exact package IDs, prices and child policies', async () => {
      const a = await reserve(randomUUID(), packageBody(pkg.id));
      const b = await reserve(randomUUID(), packageBody(pkgB.id));
      assert.equal(a.response.status, 201); assert.equal(b.response.status, 201);
      assert.equal(a.data.product_type, 'SINGLE_TICKET'); assert.equal(b.data.product_type, a.data.product_type);
      assert.equal(a.data.total_price.total, 60, 'A uses price 30 and its free-child threshold 10');
      assert.equal(b.data.total_price.total, 240, 'B uses price 80 and its free-child threshold 0');
      const savedA = await reservationRepo.findOneByOrFail({ id: a.data.reservation_id });
      const savedB = await reservationRepo.findOneByOrFail({ id: b.data.reservation_id });
      assert.equal(savedA.paqueteId, pkg.id); assert.equal(savedB.paqueteId, pkgB.id);
      assert.notEqual(savedA.paqueteId, savedB.paqueteId);
      assert.equal(savedA.totalCuposOcupados, 3); assert.equal(savedB.totalCuposOcupados, 3);
      assert.equal(Number(savedA.descuentos), 30); assert.equal(Number(savedB.descuentos), 0);
      const rows = await ds.query('SELECT paquete_id FROM reservas_atracciones WHERE id = ANY($1::uuid[])', [[savedA.id, savedB.id]]);
      assert.deepEqual(new Set(rows.map(row => row.paquete_id)), new Set([pkg.id, pkgB.id]));
    });
    await t.test('uses the selected package minimum and maximum', async () => {
      assert.equal((await reserve(randomUUID(), packageBody(pkgB.id, 2, [], '2027-02-02'))).response.status, 400);
      assert.equal((await reserve(randomUUID(), packageBody(pkgB.id, 5, [], '2027-02-02'))).response.status, 400);
      assert.equal((await reserve(randomUUID(), packageBody(pkg.id, 2, [], '2027-02-02'))).response.status, 201);
      assert.equal((await reserve(randomUUID(), packageBody(pkgB.id, 3, [], '2027-02-02'))).response.status, 201);
      assert.equal((await reserve(randomUUID(), packageBody(pkgB.id, 4, [], '2027-02-03'))).response.status, 201);
    });
    await t.test('same key and package replays the result, changing only paquete_id conflicts', async () => {
      const key = randomUUID(); const body = packageBody(pkg.id, 3, [], '2027-02-04');
      const first = await reserve(key, body); const retry = await reserve(key, body);
      assert.equal(first.response.status, 201); assert.equal(retry.response.status, 201);
      assert.equal(first.data.reservation_id, retry.data.reservation_id);
      assert.equal(first.data.payment.transaccion_hash, retry.data.payment.transaccion_hash);
      const mismatch = await reserve(key, { ...body, paquete_id: pkgB.id });
      assert.equal(mismatch.response.status, 409); assert.equal(mismatch.data.code, 'IDEMPOTENCY_KEY_REUSED');
      const saved = await reservationRepo.findOneByOrFail({ id: first.data.reservation_id });
      assert.equal(saved.paqueteId, pkg.id);
      assert.equal(await reservationRepo.count({ where: { date: '2027-02-04' } }), 1);
      assert.equal((await slotRepo.findOneByOrFail({ atraccionId: attraction.id, fecha: '2027-02-04', horaInicio: '10:00' })).cuposReservados, 3);
    });
    await t.test('rejects a missing or malformed package UUID and a nonexistent package', async () => {
      const missing = packageBody(pkg.id); delete missing.paquete_id;
      assert.equal((await reserve(randomUUID(), missing)).response.status, 400);
      assert.equal((await reserve(randomUUID(), { ...missing, paquete_id: 'not-a-uuid' })).response.status, 400);
      assert.equal((await reserve(randomUUID(), packageBody(randomUUID()))).response.status, 404);
    });
    await t.test('rejects a package from another attraction without persisting a reservation', async () => {
      const foreignAttraction = await attractionRepo.save(attractionRepo.create({ ...attraction, id: undefined, nombre: 'Foreign package attraction' }));
      foreignAttractionId = foreignAttraction.id;
      const foreignPkg = await packageRepo.save(packageRepo.create({ ...pkg, id: undefined, atraccionId: foreignAttractionId }));
      const key = randomUUID(); const result = await reserve(key, packageBody(foreignPkg.id));
      assert.equal(result.response.status, 400);
      assert.equal(await reservationRepo.count({ where: { idempotencyKey: key } }), 0);
    });
    await t.test('optional compatibility modality must match the package', async () => {
      const body = { ...packageBody(pkg.id, 1, [], '2027-02-05'), product_type: 'PACKAGE' };
      assert.equal((await reserve(randomUUID(), body)).response.status, 400);
      body.product_type = 'SINGLE_TICKET';
      assert.equal((await reserve(randomUUID(), body)).response.status, 201);
    });
    await t.test('rejects frontend prices, limits and policies as checkout inputs', async () => {
      const before = await reservationRepo.count();
      for (const extra of [{ precio_unitario: 0 }, { monto_total: 0 }, { politicas_json: { edad_nino_gratis_hasta: 17 } }, { min_participantes: 0 }, { max_participantes: 999 }]) {
        const result = await reserve(randomUUID(), { ...packageBody(pkgB.id), ...extra });
        assert.equal(result.response.status, 400);
      }
      assert.equal(await reservationRepo.count(), before);
    });

    const capacitySlot = await slotRepo.save(slotRepo.create({ atraccionId: attraction.id, fecha: '2027-01-10', horaInicio: '10:00', capacidadTotal: 5, cuposReservados: 0 }));
    const attempts = await Promise.all(Array.from({ length: 10 }, () => reserve(randomUUID())));
    assert.equal(attempts.filter((item) => item.response.status === 201).length, 5);
    const rejected = attempts.filter((item) => item.response.status === 409);
    assert.equal(rejected.length, 5);
    assert.ok(rejected.every((item) => item.data.code === 'INSUFFICIENT_AVAILABILITY'));
    assert.equal((await slotRepo.findOneByOrFail({ id: capacitySlot.id })).cuposReservados, 5);
    assert.equal(await reservationRepo.count({ where: { date: '2027-01-10', status: 'CONFIRMADA' } }), 5);
    assert.equal(await paymentRepo.count({ where: { reserva: { date: '2027-01-10' } } }), 5);
    await t.test('PostgreSQL rejects invalid capacity, prices and a reservation without an attraction', async () => {
      for (const [sql, values] of [
        ['UPDATE disponibilidad_turnos SET cupos_reservados=capacidad_total+1 WHERE id=$1', [capacitySlot.id]],
        ['UPDATE disponibilidad_turnos SET cupos_reservados=-1 WHERE id=$1', [capacitySlot.id]],
        ['UPDATE disponibilidad_turnos SET capacidad_total=-1 WHERE id=$1', [capacitySlot.id]],
        ['UPDATE paquetes_experiencias SET precio_unitario=-1 WHERE id=$1', [pkg.id]],
        ['UPDATE pagos SET monto_pagado=-1 WHERE reserva_id=$1', [attempts.find(item => item.response.status === 201).data.reservation_id]],
      ]) await assert.rejects(ds.query(sql, values), error => error.driverError?.code === '23514');
      await assert.rejects(ds.query('UPDATE reservas_atracciones SET atraccion_id=NULL WHERE id=$1', [attempts.find(item => item.response.status === 201).data.reservation_id]), error => error.driverError?.code === '23502');
      assert.equal((await slotRepo.findOneByOrFail({ id: capacitySlot.id })).cuposReservados, 5);
    });

    const idempotencyKey = randomUUID();
    const firstCheckout = await reserve(idempotencyKey, request(1, [], '2027-01-14'));
    const retryCheckout = await reserve(idempotencyKey, request(1, [], '2027-01-14'));
    assert.equal(firstCheckout.response.status, 201);
    assert.equal(retryCheckout.response.status, 201);
    assert.equal(retryCheckout.data.reservation_id, firstCheckout.data.reservation_id);
    assert.equal(retryCheckout.data.payment.transaccion_hash, firstCheckout.data.payment.transaccion_hash);
    assert.equal(await reservationRepo.count({ where: { date: '2027-01-14' } }), 1);
    assert.equal(await paymentRepo.count({ where: { reserva: { date: '2027-01-14' } } }), 1);
    assert.equal((await slotRepo.findOneByOrFail({ atraccionId: attraction.id, fecha: '2027-01-14', horaInicio: '10:00' })).cuposReservados, 1);
    await t.test('concurrent identical checkout keys persist one reservation, payment and capacity increment', async () => {
      const key = randomUUID();
      const results = await Promise.all(Array.from({ length: 6 }, () => reserve(key, request(1, [], '2027-03-01'))));
      assert.ok(results.every(result => result.response.status === 201));
      assert.equal(new Set(results.map(result => result.data.reservation_id)).size, 1);
      assert.equal(await reservationRepo.count({ where: { idempotencyKey: key } }), 1);
      assert.equal(await paymentRepo.count({ where: { reserva: { id: results[0].data.reservation_id } } }), 1);
      assert.equal((await slotRepo.findOneByOrFail({ atraccionId: attraction.id, fecha: '2027-03-01', horaInicio: '10:00' })).cuposReservados, 1);
    });
    const mismatchedRetry = await reserve(idempotencyKey, request(1, [], '2027-01-15'));
    assert.equal(mismatchedRetry.response.status, 409);
    assert.equal(mismatchedRetry.data.code, 'IDEMPOTENCY_KEY_REUSED');

    await slotRepo.update(capacitySlot.id, { capacidadTotal: 10 });
    const cancellation = await reserve(randomUUID(), request(2, [{ edad: 8 }], '2027-01-11'));
    assert.equal(cancellation.response.status, 201);
    const saved = await reservationRepo.findOneByOrFail({ id: cancellation.data.reservation_id });
    assert.equal(saved.ticket_count, 3);
    assert.equal(saved.numAdultos, 2);
    assert.equal(saved.numNinos, 1);
    assert.equal(saved.totalCuposOcupados, 3);
    assert.equal(Number(saved.montoTotal), 60);
    const cancelBody = { reason: 'Test cancellation' };
    const cancel = () => fetch(`${baseUrl}/atracciones/reservations/${saved.id}/cancel`, {
      method: 'POST', headers: { ...authHeaders, 'x-idempotency-key': randomUUID() }, body: JSON.stringify(cancelBody),
    });
    assert.equal((await cancel()).status, 200);
    assert.equal((await cancel()).status, 200);
    assert.equal((await reservationRepo.findOneByOrFail({ id: saved.id })).status, 'CANCELADA');
    const cancellationSlot = await slotRepo.findOneByOrFail({ atraccionId: attraction.id, fecha: '2027-01-11', horaInicio: '10:00' });
    assert.equal(cancellationSlot.cuposReservados, 0);
    await t.test('concurrent cancellation releases capacity exactly once', async () => {
      const created = await reserve(randomUUID(), request(2, [{ edad: 8 }], '2027-03-02'));
      assert.equal(created.response.status, 201);
      const responses = await Promise.all(Array.from({ length: 6 }, () => fetch(`${baseUrl}/atracciones/reservations/${created.data.reservation_id}/cancel`, {
        method: 'POST', headers: { ...authHeaders, 'x-idempotency-key': randomUUID() }, body: JSON.stringify(cancelBody),
      })));
      assert.ok(responses.every(response => response.status === 200));
      assert.equal((await reservationRepo.findOneByOrFail({ id: created.data.reservation_id })).status, 'CANCELADA');
      assert.equal((await slotRepo.findOneByOrFail({ atraccionId: attraction.id, fecha: '2027-03-02', horaInicio: '10:00' })).cuposReservados, 0);
    });
    await t.test('PostgreSQL rejects orphan reservation owners and deleting a referenced owner', async () => {
      await assert.rejects(ds.query('UPDATE reservas_atracciones SET "userId"=$1 WHERE id=$2', [randomUUID(), saved.id]), error => error.driverError?.code === '23503');
      await assert.rejects(userRepo.delete(authData.user.id), error => error.driverError?.code === '23503');
      assert.equal((await reservationRepo.findOneByOrFail({ id: saved.id })).userId, authData.user.id);
    });

    const commentsUrl = `${baseUrl}/atracciones/${attraction.id}/comentarios`;
    const postComment = (reservationId, score = 5) => fetch(commentsUrl, { method: 'POST', headers: authHeaders,
      body: JSON.stringify({ reservation_id: reservationId, puntuacion: score, comentario: 'Experiencia excelente.' }) });
    assert.equal((await postComment(randomUUID())).status, 403);
    assert.equal((await postComment(saved.id)).status, 403);
    const confirmedReservationId = attempts.find((item) => item.response.status === 201).data.reservation_id;
    assert.equal((await postComment(confirmedReservationId, 6)).status, 400);
    assert.equal((await postComment(confirmedReservationId)).status, 201);
    assert.equal((await postComment(confirmedReservationId)).status, 409);
    const commentsResponse = await fetch(commentsUrl, { headers: authHeaders });
    assert.equal(commentsResponse.status, 200);
    assert.equal((await commentsResponse.json()).length, 1);

    const countBefore = await reservationRepo.count();
    const paymentsBefore = await paymentRepo.count();
    const failedSlot = await slotRepo.save(slotRepo.create({ atraccionId: attraction.id, fecha: '2027-01-12', horaInicio: '10:00', capacidadTotal: 10, cuposReservados: 0 }));
    process.env.MOCK_PAYMENT_RESULT = 'FAILED';
    const failedResponse = await reserve(randomUUID(), request(1, [], '2027-01-12'));
    assert.equal(failedResponse.response.status, 409);
    assert.equal(failedResponse.data.code, 'PAYMENT_FAILED');
    delete process.env.MOCK_PAYMENT_RESULT;
    assert.equal(await reservationRepo.count(), countBefore);
    assert.equal(await paymentRepo.count(), paymentsBefore);
    const failedCheckoutSlot = await slotRepo.findOneByOrFail({ id: failedSlot.id });
    assert.equal(failedCheckoutSlot.cuposReservados, 0);
    assert.ok(await eventRepo.findOneBy({ tipoEvento: 'CHECKOUT_FAIL', userId: authData.user.id }));

    const pending = await reserve(randomUUID(), request(2, [], '2027-01-13'));
    assert.equal(pending.response.status, 201);
    const pendingReservation = await reservationRepo.findOne({ where: { id: pending.data.reservation_id }, relations: ['atraccion'] });
    await reservationRepo.update(pendingReservation.id, { status: 'PENDIENTE', createdAt: new Date(Date.now() - 60 * 60_000) });
    const pendingSlot = await slotRepo.findOneByOrFail({ atraccionId: attraction.id, fecha: '2027-01-13', horaInicio: '10:00' });
    assert.equal(await service.expirePendingReservations(), 1);
    assert.equal((await reservationRepo.findOneByOrFail({ id: pendingReservation.id })).status, 'CANCELADA');
    assert.equal((await slotRepo.findOneByOrFail({ id: pendingSlot.id })).cuposReservados, 0);
    assert.equal(await service.expirePendingReservations(), 0);

    const replaceResponse = await fetch(`${baseUrl}/atracciones/${attraction.id}`, {
      method: 'PUT', headers: adminHeaders,
      body: JSON.stringify({ name: 'Updated integration attraction', long_description: 'Updated attraction for REST test.',
        duration: 'PT2H', price: { currency: 'USD', total: 30 }, product_type: 'SINGLE_TICKET',
        includes: [], categories: [], locations: [], photos: [], supported_languages: [], free_cancellation: true }),
    });
    assert.equal(replaceResponse.status, 204);
    assert.equal((await attractionRepo.findOneByOrFail({ id: attraction.id })).nombre, 'Updated integration attraction');

    const deleteResponse = await fetch(`${baseUrl}/atracciones/${attraction.id}`, { method: 'DELETE', headers: adminHeaders });
    assert.equal(deleteResponse.status, 204);
    const softDeletedAttraction = await attractionRepo.findOne({ where: { id: attraction.id }, withDeleted: true });
    assert.ok(softDeletedAttraction.deletedAt instanceof Date, 'DELETE completes its soft-delete before returning');

    const registered = await userRepo.save(userRepo.create({ name: 'Unique ID test', email: `dni-${randomUUID()}@example.test`, cedula_dni: '1729438765', role: 'CLIENTE', passwordHash: 'test-hash' }));
    try {
      await assert.rejects(userRepo.save(userRepo.create({ name: 'Duplicate ID test', email: `other-${randomUUID()}@example.test`, cedula_dni: '1729438765', role: 'CLIENTE', passwordHash: 'test-hash' })),
        (error) => error.driverError?.code === '23505');
    } finally {
      await userRepo.delete(registered.id);
    }
  } finally {
    delete process.env.MOCK_PAYMENT_RESULT;
    await attractionRepo.delete(attraction.id);
    if (foreignAttractionId) await attractionRepo.delete(foreignAttractionId);
    await userRepo.delete({ email: testEmail });
    await userRepo.delete(adminUser.id);
    await app.close();
  }
});
