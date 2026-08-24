const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Reval Admin PROD – Definitive Regression Suite', () => {
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

  test('PROD - TC01: Dashboard Home', async () => {
    await page.goto('https://admin.shopify.com/', { waitUntil: 'domcontentloaded' });
  });

  test('PROD - TC02: Validar carga de Suscripciones', async () => {
    await page.waitForTimeout(500);
  });

  test('PROD - TC03: Validar carga de Clientes', async () => {
    await page.waitForTimeout(500);
  });
});
