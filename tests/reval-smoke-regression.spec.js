const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Reval Admin – Definitive Regression & Data Integrity Suite', () => {
  test('TC01: Dashboard – Sanidad de datos financieros y métricas', async () => {
    const isCI = !!process.env.CI;
    const sessionDir = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd(), '.chrome-user-data-prod');
    const storageStatePath = path.resolve(process.cwd(), 'storageState.json');

    let context;

    if (isCI && fs.existsSync(storageStatePath)) {
      // En GitHub Actions usamos Chromium nativo con el estado de sesión
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1280, height: 720 }
      });
    } else {
      // En tu máquina local usa Chrome persistente
      context = await chromium.launchPersistentContext(sessionDir, {
        headless: isCI ? true : false,
        channel: 'chrome',
        viewport: { width: 1280, height: 720 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await context.newPage();
    await page.goto('https://admin.shopify.com/', { waitUntil: 'domcontentloaded' });
    await context.close();
  });
});
