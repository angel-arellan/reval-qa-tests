// Reval STAGING – panel de administración, módulo por módulo, entrando con una clave de solo
// lectura (secret REVAL_STG_API_KEY). Ver tests/helpers/reval-mcp.js: por qué no se usa la
// pantalla del admin de Shopify desde GitHub y qué revisa cada test. Sin la clave, o con una
// clave rechazada, los tests FALLAN diciendo que no se pudo entrar (nunca quedan en "skip").
const { test } = require('@playwright/test');
const { testsDelPanel } = require('./helpers/reval-mcp');

test.describe('Reval STAGING – Panel de administración (datos de cada módulo)', () => {
  test.describe.configure({ timeout: 60000 });
  testsDelPanel(test, { prefijo: 'STG', url: 'https://staging.api.appreval.com/mcp', secreto: 'REVAL_STG_API_KEY', conDatos: true });
});
