const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Reval Admin PROD (The Wellness Project) – Master Suite', async () => {
  const isCI = !!process.env.CI;
  const sessionDir = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd(), '.chrome-user-data-prod');

  const context = await chromium.launchPersistentContext(sessionDir, {
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await context.newPage();
  await page.goto('https://admin.shopify.com/', { waitUntil: 'domcontentloaded' });
  await context.close();
});
