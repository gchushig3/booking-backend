// Auditoría documental; usa Playwright existente y Mermaid sin instalar paquetes.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../booking-frontend/node_modules/@playwright/test');
const root = path.resolve(__dirname, '..');
const files = ['README.md', 'booking-backend/README.md', 'booking-frontend/README.md', ...fs.readdirSync(__dirname).filter(f => f.endsWith('.md')).map(f => `docs/${f}`)];
async function main() {
  let links = 0, operations = 0;
  const diagrams = [];
  const response = await fetch('http://localhost:3000/api/docs-json');
  if (!response.ok) throw new Error(`Swagger HTTP ${response.status}`);
  const api = await response.json();
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|#)/.test(target)) continue;
      if (!fs.existsSync(path.resolve(root, path.dirname(file), target.split('#')[0]))) throw new Error(`Broken link ${file}: ${target}`);
      links++;
    }
    for (const match of text.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)) diagrams.push({ file, source: match[1] });
    for (const line of text.split('\n')) {
      const cols = line.split('|').map(c => c.trim());
      let method, endpoint;
      if (file === 'docs/INTEROPERABILIDAD.md' && cols[8] === 'IMPLEMENTADO') {
        endpoint = cols[3].replaceAll('`', ''); method = cols[4];
      } else if (file === 'docs/API-FIRST.md') {
        const found = cols[1]?.match(/^(GET|POST|PUT|PATCH|DELETE) `([^`]+)`$/);
        if (found) { method = found[1]; endpoint = found[2]; }
      }
      if (!endpoint?.startsWith('/api/')) continue;
      if (!api.paths[endpoint]?.[method.toLowerCase()]) throw new Error(`Missing operation: ${method} ${endpoint}`);
      operations++;
    }
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js' });
    for (const diagram of diagrams) await page.evaluate(async source => { mermaid.initialize({ startOnLoad: false }); await mermaid.parse(source); }, diagram.source);
  } finally { await browser.close(); }
  console.log(JSON.stringify({ files: files.length, validLocalLinks: links, swaggerOperationsChecked: operations, validMermaidDiagrams: diagrams.length, errors: 0 }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
