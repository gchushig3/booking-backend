const fs = require('node:fs');
async function main() {
  const base = process.env.CONTRACT_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${base}/api/docs-yaml`);
  const yaml = await response.text();
  if (!response.ok || !yaml.includes('paquete_id:') || !yaml.includes('/api/v1/observabilidad/eventos:')) throw new Error('Swagger activo incompleto; no se sobrescribe el contrato.');
  fs.writeFileSync('contracts/atracciones-openapi.yaml', '# Generado desde Swagger activo. Regenerar con npm run contract:export.\n' + yaml);
  console.log('Contrato sincronizado desde Swagger activo.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
