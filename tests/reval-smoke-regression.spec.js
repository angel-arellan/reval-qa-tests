const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Reval Admin STAGING – Suite de Regresión Real', () => {
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

  test('STG - TC01: Dashboard', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app', 'Dashboard'); });
  test('STG - TC02: Suscripciones', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/subscriptions', 'Suscripciones'); });
  test('STG - TC03: Clientes', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/customers', 'Clientes'); });
  test('STG - TC04: Pedidos', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/orders', 'Pedidos'); });
  test('STG - TC05: Planes', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/plans', 'Planes'); });
  test('STG - TC06: Productos', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/products', 'Productos'); });
  test('STG - TC07: Sorpresas', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/sorpresas', 'Sorpresas'); });
  test('STG - TC08: Herramientas', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/tools', 'Herramientas'); });
  test('STG - TC09: Configuración', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/settings', 'Configuración'); });
});
