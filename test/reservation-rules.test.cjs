const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../dist/modules/atracciones/reservation-rules');
const { isValidEcuadorianId } = require('../dist/common/validators/ecuadorian-id.validator');
const { PricingService } = require('../dist/modules/atracciones/pricing.service');

test('participant limits are enforced for GUIDED_TOUR and PACKAGE', () => {
  const ranges = { GUIDED_TOUR: [2, 10], PACKAGE: [1, 12] };
  for (const [type, [minimum, maximum]] of Object.entries(ranges)) {
    assert.equal(rules.participantCountAllowed(minimum, minimum, maximum), true, `${type} minimum`);
    assert.equal(rules.participantCountAllowed(maximum, minimum, maximum), true, `${type} maximum`);
    assert.equal(rules.participantCountAllowed(minimum - 1, minimum, maximum), false, `${type} below minimum`);
    assert.equal(rules.participantCountAllowed(maximum + 1, minimum, maximum), false, `${type} above maximum`);
  }
});

test('participant count must be an integer', () => {
  assert.equal(rules.participantCountAllowed(2.5, 1, 10), false);
});

test('Ecuadorian identity number uses province, third digit, and module 10 checks', () => {
  assert.equal(isValidEcuadorianId('1710034065'), true);
  assert.equal(isValidEcuadorianId('1710034064'), false);
  assert.equal(isValidEcuadorianId('171034065'), false);
});

test('pricing covers adults, free children, paid children, mixed ages, and the exact age threshold', () => {
  const service = new PricingService();
  const pkg = { precioUnitario: '30.00', politicasJson: { edad_nino_gratis_hasta: 10 } };
  assert.equal(service.calculate(pkg, 1, []).montoTotal, 30);
  assert.equal(service.calculate(pkg, 3, []).montoTotal, 90);
  assert.equal(service.calculate(pkg, 1, [{ edad: 4 }]).montoTotal, 30);
  assert.equal(service.calculate(pkg, 1, [{ edad: 11 }]).montoTotal, 60);
  assert.equal(service.calculate(pkg, 2, [{ edad: 8 }, { edad: 11 }]).montoTotal, 90);
  assert.equal(service.calculate(pkg, 1, [{ edad: 10 }]).montoTotal, 30, 'the configured age is free inclusively');
  for (const tipoExperiencia of ['GUIDED_TOUR', 'PACKAGE']) {
    assert.equal(service.calculate({ ...pkg, tipoExperiencia }, 2, [{ edad: 10 }]).montoTotal, 60);
  }
});

test('pricing rejects missing participants, invalid ages, invalid prices, and malformed policies', () => {
  const service = new PricingService();
  assert.throws(() => service.calculate({ precioUnitario: '30', politicasJson: {} }, 0, []));
  assert.throws(() => service.calculate({ precioUnitario: '30', politicasJson: {} }, 1, [{ edad: 18 }]));
  assert.throws(() => service.calculate({ precioUnitario: '-1', politicasJson: {} }, 1, []));
  assert.throws(() => service.calculate({ precioUnitario: '30', politicasJson: { edad_nino_gratis_hasta: 50 } }, 1, []));
});
