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

  // Antes este chequeo pasaba aunque no se entrara al admin: con la sesión vencida (o el desafío
  // de Cloudflare "Just a moment..." que Shopify muestra a las IPs de GitHub) la pantalla de login
  // no contiene "Error 500" ni "undefined", y el test daba OK sin haber visto Reval. Ahora:
  // - sin sesión válida el módulo queda como NO verificado (skip con el motivo), no como OK;
  // - con sesión, se exige que cargue el iframe de la app Reval y se revisa su contenido.
  async function validarModulo(url, nombreModulo) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const sinSesion =
      /\/login|accounts\.shopify\.com|\/challenges\//.test(page.url()) || /Just a moment/i.test(await page.title());
    test.skip(sinSesion, `Sin sesión válida en el admin de Shopify: ${nombreModulo} no se pudo verificar`);

    let app = null;
    for (let i = 0; i < 25 && !app; i++) {
      app = page.frames().find((f) => /ondigitalocean\.app|appreval\.com/.test(f.url()));
      if (!app) await page.waitForTimeout(1000);
    }
    expect(app, `La app Reval no cargó dentro del admin en ${nombreModulo}`).toBeTruthy();
    await expect
      .poll(() => app.evaluate(() => (document.body ? document.body.innerText.trim().length : 0)).catch(() => 0), {
        message: `${nombreModulo} quedó en blanco dentro de la app`,
        timeout: 20000,
      })
      .toBeGreaterThan(20);
    await page.waitForTimeout(1500);

    // document.body y no locator('body'): el admin de Shopify tiene más de un <body> en la página.
    for (const bodyText of [await page.evaluate(() => document.body.innerText), await app.evaluate(() => document.body.innerText)]) {
      expect(bodyText, `Error 500 en ${nombreModulo}`).not.toContain('Error 500');
      expect(bodyText, `Error 404 en ${nombreModulo}`).not.toContain('404 Not Found');
      expect(bodyText, `Código roto en ${nombreModulo}`).not.toContain('undefined');
      expect(bodyText, `Código roto en ${nombreModulo}`).not.toContain('NaN');
    }
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
  // Módulos sumados al menú de Reval (nov-2026).
  test('STG - TC10: Cajas', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/boxes', 'Cajas'); });
  test('STG - TC11: Facturación', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/billing', 'Facturación'); });
  test('STG - TC12: API & MCP', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/integrations', 'API & MCP'); });
  test('STG - TC13: Integraciones', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/connections', 'Integraciones'); });
  test('STG - TC14: Notificaciones', async () => { await validarModulo('https://admin.shopify.com/store/mp-subscriptions/apps/latech-subscriptions-1/app/notifications', 'Notificaciones'); });
});
