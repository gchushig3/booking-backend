const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { DataSource } = require('typeorm');
const { AppModule } = require('../dist/app.module');
const { User } = require('../dist/modules/auth/entities/user.entity');
const { ObservabilidadEvento } = require('../dist/modules/atracciones/entities/observabilidad-evento.entity');
const { safeText, safeUrl } = require('../dist/modules/observabilidad/telemetry-safety');

test('PostgreSQL browser telemetry ingestion, ADMIN authorization and SSE', async t => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
  const ds = app.get(DataSource); const users = ds.getRepository(User); const events = ds.getRepository(ObservabilidadEvento);
  const sessionId = randomUUID(); const fixtureUsers = [];
  async function token(role) {
    const user = await users.save(users.create({ name: 'Telemetry test', email: `${randomUUID()}@example.test`, role, cedula_dni: null, passwordHash: 'test-hash' })); fixtureUsers.push(user.id);
    return app.get(JwtService).signAsync({ sub: user.id, role, type: 'user' });
  }
  const admin = await token('ADMIN'); const client = await token('CLIENTE');
  const headers = { 'content-type': 'application/json' };
  const auth = jwt => ({ authorization: `Bearer ${jwt}` });
  const event = (patch = {}) => ({ category: 'ERROR', type: 'window_error', timestamp: new Date().toISOString(), route: '/actividades?token=secret#private', sessionId, payload: { message: 'Test actual browser error' }, ...patch });
  const ingest = body => fetch(`${base}/observabilidad/eventos`, { method: 'POST', headers, body: JSON.stringify(body) });
  try {
    await t.test('valid public DTO is accepted and persisted without a user identity', async () => {
      const response = await ingest({ events: [event()] }); assert.equal(response.status, 202); assert.deepEqual(await response.json(), { accepted: 1 });
      const row = await events.createQueryBuilder('e').where("e.payload_json->>'sessionId' = :sessionId", { sessionId }).getOne();
      assert.ok(row); assert.equal(row.userId, null); assert.equal(row.endpointRuta, '/actividades'); assert.equal(row.payloadJson.category, 'ERROR');
    });
    await t.test('invalid categories and types are rejected', async () => {
      assert.equal((await ingest({ events: [event({ category: 'PASSWORD' })] })).status, 400);
      assert.equal((await ingest({ events: [event({ type: 'arbitrary' })] })).status, 400);
    });
    await t.test('oversized payload and batch are rejected', async () => {
      assert.equal((await ingest({ events: [event({ payload: { message: 'x'.repeat(3000) } })] })).status, 400);
      assert.equal((await ingest({ events: Array.from({ length: 21 }, () => event()) })).status, 400);
    });
    await t.test('nested payloads and private fields are rejected instead of stored', async () => {
      for (const payload of [{ password: 'secret' }, { message: { token: 'secret' } }, { authorization: 'Bearer secret' }]) assert.equal((await ingest({ events: [event({ payload })] })).status, 400);
      assert.equal((await ingest({ events: [event({ category: 'VIEWPORT', type: 'viewport', payload: { width: 'wrong' } })] })).status, 400);
    });
    await t.test('ADMIN reads recent events and real summary', async () => {
      const response = await fetch(`${base}/admin/observabilidad/eventos`, { headers: auth(admin) }); assert.equal(response.status, 200);
      const snapshot = await response.json(); const found = snapshot.events.find(e => e.sessionId === sessionId); assert.ok(found); assert.equal(found.payload.message, 'Test actual browser error');
      assert.ok(snapshot.summary.counts.ERROR >= 1); assert.equal(snapshot.summary.sampleLimit, 100);
      assert.equal((await fetch(`${base}/admin/observabilidad/resumen`, { headers: auth(admin) })).status, 200);
    });
    await t.test('CLIENTE is rejected with 403 and missing JWT with 401', async () => {
      for (const path of ['eventos', 'resumen', 'stream']) {
        assert.equal((await fetch(`${base}/admin/observabilidad/${path}`, { headers: auth(client) })).status, 403);
        assert.equal((await fetch(`${base}/admin/observabilidad/${path}`)).status, 401);
      }
    });
    await t.test('subsequent ADMIN reads receive newly persisted events for polling', async () => {
      assert.equal((await ingest({ events: [event({ category: 'VISIBILITY', type: 'visibility_change', payload: { state: 'hidden' } })] })).status, 202);
      const response = await fetch(`${base}/admin/observabilidad/eventos`, { headers: auth(admin) });
      assert.ok((await response.json()).events.some(e => e.sessionId === sessionId && e.type === 'visibility_change'));
    });
    await t.test('error messages and URLs are sanitized at the server boundary', async () => {
      assert.equal(safeUrl('https://user:pass@example.test/x?token=secret#private'), 'https://example.test/x');
      assert.equal(safeUrl('data:text/plain,sensitive-content'), '/unsupported-url');
      const safe = safeText('Bearer secret password=private {"cvv":"123"} 1710034065 test@example.test');
      for (const secret of ['secret', 'private', '123', '1710034065', 'test@example.test']) assert.ok(!safe.includes(secret));
      const response = await ingest({ events: [event({ payload: { message: 'password=secret 1710034065' } })] }); assert.equal(response.status, 202);
      const snapshot = await fetch(`${base}/admin/observabilidad/eventos`, { headers: auth(admin) }).then(r => r.json());
      assert.ok(snapshot.events.filter(e => e.sessionId === sessionId).every(e => !JSON.stringify(e).includes('1710034065')));
    });
    await t.test('authenticated SSE delivers newly persisted events and disconnects cleanly', async () => {
      const controller = new AbortController();
      const response = await fetch(`${base}/admin/observabilidad/stream`, { headers: auth(admin), signal: controller.signal });
      assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').includes('text/event-stream'));
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      async function snapshot() {
        for (;;) {
          const boundary = buffer.indexOf('\n\n');
          if (boundary >= 0) {
            const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            const json = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
            if (json) return JSON.parse(json);
          }
          const chunk = await reader.read(); assert.ok(!chunk.done); buffer += decoder.decode(chunk.value, { stream: true });
        }
      }
      try {
        await snapshot();
        const marker = randomUUID();
        assert.equal((await ingest({ events: [event({ payload: { message: marker } })] })).status, 202);
        const next = await Promise.race([snapshot(), new Promise((_, reject) => { const timeout = setTimeout(() => reject(new Error('SSE timeout')), 5000); timeout.unref(); })]);
        assert.ok(next.events.some(e => e.payload.message === marker));
        const stored = await events.createQueryBuilder('e').where("e.payload_json->'payload'->>'message' = :marker", { marker }).getOne(); assert.ok(stored);
      } finally { controller.abort(); await reader.cancel().catch(() => {}); }
    });
    await t.test('redacts sensitive path segments and complete quoted secrets before persistence', async () => {
      for (const secret of ['1710034065', 'ana%40example.test', 'token%3Dprivate', 'eyJhbGciOiJIUzI1NiJ9.payload.signature']) {
        assert.equal(safeUrl('/resource/' + secret + '?cvv=123'), '/resource/[redacted]');
      }
      for (const message of ['password="two word secret"', "password='two word secret'", 'Cookie: session=private; csrf=another', 'cédula=1710034065']) assert.equal(safeText(message), '[redacted]');
      assert.equal((await ingest({ events: [event({ route: '/resource/1710034065', payload: { message: 'password="two word secret"' } })] })).status, 202);
      const rows = await events.createQueryBuilder('e').where("e.payload_json->>'sessionId' = :sessionId", { sessionId }).getMany();
      assert.ok(rows.some(row => row.endpointRuta === '/resource/[redacted]' && row.payloadJson.payload.message === '[redacted]'));
      assert.ok(rows.every(row => !JSON.stringify(row).includes('two word secret') && !JSON.stringify(row).includes('1710034065')));
    });
    await t.test('rate limits ingestion', async () => {
      let limited = false;
      for (let index = 0; index < 21; index++) { const response = await ingest({ events: [event()] }); if (response.status === 429) { limited = true; break; } }
      assert.ok(limited, 'ingestion must return HTTP 429');
    });
  } finally {
    await events.createQueryBuilder().delete().where("payload_json->>'sessionId' = :sessionId", { sessionId }).execute();
    for (const id of fixtureUsers) await users.delete(id);
    await app.close();
  }
});
