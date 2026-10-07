const test = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { configureSwagger } = require('../dist/swagger.config');
const { activeInventory, expressInventory } = require('./openapi-inventory.cjs');
const fs = require('node:fs');

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
    const inventory = activeInventory(app);
    const active = inventory.map(route => `${route.method} ${route.path}`).sort();
    assert.deepEqual(expressInventory(app), active, 'Mounted controllers must match the live Express router');
    const documented = Object.entries(openapi.paths).flatMap(([path, item]) => Object.keys(item).filter(method => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)).map(method => `${method} ${path}`)).sort();
    assert.deepEqual(documented, active, 'OpenAPI must match every mounted route, without dead-module operations');
    for (const route of inventory) {
      const operation = openapi.paths[route.path][route.method];
      const bearer = operation.security?.some(entry => Object.hasOwn(entry, 'JWT-auth')) ?? false;
      assert.equal(bearer, !route.public, `JWT metadata mismatch: ${route.method} ${route.path}`);
      if (!route.public) assert.ok(operation.responses['401']);
      if (route.roles.includes('ADMIN')) {
        assert.ok(operation.responses['403']);
        assert.match([operation.description, ...operation.tags ?? [], operation.responses['403'].description].join(' '), /ADMIN/);
      }
      assert.ok(operation.responses[String(route.status)], `Missing actual success status for ${route.path}`);
      if (route.status === 204) assert.ok(!operation.responses['204'].content, '204 must not advertise a response body');
      else assert.ok(operation.responses[String(route.status)].content, `Success schema missing: ${route.path}`);
      const params = operation.parameters ?? [];
      const pathNames = [...route.path.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
      assert.deepEqual(params.filter(param => param.in === 'path').map(param => param.name).sort(), pathNames.sort());
      for (const name of pathNames) assert.equal(params.find(param => param.in === 'path' && param.name === name).required, true);
      for (const input of route.inputs) {
        if (input.kind === 3) {
          assert.equal(operation.requestBody?.content?.['application/json']?.schema?.$ref, `#/components/schemas/${input.dto}`, `Request DTO mismatch: ${route.path}`);
          assert.deepEqual(Object.keys(openapi.components.schemas[input.dto].properties).sort(), input.fields, `Swagger must match the DTO validation whitelist: ${input.dto}`);
        }
        if (input.kind === 4 && input.name) assert.ok(params.some(param => param.in === 'query' && param.name === input.name), `Missing query ${input.name}`);
        if (input.kind === 4 && !input.name && input.dto === 'GetAtraccionesFilterDto') assert.deepEqual(params.filter(param => param.in === 'query').map(param => param.name).sort(), ['limit', 'page', 'product_type', 'q']);
      }
      assert.ok(operation.responses['429'], 'All mounted routes use the global throttler');
    }
    const ui = await fetch(`http://127.0.0.1:${port}/api/docs`);
    assert.equal(ui.status, 200); assert.ok((await ui.text()).includes('swagger-ui')); 
    fs.mkdirSync('contracts', { recursive: true });
    fs.writeFileSync('contracts/openapi.json', JSON.stringify(openapi, null, 2));
    fs.writeFileSync('contracts/active-endpoints.json', JSON.stringify(inventory, null, 2));
    const operations = [
      ['post', '/api/v1/auth/register'], ['post', '/api/v1/auth/login'],
      ['post', '/api/v1/atracciones/search'], ['post', '/api/v1/atracciones/details'],
      ['post', '/api/v1/atracciones'], ['get', '/api/v1/atracciones'],
      ['post', '/api/v1/atracciones/{id}/paquetes'], ['put', '/api/v1/atracciones/{id}/paquetes/{packageId}'], ['put', '/api/v1/atracciones/{id}/availability'],
      ['get', '/api/v1/atracciones/health'], ['get', '/api/v1/atracciones/{id}/paquetes'],
      ['get', '/api/v1/atracciones/reservations'], ['get', '/api/v1/atracciones/reservations/{reservationId}'],
      ['get', '/api/v1/atracciones/{id}'], ['get', '/api/v1/atracciones/{id}/availability'],
      ['post', '/api/v1/atracciones/{id}/reservations'], ['post', '/api/v1/atracciones/reservations/{reservationId}/cancel'],
      ['put', '/api/v1/atracciones/{id}'], ['patch', '/api/v1/atracciones/{id}'], ['delete', '/api/v1/atracciones/{id}'],
      ['get', '/api/v1/admin/reservas'], ['get', '/api/v1/atracciones/{id}/comentarios'],
      ['post', '/api/v1/atracciones/{id}/comentarios'],
      ['post', '/api/v1/observabilidad/eventos'], ['get', '/api/v1/admin/observabilidad/eventos'], ['get', '/api/v1/admin/observabilidad/resumen'], ['get', '/api/v1/admin/observabilidad/stream'],
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
    for (const operation of [checkout, cancel]) {
      const header = operation.parameters.find(parameter => parameter.in === 'header' && parameter.name === 'X-Idempotency-Key');
      assert.equal(header.required, true); assert.equal(header.schema.type, 'string'); assert.equal(header.schema.format, 'uuid'); assert.ok(header.schema.pattern);
      assert.ok(operation.requestBody.required);
    }
    assert.match(checkout.description, /payload normalizado/);
    assert.match(checkout.description, /409 IDEMPOTENCY_KEY_REUSED/);
    assert.match(cancel.description, /no se persiste/);
    assert.match(cancel.responses['400'].description, /otra reserva/);
    assert.doesNotMatch(cancel.responses['409'].description, /key|clave|cancelación/);
    const schemas = openapi.components.schemas;
    assert.equal(schemas.SearchAtraccionesDto.properties.cities.items.type, 'integer');
    assert.equal(schemas.SearchAtraccionesDto.properties.countries.items.type, 'string');
    for (const [dto, field, type] of [['SearchMetadataDto', 'next_page', 'string'], ['PaqueteExperienciaResponseDto', 'descripcion', 'string'], ['PaqueteExperienciaResponseDto', 'max_participantes', 'integer'], ['ComentarioResponseDto', 'reserva_id', 'string']]) {
      assert.equal(schemas[dto].properties[field].type, type); assert.equal(schemas[dto].properties[field].nullable, true);
    }
    assert.equal(schemas.ReservationRequestDto.properties.date.format, 'date');
    assert.deepEqual(schemas.DatesFilterDto.properties.start_date.oneOf.map(schema => schema.format), ['date', 'date-time']);
    assert.equal(schemas.ChildDto.properties.edad.type, 'integer');
    assert.equal(schemas.ChildDto.properties.edad.minimum, 0); assert.equal(schemas.ChildDto.properties.edad.maximum, 17);
    assert.deepEqual(schemas.ReservationRequestDto.properties.metodo_pago.enum, ['CREDIT_CARD', 'PAYPAL']);
    assert.equal(schemas.ReservationResponseDto.properties.payment.allOf[0].$ref, '#/components/schemas/ReservationPaymentResponseDto');
    assert.ok(!schemas.ReservationResponseDto.required.includes('payment'));
    assert.ok(!schemas.UpdateAtraccionDto.required?.length);
    assert.deepEqual([...schemas.ReservationRequestDto.required].sort(), ['customer_name', 'date', 'paquete_id']);
    assert.equal(schemas.BrowserBatchDto.properties.events.maxItems, 20);
    assert.equal(schemas.ComentarioResponseDto.properties.fecha_creacion.format, 'date-time');
    assert.equal(openapi.paths['/api/v1/atracciones'].get.parameters.find(parameter => parameter.name === 'page').schema.type, 'integer');
    assert.ok(openapi.paths['/api/v1/atracciones'].post.responses['201'].headers.Location);
    assert.ok(openapi.paths['/api/v1/admin/observabilidad/stream'].get.responses['200'].content['text/event-stream']);
    const expectedResponses = [
      ['post', '/api/v1/auth/register', 201, 'AuthResponseDto'], ['post', '/api/v1/auth/login', 200, 'AuthResponseDto'],
      ['post', '/api/v1/atracciones/search', 200, 'SearchAtraccionesResponseDto'], ['post', '/api/v1/atracciones/details', 200, 'BatchAtraccionesResponseDto'],
      ['get', '/api/v1/atracciones', 200, 'AtraccionesListResponseDto'], ['post', '/api/v1/atracciones', 201, 'AtraccionResponseDto'],
      ['get', '/api/v1/atracciones/{id}', 200, 'AtraccionResponseDto'], ['patch', '/api/v1/atracciones/{id}', 200, 'AtraccionResponseDto'],
      ['get', '/api/v1/atracciones/{id}/paquetes', 200, 'PaqueteExperienciaResponseDto', true],
      ['get', '/api/v1/atracciones/{id}/availability', 200, 'AvailabilityResponseDto'],
      ['post', '/api/v1/atracciones/{id}/reservations', 201, 'ReservationResponseDto'],
      ['get', '/api/v1/atracciones/reservations', 200, 'ReservationResponseDto', true],
      ['get', '/api/v1/atracciones/reservations/{reservationId}', 200, 'ReservationResponseDto'],
      ['post', '/api/v1/atracciones/reservations/{reservationId}/cancel', 200, 'ReservationResponseDto'],
      ['get', '/api/v1/admin/reservas', 200, 'ReservationResponseDto', true],
      ['get', '/api/v1/atracciones/{id}/comentarios', 200, 'ComentarioResponseDto', true],
      ['post', '/api/v1/atracciones/{id}/comentarios', 201, 'ComentarioResponseDto'],
      ['post', '/api/v1/observabilidad/eventos', 202, 'TelemetryAcceptedDto'],
      ['get', '/api/v1/admin/observabilidad/eventos', 200, 'TelemetrySnapshotDto'], ['get', '/api/v1/admin/observabilidad/resumen', 200, 'TelemetrySummaryDto'],
    ];
    for (const [method, path, status, dto, array] of expectedResponses) {
      const schema = openapi.paths[path][method].responses[status].content['application/json'].schema;
      if (array) { assert.equal(schema.type, 'array'); assert.equal(schema.items.$ref, `#/components/schemas/${dto}`); }
      else assert.equal(schema.$ref, `#/components/schemas/${dto}`);
    }
    const health = openapi.paths['/api/v1/atracciones/health'].get.responses['200'].content['application/json'].schema;
    assert.equal(health.type, 'object'); assert.deepEqual(health.required, ['status', 'timestamp']); assert.equal(health.properties.timestamp.format, 'date-time');
    assert.equal(openapi.components.securitySchemes['JWT-auth'].type, 'http');
    assert.equal(openapi.components.securitySchemes['JWT-auth'].scheme, 'bearer');
    assert.equal(openapi.components.securitySchemes['JWT-auth'].bearerFormat, 'JWT');
    for (const route of inventory) {
      const responses = openapi.paths[route.path][route.method].responses;
      for (const [status, response] of Object.entries(responses)) if (Number(status) >= 400) assert.equal(response.content['application/json'].schema.$ref, '#/components/schemas/ApiErrorResponseDto');
    }
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
