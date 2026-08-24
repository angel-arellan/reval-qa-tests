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
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1280, height: 720 }
      });
    } else {
      context = await chromium.launchPersistentContext(sessionDir, {
        headless: isCI ? true : false,
        channel: 'chrome',
        viewport: { width: 1280, height: 720 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    page = await context.newPage();
  });

  test.afterAll(async () => {
    if (context) await context.close();
    if (browser) await browser.close();
  });

  test('TC01: Dashboard – Validar sanidad visual y métricas sin errores', async () => {
    await page.goto('https://admin.shopify.com/', { waitUntil: 'domcontentloaded' });
    
    // Validar que no aparezcan textos rotos o errores de código común
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('{{');
  });

  test('TC-Module: Validar sección Suscripciones', async () => {
    await page.getByRole('link', { name: /Suscripciones/i }).click();
    await expect(page.locator('body')).not.toContainText('Error 500');
  });

  test('TC-Module: Validar sección Clientes', async () => {
    await page.getByRole('link', { name: /Clientes/i }).click();
    await expect(page.locator('body')).not.toContainText('Error 500');
  });

  test('TC-Module: Validar sección Pedidos', async () => {
    await page.getByRole('link', { name: /Pedidos/i }).click();
    await expect(page.locator('body')).not.toContainText('Error 500');
  });

  test('TC-Module: Validar sección Planes', async () => {
    await page.getByRole('link', { name: /Planes/i }).click();
    await expect(page.locator('body')).not.toContainText('Error 500');
  });

  test('TC-Module: Validar sección Productos', async () => {
    await page.getByRole('link', { name: /Productos/i }).click();
    await expect(page.locator('body')).not.toContainText('Error 500');
  });

  test('TC-Module: Validar sección Sorpresas', async () => {
    await page.getByRole('link', { name: /Sorpresas/i }).click();
    await expect(page.locator('body')).not.toContainText('Error 500');
  });

  test('TC-Module: Validar sección Herramientas', async () => {
    await page.getByRole('link', { name: /Herramientas/i }).click();
    await expect(page.locator('body')).not.toContainText('Error 500');
  });

  test('TC-Module: Validar sección Configuración', async () => {
    await page.getByRole('link', { name: /Configuración/i }).click();
    await expect(page.locator('body')).not.toContainText('Error 500');
  });
});
