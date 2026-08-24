import { chromium, test, expect } from '@playwright/test';
import path from 'path';

test.describe('Reval Admin - Definitive Regression & Data Integrity Suite', () => {
  let context;
  let page;
  let revalIframe;

  test.beforeAll(async () => {
    const sessionDir = path.join(process.cwd(), '.chrome-user-data');
    context = await chromium.launchPersistentContext(sessionDir, {
      channel: 'chrome',
      headless: false,
      slowMo: 400,
      viewport: { width: 1280, height: 720 },
    });

    page = context.pages()[0] || await context.newPage();
    await page.goto('https://admin.shopify.com/store/mp-subscriptions', { waitUntil: 'domcontentloaded' });

    // Abrir la App Reval en Shopify Admin
    await page.locator('a:has-text("Reval")').first().click();
    await page.waitForURL(/.*latech-subscriptions-1.*/, { timeout: 25000 });

    revalIframe = page.frameLocator('iframe[name="app-iframe"]').first();
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  test.afterEach(async () => {
    // Aserciones globales de Sanidad Visual dentro del iframe de Reval
    await expect(revalIframe.getByText('404')).not.toBeVisible();
    await expect(revalIframe.getByText('NaN', { exact: true })).not.toBeVisible();
    await expect(revalIframe.getByText('null', { exact: true })).not.toBeVisible();
    await expect(revalIframe.getByText('undefined', { exact: true })).not.toBeVisible();
    await expect(revalIframe.getByText('[object Object]', { exact: true })).not.toBeVisible();
  });

  test('TC01: Dashboard - Sanidad de datos financieros y métricas', async () => {
    await expect(revalIframe.getByText('Suscripciones activas')).toBeVisible();
    await expect(revalIframe.getByText('MRR estimado')).toBeVisible();
    await expect(revalIframe.getByText('Ingresos históricos')).toBeVisible();

    // Validar que la métrica de MRR tenga un formato numérico/moneda válido ($)
    const mrrText = await revalIframe.getByText('MRR estimado').locator('..').innerText();
    expect(mrrText).toMatch(/\$\s?[\d.,]+/);

    console.log('✅ TC01: Dashboard verificado (Métricas y precios $ ok).');
  });

  // Módulos internos con selectores por URL estricta para evitar la navegación de Shopify
  const modules = [
    { name: 'Suscripciones', path: '/app/subscriptions' },
    { name: 'Clientes', path: '/app/customers' },
    { name: 'Pedidos', path: '/app/orders' },
    { name: 'Planes', path: '/app/plans' },
    { name: 'Productos', path: '/app/products' },
    { name: 'Cajas', path: '/app/bundles' },
    { name: 'Sorpresas', path: '/app/surprises' },
    { name: 'Herramientas', path: '/app/tools' },
    { name: 'Configuración', path: '/app/settings' },
  ];

  for (const mod of modules) {
    test(`TC-Module: Validar sección ${mod.name}`, async () => {
      // 1. Desplegar "Ver más" si el menú de Reval está contraído
      const verMas = page.locator('a:has-text("Ver más"), button:has-text("Ver más")').first();
      if (await verMas.isVisible().catch(() => false)) {
        await verMas.click();
        await page.waitForTimeout(500);
      }

      // 2. Hacer clic únicamente en el enlace con la ruta específica del módulo
      const moduleLink = page.locator(`a[href*="${mod.path}"]`).first();
      
      // Fallback por texto exacto dentro del menú de la app si no coincide por ruta
      if (await moduleLink.isVisible().catch(() => false)) {
        await moduleLink.click();
      } else {
        await page.locator(`a:has-text("${mod.name}")`).last().click();
      }

      await page.waitForTimeout(1500);

      // 3. Interactuar con "Ver" o "Detalle" si existen registros en la vista
      const detailBtn = revalIframe.locator('a:has-text("Ver"), button:has-text("Ver")').first();
      if (await detailBtn.isVisible().catch(() => false)) {
        await detailBtn.click();
        await page.waitForTimeout(1000);
      }

      console.log(`✅ Módulo ${mod.name} verificado dentro de Reval.`);
    });
  }
});
