const assert = require('node:assert/strict');
const fs = require('node:fs');
const { NestFactory } = require('@nestjs/core');
const { chromium } = require('../../booking-frontend/node_modules/@playwright/test');
const { AppModule } = require('../dist/app.module');
const { configureSwagger } = require('../dist/swagger.config');
const { activeInventory, expressInventory } = require('./openapi-inventory.cjs');

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false }); app.setGlobalPrefix('api/v1'); configureSwagger(app);
  await app.listen(0, '127.0.0.1'); let browser;
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const report = { uiStatus: null, jsonStatus: null, yamlStatus: null, operations: 0, uiErrors: [] };
  try {
    const json = await fetch(base + '/api/docs-json'); report.jsonStatus = json.status; assert.equal(json.status, 200);
    const document = await json.json();
    const inventory = activeInventory(app);
    const active = inventory.map(route => `${route.method} ${route.path}`).sort(); assert.deepEqual(expressInventory(app), active);
    const operations = Object.entries(document.paths).flatMap(([path, item]) => Object.keys(item).filter(method => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)).map(method => `${method} ${path}`)).sort();
    assert.deepEqual(operations, active); report.operations = operations.length;
    const yaml = await fetch(base + '/api/docs-yaml'); report.yamlStatus = yaml.status; assert.equal(yaml.status, 200);
    fs.writeFileSync('contracts/atracciones-openapi.yaml', '# Generado desde Swagger activo. Regenerar con npm run contract:export.\n' + await yaml.text());
    fs.writeFileSync('contracts/openapi.json', JSON.stringify(document, null, 2));
    fs.writeFileSync('contracts/active-endpoints.json', JSON.stringify(inventory, null, 2));
    browser = await chromium.launch({ channel: 'chrome', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => report.uiErrors.push(error.message));
    const ui = await page.goto(base + '/api/docs'); report.uiStatus = ui.status(); assert.equal(ui.status(), 200);
    await page.getByRole('heading', { name: 'Booking Prototipo API', exact: false }).waitFor();
    await page.locator('.opblock').last().waitFor(); assert.equal(await page.locator('.opblock').count(), operations.length);
    assert.equal(await page.locator('.errors-wrapper').count(), 0);
    await page.getByRole('button', { name: /^Authorize$/ }).first().click();
    await page.locator('.dialog-ux').waitFor(); assert.ok((await page.locator('.dialog-ux').textContent()).includes('JWT-auth'));
    assert.ok((await page.locator('.dialog-ux').textContent()).includes('http, Bearer'));
    fs.mkdirSync('contracts/evidence', { recursive: true });
    await page.screenshot({ path: 'contracts/evidence/swagger-ui-auth.png' });
    await page.locator('.dialog-ux').getByRole('button', { name: 'Close', exact: true }).click();
    await page.screenshot({ path: 'contracts/evidence/swagger-ui.png' });
    assert.equal(report.uiErrors.length, 0); report.result = 'PASS';
  } catch (error) { report.result = 'FAIL'; report.failure = error.message; process.exitCode = 1; }
  finally {
    await browser?.close(); await app.close();
    fs.mkdirSync('contracts/evidence', { recursive: true }); fs.writeFileSync('contracts/evidence/swagger-ui.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
