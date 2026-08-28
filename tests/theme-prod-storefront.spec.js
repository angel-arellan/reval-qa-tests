const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.STOREFRONT_URL || 'https://www.thewellnessproject.com.ar';
const PRODUCTO_BUSQUEDA = 'creatina';

test.use({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  extraHTTPHeaders: {
    'accept-language': 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7'
  },
  viewport: { width: 1280, height: 720 }
});

test.describe(`Storefront Suite Definitiva – ${BASE_URL}`, () => {

  async function neutralizarPopups(page) {
    await page.waitForTimeout(2000);
    try {
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        const bloqueantes = document.querySelectorAll(
          '[id*="klaviyo"], [class*="newsletter"], [id*="shopify-section-popup"], [class*="cookie"], [id*="cookie"]'
        );
        bloqueantes.forEach(el => el.remove());
      });
    } catch (e) {}
  }

  async function validarSinErrores(page, contexto) {
    const bodyText = await page.locator('body').innerText();
    const pageTitle = await page.title();

    expect(pageTitle, `Bloqueo en ${contexto}`).not.toContain('Just a moment...');
    expect(bodyText, `Error 500 en ${contexto}`).not.toContain('Error 500');
    expect(bodyText, `Error 404 en ${contexto}`).not.toContain('404 Not Found');
  }

  async function primeroVisible(locator) {
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      const el = locator.nth(i);
      if (await el.isVisible().catch(() => false)) return el;
    }
    return locator.first();
  }

  test('STF-01: Home - Logo, Navegación y Scroll Footer', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Home');

    const logo = page.locator('header img, [class*="logo"], header a').first();
    await expect(logo).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await page.waitForTimeout(1500);

    const footer = page.locator('footer, [role="contentinfo"]').first();
    await expect(footer).toBeVisible();
  });

  test('STF-02: Buscador - Búsqueda en Vivo', async ({ page }) => {
    await page.goto(`${BASE_URL}/search?q=${PRODUCTO_BUSQUEDA}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Resultados de Búsqueda');

    const producto = await primeroVisible(page.locator('a[href*="/products/"]'));
    await expect(producto).toBeVisible({ timeout: 10000 });
  });

  test('STF-03: Catálogo - Carga de Grilla', async ({ page }) => {
    await page.goto(`${BASE_URL}/collections/all`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Catálogo');

    const productCard = page.locator('a[href*="/products/"]').first();
    await expect(productCard).toBeVisible();
  });

  test('STF-04: PDP & Checkout - Flujo Completo Suscripción, Compra Única y Carrito', async ({ page }) => {
    // 1. Ir a PDP directa de Creatina
    await page.goto(`${BASE_URL}/products/creatina-monohidrato`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);
    await validarSinErrores(page, 'PDP');

    // 2. Probar Opción Suscripción
    const subscribeLabel = page.locator('label:has-text("Suscribirme"), label:has-text("Subscribe"), [class*="subscription"]').first();
    if (await subscribeLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subscribeLabel.click();
      await page.waitForTimeout(2000);

      const addBtn = await primeroVisible(page.locator('button[name="add"], button:has-text("Agregar"), [class*="add-to-cart"]'));
      
      // Esperar llamada al API de carrito de Shopify para confirmar persistencia
      const cartPromise = page.waitForResponse(resp => resp.url().includes('/cart'), { timeout: 10000 }).catch(() => null);
      await addBtn.click({ force: true });
      await cartPromise;
      await page.waitForTimeout(2500);

      // Buscar botón de Checkout tanto en Drawer emergente como en la vista /cart
      const checkoutBtnDrawer = page.locator('button[name="checkout"], a[href*="/checkout"], [form*="cart"] button[type="submit"]').first();
      
      if (!(await checkoutBtnDrawer.isVisible({ timeout: 4000 }).catch(() => false))) {
        await page.goto(`${BASE_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await neutralizarPopups(page);
      }

      const checkoutBtn = page.locator('button[name="checkout"], input[name="checkout"], a[href*="/checkout"]').first();
      await expect(checkoutBtn).toBeVisible({ timeout: 15000 });
    }

    // 3. Volver a PDP para Compra Única
    await page.goto(`${BASE_URL}/products/creatina-monohidrato`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);

    const singleLabel = page.locator('label:has-text("Compra única"), label:has-text("One-time")').first();
    if (await singleLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await singleLabel.click();
      await page.waitForTimeout(1000);
    }

    // 4. Modificar Cantidad en PDP y Agregar
    const plusPDP = await primeroVisible(page.locator('button[name="plus"], [class*="quantity"] button:has-text("+"), button:has-text("+")'));
    if (await plusPDP.isVisible({ timeout: 2000 }).catch(() => false)) {
      await plusPDP.click();
      await page.waitForTimeout(1000);
    }

    const addBtnSingle = await primeroVisible(page.locator('button[name="add"], button:has-text("Agregar"), [class*="add-to-cart"]'));
    const cartPromiseSingle = page.waitForResponse(resp => resp.url().includes('/cart'), { timeout: 10000 }).catch(() => null);
    await addBtnSingle.click({ force: true });
    await cartPromiseSingle;
    await page.waitForTimeout(2500);

    // 5. Ir a Carrito y Modificar Cantidad
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Carrito');

    const cartPlus = await primeroVisible(page.locator('button[name="plus"], a[href*="quantity"], button:has-text("+")'));
    if (await cartPlus.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cartPlus.click();
      await page.waitForTimeout(1500);
    }

    // 6. Confirmar Botón de Checkout Final
    const checkoutBtnFinal = page.locator('button[name="checkout"], input[name="checkout"], a[href*="/checkout"]').first();
    await expect(checkoutBtnFinal).toBeVisible({ timeout: 15000 });
  });

  test('STF-05: Acceso al Login', async ({ page }) => {
    await page.goto(`${BASE_URL}/account/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Login');

    const loginForm = page.locator('form[action*="/account"], input[type="email"]').first();
    await expect(loginForm).toBeVisible();
  });

  test('STF-06: Políticas Legales', async ({ page }) => {
    await page.goto(`${BASE_URL}/policies/terms-of-service`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Términos');

    await page.goto(`${BASE_URL}/policies/privacy-policy`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Privacidad');
  });

});
