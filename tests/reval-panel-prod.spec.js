// Reval PRODUCCIÓN (The Wellness Project) – panel de administración, módulo por módulo,
// entrando con una clave de solo lectura (secret REVAL_PROD_API_KEY, generada en el Reval de la
// tienda de TWP). Mismos chequeos que staging (tests/helpers/reval-mcp.js). Solo lee: la clave
// de solo lectura no puede pausar, cancelar ni modificar nada.
const { test } = require('@playwright/test');
const { testsDelPanel } = require('./helpers/reval-mcp');

test.describe('Reval PRODUCCIÓN – Panel de administración (datos de cada módulo)', () => {
  test.describe.configure({ timeout: 60000 });
  testsDelPanel(test, { prefijo: 'PROD', url: 'https://api.appreval.com/mcp', secreto: 'REVAL_PROD_API_KEY', conDatos: true });
});
