import { chromium, test, expect } from '@playwright/test';
import path from 'path';

test.describe('Reval Admin PROD (The Wellness Project) - Master Suite', () => {
  let context;
  let page;
  let revalIframe;

  test.beforeAll(async () => {
    const sessionDir = path.resolve(process.cwd(), '.chrome-user-data-prod');
    context = await chromium.launchPersistentContext(sessionDir, {
      channel: 'chrome',
      headless: false,
      slowMo: 300,
      viewport: { width: 1280, height: 720 },
    });

    page = context.pages()[0] || await context.newPage();
    await page.goto('https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app', { waitUntil: 'domcontentloaded' });

    revalIframe = page.frameLocator('iframe[name="app-iframe"]').first();
    await page.waitForTimeout(4000);
  });

  test.afterAll(async () => {
    if (context) await context.close();
  });

  test('TC01: Validar Dashboard y Recorrido de los 8 Módulos Activos en Producción', async () => {
    test.setTimeout(180000);

    // 1. Validar Dashboard
    await expect(revalIframe.getByText('Suscripciones activas')).toBeVisible({ timeout: 20000 });
    const mrrText = await revalIframe.getByText('MRR estimado').locator('..').innerText();
    expect(mrrText).toMatch(/\$\s?[\d.,]+/);
    console.log('✅ PROD TC01: Dashboard verificado correctamente.');

    // 2. Módulos exactos en Producción
    const modules = [
      { name: 'Suscripciones', path: '/subscriptions' },
      { name: 'Clientes', path: '/customers' },
      { name: 'Pedidos', path: '/orders' },
      { name: 'Planes', path: '/plans' },
      { name: 'Productos', path: '/products' },
      { name: 'Sorpresas', path: '/sorpresas' },
      { name: 'Herramientas', path: '/tools' },
      { name: 'Configuración', path: '/settings' }
    ];

    const baseUrl = 'https://admin.shopify.com/store/the-wellness-project-store/apps/revale-twp/app';

    for (const mod of modules) {
      // Direct routing directo para evitar congelamientos en el menú exterior
      await page.goto(`${baseUrl}${mod.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      // Verificación de Sanidad Visual dentro del iframe
      await expect(revalIframe.getByText('404')).not.toBeVisible();
      await expect(revalIframe.getByText('NaN', { exact: true })).not.toBeVisible();
      await expect(revalIframe.getByText('null', { exact: true })).not.toBeVisible();

      // Clic opcional en detalle si hay registros presentes
      const detailBtn = revalIframe.locator('a:has-text("Ver"), button:has-text("Ver")').first();
      if (await detailBtn.isVisible().catch(() => false)) {
        await detailBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      console.log(`✅ PROD: Módulo ${mod.name} verificado correctamente.`);
    }
  });
});
