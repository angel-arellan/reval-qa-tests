const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Reval Admin PROD – Suite de Regresión Real', () => {
  let browser, context, page;

  test.beforeAll(async () => {
    const isCI = !!process.env.CI;
    const sessionDir = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd(), '.chrome-user-data-prod');
    const storageStatePath = path.resolve(process.cwd(), 'storageState.json');

    if (isCI && fs.existsSync(storageStatePath)) {
      browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      context = await browser.newContext({ storageState: storageStatePath, viewport: { width: 1280, height: 720 } });
    } else {
      context = await chromium.launchPersistentContext(sessionDir, { headless: isCI ? true : false, channel: 'chrome', viewport: { width: 1280, height: 720 }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    }
    page = await context.newPage();
  });

  test.afterAll(async () => {
    if (context) await context.close();
    if (browser) await browser.close();
  });

  async function validarModulo(url, nombreModulo) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText();
    
    expect(bodyText, `Error 500 en ${nombreModulo}`).not.toContain('Error 500');
    expect(bodyText, `Error 404 en ${nombreModulo}`).not.toContain('404 Not Found');
    expect(bodyText, `Código roto en ${nombreModulo}`).not.toContain('undefined');
    expect(bodyText, `Código roto en ${nombreModulo}`).not.toContain('NaN');
  }

  test('PROD - TC01: Dashboard', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app', 'Dashboard'); });
  test('PROD - TC02: Suscripciones', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app/subscriptions', 'Suscripciones'); });
  test('PROD - TC03: Clientes', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app/customers', 'Clientes'); });
  test('PROD - TC04: Pedidos', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app/orders', 'Pedidos'); });
  test('PROD - TC05: Planes', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app/plans', 'Planes'); });
  test('PROD - TC06: Productos', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app/products', 'Productos'); });
  test('PROD - TC07: Sorpresas', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app/sorpresas', 'Sorpresas'); });
  test('PROD - TC08: Herramientas', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app/tools', 'Herramientas'); });
  test('PROD - TC09: Configuración', async () => { await validarModulo('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app/settings', 'Configuración'); });
});
