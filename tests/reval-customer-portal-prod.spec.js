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
    const pageTitle = await page.title();
    const bodyText = await page.locator('body').innerText();

    // Validaciones estrictas tanto en URL, título de pestaña y cuerpo de la página
    expect(currentUrl, `Redirección no deseada en ${nombreSeccion}`).not.toContain('/password');
    expect(pageTitle, `Página 404 detectada en el título de ${nombreSeccion}`).not.toContain('404');
    expect(bodyText, `Error 500 en ${nombreSeccion}`).not.toContain('Error 500');
    expect(bodyText, `Error 404 en ${nombreSeccion}`).not.toContain('404');
    expect(bodyText, `Página no encontrada en ${nombreSeccion}`).not.toContain('Page not found');
  }

  test('CST-PRD01: Cuenta / Pedidos', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://www.thewellnessproject.com.ar/account',
      'Cuenta y Pedidos'
    );
  });

  test('CST-PRD02: Detalle de Dirección / Perfil', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://www.thewellnessproject.com.ar/account/addresses',
      'Direcciones y Perfil'
    );
  });

  test('CST-PRD03: Portal de Suscripciones', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://shopify.com/86553460929/account/pages/019f65b8-ff9e-738e-915c-e8ba725f3736',
      'Mis Suscripciones'
    );
  });

  test('CST-PRD04: Términos y Condiciones', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://www.thewellnessproject.com.ar/policies/terms-of-service',
      'Términos y Condiciones'
    );
  });

  test('CST-PRD05: Política de Privacidad', async ({ page }) => {
    await validarVistaUI(
      page,
      'https://www.thewellnessproject.com.ar/policies/privacy-policy',
      'Política de Privacidad'
    );
  });

});
