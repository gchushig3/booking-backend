const test = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { configureSwagger } = require('../dist/swagger.config');

test('OpenAPI documents every active attraction REST operation', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  configureSwagger(app);
  await app.listen(0, '127.0.0.1');

  try {
    const port = app.getHttpServer().address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/docs-json`);
    assert.equal(response.status, 200);
    const openapi = await response.json();
    const operations = [
      ['post', '/api/v1/auth/register'], ['post', '/api/v1/auth/login'],
      ['post', '/api/v1/atracciones/search'], ['post', '/api/v1/atracciones/details'],
      ['post', '/api/v1/atracciones'], ['get', '/api/v1/atracciones'],
      ['get', '/api/v1/atracciones/health'], ['get', '/api/v1/atracciones/{id}/paquetes'],
      ['get', '/api/v1/atracciones/reservations'], ['get', '/api/v1/atracciones/reservations/{reservationId}'],
      ['get', '/api/v1/atracciones/{id}'], ['get', '/api/v1/atracciones/{id}/availability'],
      ['post', '/api/v1/atracciones/{id}/reservations'], ['post', '/api/v1/atracciones/reservations/{reservationId}/cancel'],
      ['put', '/api/v1/atracciones/{id}'], ['patch', '/api/v1/atracciones/{id}'], ['delete', '/api/v1/atracciones/{id}'],
      ['get', '/api/v1/admin/reservas'], ['get', '/api/v1/atracciones/{id}/comentarios'],
      ['post', '/api/v1/atracciones/{id}/comentarios'],
    ];
    for (const [method, path] of operations) {
      assert.ok(openapi.paths[path]?.[method], `Missing OpenAPI operation ${method.toUpperCase()} ${path}`);
    }
    const documentedOperationCount = Object.values(openapi.paths).reduce((count, pathItem) =>
      count + Object.keys(pathItem).filter((method) => ['get', 'post', 'put', 'patch', 'delete'].includes(method)).length, 0);
    assert.equal(documentedOperationCount, operations.length, 'OpenAPI must contain exactly the active module operations');

    assert.ok(openapi.components.securitySchemes['JWT-auth']);
    const checkout = openapi.paths['/api/v1/atracciones/{id}/reservations'].post;
    const keyHeaders = checkout.parameters.filter((parameter) => parameter.in === 'header' && parameter.name.toLowerCase() === 'x-idempotency-key');
    assert.equal(keyHeaders.length, 1, 'checkout must document X-Idempotency-Key exactly once');
    assert.ok(checkout.security?.some((entry) => entry['JWT-auth']));
    assert.ok(checkout.responses['201'] && checkout.responses['400'] && checkout.responses['401'] && checkout.responses['404'] && checkout.responses['409']);
    assert.match(checkout.responses['409'].description, /INSUFFICIENT_AVAILABILITY/);
    assert.match(checkout.responses['409'].description, /IDEMPOTENCY_KEY_REUSED/);

    const requestSchema = openapi.components.schemas.ReservationRequestDto;
    assert.equal(requestSchema.properties.paquete_id.format, 'uuid');
    assert.ok(requestSchema.required.includes('paquete_id'));
    assert.match(requestSchema.properties.product_type.description, /coincidir/);
    assert.ok(requestSchema.properties.ninos.items.$ref.endsWith('/ChildDto'));
    for (const forbidden of ['precio_unitario', 'politicas_json', 'min_participantes', 'max_participantes', 'monto_total', 'total_cupos_ocupados', 'cupos_reservados', 'status']) {
      assert.equal(requestSchema.properties[forbidden], undefined, `${forbidden} is calculated or controlled by the backend`);
    }

    const packageSchema = openapi.components.schemas.PaqueteExperienciaResponseDto.properties;
    for (const property of ['id', 'tipo_experiencia', 'nombre_paquete', 'descripcion', 'precio_unitario', 'min_participantes', 'max_participantes', 'politicas_json']) {
      assert.ok(packageSchema[property], `Package schema lacks ${property}`);
    }
    assert.deepEqual(packageSchema.tipo_experiencia.enum, ['SINGLE_TICKET', 'GUIDED_TOUR', 'PACKAGE']);

    const statusEnum = openapi.components.schemas.ReservationResponseDto.properties.status.enum;
    assert.deepEqual(statusEnum, ['PENDIENTE', 'CONFIRMADA', 'CANCELADA']);
    assert.equal(openapi.components.schemas.RegisterDto.properties.role, undefined);
    assert.equal(openapi.components.schemas.AuthResponseDto.properties.password_hash, undefined);

    const availability = openapi.paths['/api/v1/atracciones/{id}/availability'].get;
    const queryNames = availability.parameters.filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name);
    assert.deepEqual(queryNames, ['date', 'product_type', 'time']);

    const cancel = openapi.paths['/api/v1/atracciones/reservations/{reservationId}/cancel'].post;
    assert.equal(cancel.parameters.filter((parameter) => parameter.in === 'header' && parameter.name.toLowerCase() === 'x-idempotency-key').length, 1);
    for (const path of ['/api/v1/admin/reservas', '/api/v1/atracciones', '/api/v1/atracciones/{id}']) {
      const item = openapi.paths[path];
      for (const operation of Object.values(item)) {
        if (!operation || !operation.security) continue;
        if (operation.tags?.includes('Administración') || operation.description?.includes('rol ADMIN') || operation.summary?.includes('atracción')) {
          if (['post', 'put', 'patch', 'delete'].some((method) => item[method] === operation) || path.endsWith('/admin/reservas')) {
            assert.ok(operation.responses['403'], `${path} should document ADMIN authorization failure`);
          }
        }
      }
    }
    process.stdout.write(`OpenAPI smoke passed: ${operations.length} active operations documented.\n`);
  } finally {
    await app.close();
  }
});
