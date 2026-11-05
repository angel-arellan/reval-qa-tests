// Reval STAGING – compra en la tienda de prueba (demo.appreval.com), sin pagar nunca.
//
// El admin de Reval no se puede probar desde GitHub (Shopify pide login y Cloudflare frena a
// sus servidores), así que lo que se valida cada hora de Reval staging es lo que ve el
// comprador: suscribirse a un producto, el carrito de suscripciones de Reval, el checkout de
// Reval con su formulario, y que al volver el carrito siga intacto. También la compra única por
// el carrito normal de Shopify hasta su checkout, ida y vuelta.
//
// Seguridad: staging usa claves PRODUCTIVAS de Mercado Pago. Nunca se completa ni se envía el
// checkout, y además se bloquea a nivel de red cualquier POST de alta (el que lleva
// cardTokenId), por si algo cambiara en el futuro.

const { test, expect, devices } = require('@playwright/test');

const BASE = 'https://demo.appreval.com';
const PASSWORD = 'latech';
const PRODUCTO_FIJO = 'magnesio-bisglicinato-copy';
const ANALITICA = /(google-analytics\.com|analytics\.google\.com)\/(g\/)?collect|facebook\.com\/tr|\/\.well-known\/shopify\/monorail|monorail-edge\.shopifysvc\.com/;

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const req = route.request();
    if (req.method() === 'POST' && /\/apps\/subscriptions\/checkout/.test(req.url()) && /cardTokenId/.test(req.postData() || '')) {
      return route.abort();
    }
    if (ANALITICA.test(req.url())) return route.abort();
    return route.fallback();
  });
  // Popup de newsletter de la tienda de prueba: tapa los clics.
  await page.addInitScript(() => {
    const css = '[id*="popup_sign_up"]{display:none!important}';
    const poner = () => { const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s); };
    if (document.documentElement) poner(); else document.addEventListener('DOMContentLoaded', poner);
  });
  await page.goto(`${BASE}/password`, { waitUntil: 'domcontentloaded' });
  const clave = page.locator('input[type="password"]').first();
  if (await clave.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
    await clave.fill(PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('domcontentloaded');
  }
});

async function validarSinErrores(page, contexto) {
  const titulo = await page.title();
  const texto = await page.evaluate(() => document.body.innerText);
  expect(titulo, `${contexto}: bloqueo anti-bots`).not.toContain('Just a moment');
  expect(titulo, `${contexto} cayó en una página "no encontrada": ${page.url()}`).not.toMatch(/(^|\W)404(\W|$)|not found|no encontrada/i);
  for (const malo of ['Error 500', 'undefined', 'NaN']) expect(texto, `${contexto}: aparece "${malo}" en pantalla`).not.toContain(malo);
}

// Un producto con opción de suscripción. Se prefiere el fijo; si dejó de existir o no tiene
// stock, el primero del catálogo que la tenga (se saltean los productos de prueba de QA).
async function irAProductoSuscribible(page) {
  const candidatos = [PRODUCTO_FIJO];
  const json = await page.request.get(`${BASE}/products.json?limit=50`).then((r) => r.json()).catch(() => ({ products: [] }));
  for (const p of json.products || []) {
    if (!/test|qa-|caja|cajita|regalo|sin-stock/i.test(p.handle) && p.variants?.some((v) => v.available)) candidatos.push(p.handle);
  }
  for (const handle of [...new Set(candidatos)].slice(0, 6)) {
    await page.goto(`${BASE}/products/${handle}`, { waitUntil: 'domcontentloaded' });
    const opcion = page.locator('label', { hasText: /Suscribirme/i }).first();
    if (await opcion.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)) return handle;
  }
  throw new Error('No se encontró ningún producto con opción de suscripción en la tienda de prueba de Reval');
}

const botonAgregar = (page) => page.locator('main button, form button').filter({ hasText: /^\s*Agregar al carrito\s*$/ }).first();
const carritoReval = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('reval_cart_v1') || '{"items":[]}').items || []);

