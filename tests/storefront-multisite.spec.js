const { test, expect } = require('@playwright/test');
const sites = require('./config/sites');

test.use({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 720 }
});

async function neutralizarPopups(page) {
  // Varios sitios muestran popups (newsletter, promos) con delay tras la carga o el scroll.
  // Se hacen varias pasadas de limpieza en vez de una sola para no perderlos por timing.
  for (let pasada = 0; pasada < 3; pasada++) {
    await page.waitForTimeout(1000);
    try {
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        const bloqueantes = document.querySelectorAll(
          '[id*="klaviyo"], [class*="newsletter"], [id*="shopify-section-popup"], [class*="cookie"], [id*="cookie"],' +
          '[id*="alia"], [class*="alia"], [role="dialog"][aria-modal="true"], [data-kl-scroll-locking-modal]'
        );
        bloqueantes.forEach(el => el.remove());
      });
    } catch (e) {}
  }
}

// Varios sitios disparan popups con delay (aparecen unos segundos después de la carga o
// tras un scroll) que pueden interceptar un click justo en el momento en que se dispara.
// Se intenta el click normal primero; si Playwright lo bloquea por interceptación, se
// limpian popups y se reintenta una vez más antes de darlo por fallado de verdad.
async function clickResiliente(page, locator, options = {}) {
  try {
    await locator.click({ timeout: 5000, ...options });
  } catch (e) {
    await neutralizarPopups(page);
    await locator.click({ timeout: 5000, ...options });
  }
}

