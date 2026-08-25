const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const authPath = path.resolve(process.cwd(), 'storageState-customer.json');

test.use({
  storageState: fs.existsSync(authPath) ? authPath : undefined,
  viewport: { width: 1280, height: 720 }
});

test.describe('Reval Customer Portal STG – Suite de UI & Navegación', () => {

  async function bypassPasswordProtection(page) {
    if (page.url().includes('/password')) {
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('latech');
        await page.keyboard.press('Enter');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);
      }
    }
  }

  async function validarVistaUI(page, url, nombreSeccion) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await bypassPasswordProtection(page);

    const currentUrl = page.url();
    const bodyText = await page.locator('body').innerText();

    expect(currentUrl, `${nombreSeccion} quedó atrapado en el muro de contraseña`).not.toContain('/password');
    expect(bodyText, `Error de servidor en ${nombreSeccion}`).not.toContain('Error 500');
    expect(bodyText, `Ruta no encontrada en ${nombreSeccion}`).not.toContain('404 Not Found');
    expect(bodyText, `Texto indefinido en ${nombreSeccion}`).not.toContain('undefined');
    expect(bodyText, `Cálculo fallido en ${nombreSeccion}`).not.toContain('NaN');
  }

  test('CST-STG01: Pedidos (Orders)', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://shopify.com/86553460929/account/orders?locale=es&region_country=AR',
      'Pedidos'
    );
  });

  test('CST-STG02: Mis Suscripciones', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://shopify.com/86553460929/account/pages/019f65b8-ff9e-738e-915c-e8ba725f3736',
      'Mis Suscripciones'
    );
  });

  test('CST-STG03: Mi Cuenta (Perfil)', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://shopify.com/86553460929/account/profile',
      'Mi Cuenta'
    );
  });

  test('CST-STG04: Términos y Condiciones', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://mp-subscriptions.myshopify.com/policies/terms-of-service?country=AR',
      'Términos y Condiciones'
    );
  });

  test('CST-STG05: Política de Privacidad', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://mp-subscriptions.myshopify.com/policies/privacy-policy?country=AR',
      'Política de Privacidad'
    );
  });

});