async function suscripcionHastaCheckoutYVuelta(page) {
  const handle = await irAProductoSuscribible(page);
  await validarSinErrores(page, 'Ficha de producto');

  await page.locator('label', { hasText: /Suscribirme/i }).first().click();
  await page.waitForTimeout(1000);
  await botonAgregar(page).click();

  // Se abre el carrito de suscripciones de Reval con el producto.
  await expect.poll(async () => (await carritoReval(page)).length, { message: 'El producto no entró al carrito de suscripciones de Reval', timeout: 15000 }).toBeGreaterThan(0);
  const items = await carritoReval(page);
  const continuar = page.getByRole('button', { name: /continuar al pago/i }).or(page.getByRole('link', { name: /continuar al pago/i })).first();
  await expect(continuar, 'No aparece «Continuar al pago» en el carrito de suscripciones').toBeVisible({ timeout: 15000 });

  await continuar.click();
  await page.waitForURL(/\/apps\/subscriptions\/checkout/, { timeout: 30000 });
  await validarSinErrores(page, 'Checkout de Reval');
  // El checkout muestra el producto y el formulario completo (no se completa ni se envía).
  await expect(page.locator('body'), 'El checkout de Reval no muestra el producto').toContainText(items[0].title.slice(0, 12), { timeout: 15000 });
  for (const campo of ['email', 'firstName', 'address1', 'cardholderName']) {
    await expect(page.locator(`input[name="${campo}"], input#${campo}`).first(), `Falta el campo «${campo}» en el checkout de Reval`).toBeVisible({ timeout: 15000 });
  }
  await expect(page.locator('#submit-btn, button[name="submit-btn"], button[id*="submit"]').first(), 'Falta el botón de pago en el checkout de Reval').toBeVisible();

  // Vuelta al producto: el carrito de suscripciones sigue con lo que se agregó.
  await page.goBack({ waitUntil: 'domcontentloaded' });
  expect(page.url(), 'Volver desde el checkout no regresó a la tienda').toContain(`/products/${handle}`);
  await validarSinErrores(page, 'Vuelta desde el checkout de Reval');
  const despues = await carritoReval(page);
  expect(despues.length, 'Al volver del checkout, el carrito de suscripciones quedó vacío').toBeGreaterThan(0);
  expect(despues[0].variantId, 'Al volver del checkout, el carrito de suscripciones tiene otro producto').toBe(items[0].variantId);
}

test.describe('Reval STAGING – compra en la tienda de prueba (sin pagar)', () => {
  test.use({ viewport: { width: 1366, height: 800 } });
  test.describe.configure({ timeout: 120000 });

  test('STG-SF01: Suscripción - producto, carrito de Reval, checkout y vuelta al carrito', async ({ page }) => {
    await suscripcionHastaCheckoutYVuelta(page);
  });

  test('STG-SF02: Compra única - producto, carrito, checkout de Shopify y vuelta al carrito', async ({ page }) => {
    await irAProductoSuscribible(page);
    await page.locator('label', { hasText: /Compra única/i }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    const alta = page.waitForResponse((r) => /\/cart\/add(\.js)?/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null);
    await botonAgregar(page).click();
    await alta;

    await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded' });
    await validarSinErrores(page, 'Carrito');
    const leerCarrito = () => page.request.get(`${BASE}/cart.js`).then((r) => r.json());
    expect((await leerCarrito()).item_count, 'El producto de compra única no entró al carrito').toBeGreaterThan(0);

    const checkout = page.locator('button[name="checkout"], [name="checkout"], a[href*="/checkout"]').first();
    await expect(checkout, 'No aparece el botón de checkout en el carrito').toBeVisible({ timeout: 15000 });
    await checkout.click();
    await page.waitForURL(/checkout/, { timeout: 30000 });
    await validarSinErrores(page, 'Checkout de Shopify');

    await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded' });
    await validarSinErrores(page, 'Vuelta al carrito desde el checkout');
    expect((await leerCarrito()).item_count, 'Al volver del checkout, el carrito quedó vacío').toBeGreaterThan(0);
  });
});

test.describe('Reval STAGING – compra en la tienda de prueba desde el celular (sin pagar)', () => {
  const { defaultBrowserType: _d, ...IPHONE } = devices['iPhone 13'];
  test.use(IPHONE);
  test.describe.configure({ timeout: 120000 });

  test('STG-SF03: Celular - suscripción, carrito de Reval, checkout y vuelta al carrito', async ({ page }) => {
    await suscripcionHastaCheckoutYVuelta(page);
  });
});
