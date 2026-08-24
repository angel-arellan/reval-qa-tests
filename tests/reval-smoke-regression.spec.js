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
        headless: false,
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
    await page.waitForTimeout(2000);
    
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('NaN');
  });

  test('TC-Module: Validar carga de la App Reval', async () => {
    // Reemplaza esta URL por la URL directa de la App Reval en tu tienda
    await page.goto('https://admin.shopify.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).not.toContainText('Error 500');
  });
});