async function aceptarCookies(page, site) {
  if (!site.cookieBannerAcceptSelector) return;
  const boton = page.locator(site.cookieBannerAcceptSelector).first();
  if (await boton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await boton.click().catch(() => {});
    await page.waitForTimeout(500);
  }
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

async function submenuVisible(page, header) {
  const submenu = page.locator(header.submenuSelector).first();
  if (header.visibilityCheck === 'boundingBox') {
    const box = await submenu.boundingBox().catch(() => null);
    return !!box && box.height > 5;
  }
  return submenu.isVisible().catch(() => false);
}

// Cada theme selecciona variantes distinto: swatch de color (input radio oculto + label),
// pack como grupo de botones ARIA, o un swatch que ya es directamente el elemento clickeable.
async function seleccionarVariante(page, pdp) {
  if (!pdp.variantType || pdp.variantType === 'none') return;
  const opciones = page.locator(pdp.variantInputSelector);
  const total = await opciones.count();
  if (total === 0) return;

  if (pdp.variantType === 'aria-radio-button') {
    for (let i = 0; i < total; i++) {
      const opt = opciones.nth(i);
      const checked = await opt.getAttribute('aria-checked');
      const disabled = await opt.getAttribute('aria-disabled');
      if (checked !== 'true' && disabled !== 'true') {
        await opt.click({ force: true });
        await page.waitForTimeout(1000);
        return;
      }
    }
    return;
  }

  if (pdp.variantType === 'radio-label') {
    if (pdp.variantIsLabel) {
      await opciones.first().click({ force: true });
      await page.waitForTimeout(1000);
      return;
    }
    for (let i = 0; i < total; i++) {
      const input = opciones.nth(i);
      const checked = await input.isChecked().catch(() => true);
      const disabled = await input.getAttribute('disabled');
      if (!checked && disabled === null) {
        const id = await input.getAttribute('id');
        if (id) {
          await page.locator(`label[for="${id}"]`).click({ force: true });
          await page.waitForTimeout(1000);
        }
        return;
      }
    }
  }
}

async function leerCantidad(scope, quantityDisplay) {
  if (!quantityDisplay) return null;
  const el = scope.locator(quantityDisplay.selector).first();
  if (quantityDisplay.type === 'input') {
    return el.inputValue().catch(() => null);
  }
  return el.innerText().catch(() => null);
}

// Llega a un PDP real (fijo o vía búsqueda), selecciona variante/cantidad si existen,
// y agrega al carrito. Se reutiliza tanto para el test de PDP como para el de carrito.
async function agregarProductoAlCarrito(page, site, BASE_URL) {
  if (site.pdp.path) {
    await page.goto(`${BASE_URL}${site.pdp.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } else {
    await page.goto(`${BASE_URL}/search?q=${site.search.term}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await aceptarCookies(page, site);
    await neutralizarPopups(page);
    const productoLink = await primeroVisible(page.locator('a[href*="/products/"]'));
    await productoLink.click();
    await page.waitForLoadState('domcontentloaded');
  }
  await aceptarCookies(page, site);
  await neutralizarPopups(page);
  await validarSinErrores(page, 'PDP');

  await seleccionarVariante(page, site.pdp);

  if (site.pdp.quantitySelector) {
    const qtyBtn = page.locator(site.pdp.quantitySelector).first();
    if (await qtyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await qtyBtn.click();
      await page.waitForTimeout(800);
    }
  }

  const addBtn = page.locator(site.pdp.addToCartSelector).first();
  await addBtn.click({ force: true });
  await page.waitForTimeout(3000);

  if (site.cart.type === 'drawer') {
    const drawer = page.locator(site.cart.containerSelector).first();
    await expect(drawer, `El carrito no se abrió tras agregar en ${site.name}`).toBeVisible({ timeout: 10000 });
  } else {
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await aceptarCookies(page, site);
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Carrito');
  }
}

for (const site of sites) {
  const BASE_URL = process.env[`STOREFRONT_URL_${site.id}`] || site.baseUrl;

  test.describe(`Storefront Multisite – ${site.name} (${BASE_URL})`, () => {

    test(`${site.id}-01: Home & Header - Navegación por Categorías`, async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Home');

      const logo = page.locator('[class*="logo"], header a').first();
      await expect(logo).toBeVisible({ timeout: 10000 });

      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(1500);

      const footer = page.locator('footer, [role="contentinfo"]').first();
      await expect(footer).toBeVisible();

      if (site.header.hasMegaMenu) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Reintenta varias veces: algunos sitios disparan un popup con delay/scroll que
        // puede interceptar el click/hover justo en el momento de abrir el menú. Se usa
        // page.mouse directo (no locator.click/hover) porque es más confiable frente a
        // overlays que técnicamente están "encima" pero no bloquean pointer-events reales.
        let menuAbierto = false;
        for (let intento = 0; intento < 5 && !menuAbierto; intento++) {
          await aceptarCookies(page, site);
          await neutralizarPopups(page);
          const trigger = page.locator(site.header.hoverSelector).first();
          const box = await trigger.boundingBox().catch(() => null);
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
            if (site.header.openMethod === 'click') {
              await page.mouse.down();
              await page.mouse.up();
            }
          }
          await page.waitForTimeout(1200);
          menuAbierto = await submenuVisible(page, site.header);
          if (!menuAbierto) {
            const ariaExpanded = await trigger.getAttribute('aria-expanded').catch(() => null);
            menuAbierto = ariaExpanded === 'true';
          }
        }

        if (site.header.softCheck) {
          test.info().annotations.push({
            type: menuAbierto ? 'info' : 'warning',
            description: menuAbierto
              ? `Mega menú OK en ${site.name}`
              : `No se pudo confirmar la apertura del mega menú en ${site.name} vía automation (best-effort, no bloquea el test)`,
          });
        } else {
          expect(menuAbierto, `El mega menú no se despliega en ${site.name}`).toBeTruthy();
        }

        if (menuAbierto) {
          const sublink = await primeroVisible(page.locator(site.header.subcategoryLinkSelector));
          await sublink.click();
          await page.waitForLoadState('domcontentloaded');
          await neutralizarPopups(page);
          await validarSinErrores(page, 'Subcategoría del Header');
        }
      }
    });

    test(`${site.id}-02: Buscador - Búsqueda en Vivo`, async ({ page }) => {
      await page.goto(`${BASE_URL}/search?q=${site.search.term}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Resultados de Búsqueda');

      const producto = await primeroVisible(page.locator('a[href*="/products/"]'));
      await expect(producto).toBeVisible({ timeout: 10000 });
    });

    test(`${site.id}-03: Catálogo - Grilla y Filtros`, async ({ page }) => {
      await page.goto(`${BASE_URL}${site.collection.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Catálogo');

      if (site.collection.filters.enabled) {
        const productLink = await primeroVisible(page.locator('a[href*="/products/"]'));
        await expect(productLink).toBeVisible();

        const urlAntes = page.url();

        // Algunos sitios disparan un popup con delay que puede interceptar estos clicks.
        await aceptarCookies(page, site);
        await neutralizarPopups(page);

        if (site.collection.filters.toggleSelector) {
          const toggle = page.locator(site.collection.filters.toggleSelector).first();
          if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            await clickResiliente(page, toggle);
            await page.waitForTimeout(800);
          }
        }

        await neutralizarPopups(page);

        const filterLabel = page.locator(site.collection.filters.labelSelector).first();
        await filterLabel.waitFor({ state: 'attached', timeout: 5000 });
        await filterLabel.click({ force: true });
        await page.waitForURL(/filter/i, { timeout: 8000 }).catch(() => null);

        const urlDespues = page.url();
        expect(urlDespues, `El filtro no modificó la URL en ${site.name}`).not.toBe(urlAntes);
        expect(urlDespues.toLowerCase(), `La URL no refleja un filtro aplicado en ${site.name}`).toMatch(/filter/);
      }
    });

    test(`${site.id}-04: PDP, Carrito y Checkout - Flujo Completo`, async ({ page }) => {
      test.skip(!!site.knownProductionBug, site.knownProductionBug);

      await agregarProductoAlCarrito(page, site, BASE_URL);

      const cartRoot = site.cart.type === 'drawer' ? page.locator(site.cart.containerSelector) : page.locator('body');

      const item = cartRoot.locator(site.cart.itemSelector).first();
      await expect(item, `No se ve ningún item en el carrito de ${site.name}`).toBeVisible({ timeout: 10000 });

      const valorAntes = await leerCantidad(item, site.cart.quantityDisplay);

      if (site.cart.quantityChangeMethod === 'fill') {
        // Sin botones +/-: se escribe la cantidad directamente y se dispara "change".
        const input = item.locator(site.cart.quantityDisplay.selector).first();
        const cantidadSubida = String((parseInt(valorAntes, 10) || 1) + 1);
        await input.fill(cantidadSubida);
        await input.dispatchEvent('change');
        await page.waitForTimeout(2500);

        const valorSubido = await leerCantidad(item, site.cart.quantityDisplay);
        expect(valorSubido, `La cantidad no subió en el carrito de ${site.name}`).toBe(cantidadSubida);

        await input.fill(valorAntes);
        await input.dispatchEvent('change');
        await page.waitForTimeout(2500);

        const valorBajado = await leerCantidad(item, site.cart.quantityDisplay);
        expect(valorBajado, `La cantidad no bajó en el carrito de ${site.name}`).toBe(valorAntes);
      } else if (site.cart.quantityIncreaseSelector) {
        const incBtn = item.locator(site.cart.quantityIncreaseSelector).first();
        if (await incBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await clickResiliente(page, incBtn);
          await page.waitForTimeout(2000);

          const valorSubido = await leerCantidad(item, site.cart.quantityDisplay);
          if (valorAntes !== null && valorSubido !== null) {
            expect(valorSubido, `La cantidad no subió en el carrito de ${site.name}`).not.toBe(valorAntes);
          }

          if (site.cart.quantityDecreaseSelector) {
            const decBtn = item.locator(site.cart.quantityDecreaseSelector).first();
            if (await decBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await clickResiliente(page, decBtn);
              await page.waitForTimeout(2000);

              const valorBajado = await leerCantidad(item, site.cart.quantityDisplay);
              if (valorSubido !== null && valorBajado !== null) {
                expect(valorBajado, `La cantidad no bajó en el carrito de ${site.name}`).not.toBe(valorSubido);
              }
            }
          }
        }
      }

      // Pequeña espera de estabilización: algunos carritos re-renderizan (ej. agregan un
      // carrusel de "también te puede interesar") justo después de cambiar la cantidad.
      // Click SIN force acá a propósito: force salta la verificación de "elemento estable"
      // de Playwright, y si el carrusel se mueve justo en ese instante (layout shift) el
      // click cae en la posición vieja y no acierta al botón.
      await page.waitForTimeout(1000);
      await neutralizarPopups(page);
      const checkoutBtn = await primeroVisible(cartRoot.locator(site.cart.checkoutButtonSelector));
      await checkoutBtn.scrollIntoViewIfNeeded().catch(() => {});
      await clickResiliente(page, checkoutBtn);
      await page.waitForURL(/checkout/, { timeout: 20000 }).catch(() => null);

      expect(page.url(), `No se llegó a checkout en ${site.name}`).toMatch(/checkout/);
      await validarSinErrores(page, 'Checkout');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await validarSinErrores(page, 'Vuelta desde Checkout');
    });

    test(`${site.id}-05: Acceso al Login`, async ({ page }) => {
      await page.goto(`${BASE_URL}/account/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Login');

      const loginForm = page.locator('form[action*="/account"], input[type="email"]').first();
      await expect(loginForm).toBeVisible();
    });

    test(`${site.id}-06: Políticas Legales`, async ({ page }) => {
      await page.goto(`${BASE_URL}/policies/terms-of-service`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Términos');

      await page.goto(`${BASE_URL}/policies/privacy-policy`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Privacidad');
    });

  });
}
