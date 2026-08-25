const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const authPath = path.resolve(process.cwd(), 'storageState-customer-prod.json');

test.use({
  storageState: fs.existsSync(authPath) ? authPath : undefined,
  viewport: { width: 1280, height: 720 }
});

test.describe('Reval Customer Portal PROD – Suite de UI & Navegación', () => {

  async function validarVistaUI(page, url, nombreSeccion) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const bodyText = await page.locator('body').innerText();

    expect(currentUrl, `Redirección a contraseña en ${nombreSeccion}`).not.toContain('/password');
    expect(bodyText, `Error 500 en ${nombreSeccion}`).not.toContain('Error 500');
    expect(bodyText, `Ruta no encontrada en ${nombreSeccion}`).not.toContain('404 Not Found');
  }

  test('CST-PRD01: Cuenta / Pedidos', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://www.thewellnessproject.com.ar/account',
      'Mi Cuenta'
    );
  });

  test('CST-PRD02: Términos y Condiciones', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://www.thewellnessproject.com.ar/policies/terms-of-service',
      'Términos y Condiciones'
    );
  });

  test('CST-PRD03: Política de Privacidad', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://www.thewellnessproject.com.ar/policies/privacy-policy',
      'Política de Privacidad'
    );
  });

});
