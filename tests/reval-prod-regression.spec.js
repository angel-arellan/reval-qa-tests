const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Reval Admin PROD – Suite de Regresión Real', () => {
  let browser, context, page;

  // Recorrido de las PANTALLAS del admin. Corre solo en local, con una sesión real de Shopify:
  //   REVAL_CDP=http://localhost:9333 npx playwright test <este archivo>
  // (Chrome abierto con --remote-debugging-port=9333 y sesión iniciada en el admin). En GitHub
  // el panel se prueba por API (reval-panel-*.spec.js), porque ahí Shopify no deja entrar.
  test.beforeAll(async () => {
    if (process.env.REVAL_CDP) {
      browser = await chromium.connectOverCDP(process.env.REVAL_CDP);
      page = await browser.contexts()[0].newPage();
      return;
    }
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
    if (process.env.REVAL_CDP) return page?.close().catch(() => {});
    if (context) await context.close();
    if (browser) await browser.close();
  });

  // Antes este chequeo pasaba aunque no se entrara al admin: con la sesión vencida (o el desafío
  // de Cloudflare "Just a moment..." que Shopify muestra a las IPs de GitHub) la pantalla de login
  // no contiene "Error 500" ni "undefined", y el test daba OK sin haber visto Reval. Ahora:
  // - sin sesión válida el test FALLA diciendo que no pudo entrar (nunca un OK falso ni un skip);
  // - con sesión, se exige que cargue el iframe de la app Reval y se revisa su contenido.
  async function validarModulo(url, nombreModulo) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const sinSesion =
      /\/login|accounts\.shopify\.com|\/challenges\//.test(page.url()) || /Just a moment/i.test(await page.title());
    expect(sinSesion, `No se pudo entrar al admin de Shopify para revisar ${nombreModulo}: pidió login o verificación anti-robots (${page.url().slice(0, 80)})`).toBe(false);

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
