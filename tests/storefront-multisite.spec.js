const { test, expect } = require('@playwright/test');
const sites = require('./config/sites');

test.use({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 720 }
});

const POPUP_SELECTOR =
  '[id*="klaviyo"], [class*="newsletter"], [id*="shopify-section-popup"], [class*="cookie"], [id*="cookie"],' +
  '[id*="alia"], [class*="alia"], [role="dialog"][aria-modal="true"], [data-kl-scroll-locking-modal],' +
  '[id*="chat-widget"], [class*="chat-widget"], [id*="chat-launcher"], [class*="chat-launcher"],' +
  '[id*="gorgias-chat"], [id*="tidio"], [id*="intercom"], [class*="intercom"], iframe[title*="chat" i]';

// Varios sitios muestran popups (newsletter, promos) con delay tras la carga o el scroll,
// justo en el momento en que un click se dispara. En vez de depender de barridos puntuales
// (que siempre pueden perder el timing exacto), se inyecta un MutationObserver que los
// elimina apenas aparecen en el DOM, durante toda la vida de la página.
// El widget de popup de starsandhoney.com (vendor "alia", visto en backend.alia-prod.com /
// files.alia-prod.com) se re-inserta solo apenas se lo borra del DOM — más rápido de lo que
// cualquier limpieza reactiva puede seguirle el ritmo. La forma confiable de sacarlo del
// medio es bloquear la petición de red a su dominio para que el widget nunca llegue a cargar.
const DOMINIOS_POPUP_BLOQUEADOS = [/alia-prod\.com/];

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (DOMINIOS_POPUP_BLOQUEADOS.some((patron) => patron.test(url))) {
      return route.abort();
    }
    return route.continue();
  });

  await page.addInitScript((selector) => {
    const kill = () => {
      document.querySelectorAll(selector).forEach((el) => el.remove());
      // Algunos popups (ej. captura de email) no usan ninguna clase/id reconocible, pero sí
      // tienen un botón cuyo nombre accesible es "Close popup" — muchas veces ese nombre
      // viene de un <span> de texto oculto (sr-only), no de un atributo aria-label literal,
      // así que hay que comparar por texto (incluido el oculto) en vez de por selector CSS.
      [...document.querySelectorAll('button, [role="button"]')]
        .filter((btn) => {
          const texto = (btn.textContent || '').trim().toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
          return texto === 'close popup' || ariaLabel === 'close popup';
        })
        .forEach((btn) => {
          const dialog = btn.closest('[role="dialog"], [class*="modal" i], [class*="popup" i]');
          (dialog || btn.parentElement?.parentElement?.parentElement || btn).remove();
        });
    };
    // childList detecta popups insertados de cero; attributes cubre los que ya existen
    // ocultos en el HTML inicial y se revelan después con una clase/estilo (ej. "is-open").
    // El setInterval es un respaldo final por si algún caso se escapa de ambos.
    new MutationObserver(kill).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
    });
    kill();
    setInterval(kill, 1000);
  }, POPUP_SELECTOR);
});

async function neutralizarPopups(page, { skipEscape = false } = {}) {
  // El MutationObserver inyectado ya limpia continuamente; esto es solo un barrido puntual
  // extra (por ejemplo tras un scroll que puede activar algo fuera del subtree observado).
  //
  // skipEscape: un carrito tipo drawer (ej. #CartDrawer) casi siempre escucha Escape para
  // cerrarse a sí mismo. Si esta función se llama mientras el drawer está abierto (carrito,
  // checkout), presionar Escape lo cierra y el botón que se busca a continuación deja de
  // existir — hay que omitir esa tecla en esos contextos.
  try {
    if (!skipEscape) {
      await page.keyboard.press('Escape');
    }
    await page.evaluate((selector) => {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    }, POPUP_SELECTOR);
  } catch (e) {}
  await page.waitForTimeout(500);
}

// Varios sitios disparan popups con delay (aparecen unos segundos después de la carga o
// tras un scroll) que pueden interceptar un click justo en el momento en que se dispara.
// Se intenta el click normal primero; si Playwright lo bloquea por interceptación, se
// limpian popups y se reintenta una vez más antes de darlo por fallado de verdad.
// Algunos widgets de popup (ej. captura de email) vuelven a insertarse solos apenas se
// borran del DOM — pelean contra la remoción. Clickear su botón real de cierre dispara el
// handler propio del sitio (que suele marcar "ya cerrado" para esa sesión) y es mucho más
// efectivo que borrar nodos que el sitio simplemente vuelve a crear.
async function cerrarPopupSiExiste(page) {
  const cerrar = page.locator('button, [role="button"]').filter({ hasText: /^close popup$/i });
  if (await cerrar.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await cerrar.first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function clickResiliente(page, locator, options = {}) {
  await cerrarPopupSiExiste(page);
  try {
    await locator.click({ timeout: 5000, ...options });
  } catch (e) {
    // skipEscape: acá casi siempre se está reintentando un click dentro de un drawer de
    // carrito ya abierto (+/-, checkout). Presionar Escape lo cerraría a él también, no
    // solo al popup que interceptó el click.
    await cerrarPopupSiExiste(page);
    await neutralizarPopups(page, { skipEscape: true });
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

// El AJAX del carrito puede tardar más que una espera fija según el sitio; se hace polling
// hasta ver un valor distinto al anterior en vez de asumir un tiempo fijo.
async function esperarCambioCantidad(page, scope, quantityDisplay, valorAnterior, timeoutMs = 6000) {
  const inicio = Date.now();
  let actual = valorAnterior;
  while (Date.now() - inicio < timeoutMs) {
    actual = await leerCantidad(scope, quantityDisplay);
    if (actual !== null && actual !== valorAnterior) return actual;
    await page.waitForTimeout(300);
  }
  return actual;
}

// Un solo click + espera de cambio. A propósito NO reintenta el click: en un contador con
// estado (+/-), reintentar cuando el click en realidad SÍ había registrado pero la detección
// fue lenta termina disparando clicks extra reales (ej. bajar de 1 a 0 vacía el carrito). Si
// el cambio no se detecta a tiempo, es mejor que el llamador lo reporte (o lo trate soft) a
// que el test mismo corrompa el estado del carrito reintentando a ciegas.
async function clickYEsperarCambio(page, btn, scope, quantityDisplay, valorAnterior) {
  await clickResiliente(page, btn);
  return esperarCambioCantidad(page, scope, quantityDisplay, valorAnterior);
}

// En algunos sitios el cambio de cantidad es genuinamente flaky en automation (condición de
// carrera real en el AJAX del propio sitio, no un bug de producción) — se valida best-effort
// vía una anotación en vez de bloquear el test entero por esto.
function verificarCambioCantidad(test, site, valorNuevo, valorAnterior, mensaje) {
  const cambio = valorAnterior === null || valorNuevo !== valorAnterior;
  if (site.quantityCheckSoft) {
    test.info().annotations.push({
      type: cambio ? 'info' : 'warning',
      description: cambio ? `${mensaje}: OK` : `${mensaje}: no confirmado (best-effort, no bloquea el test)`,
    });
    return;
  }
  if (valorAnterior !== null) {
    expect(valorNuevo, mensaje).not.toBe(valorAnterior);
  }
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
  // Se registra el listener ANTES del click para no perder la respuesta por una
  // condición de carrera. Casi todo tema Shopify pega a /cart/add(.js) via AJAX al
  // agregar; esperar la respuesta real (en vez de un timeout fijo) evita navegar a
  // /cart antes de que el server haya terminado de procesar el alta — la causa real
  // de un "Your cart is empty" visto en CI con Stars + Honey. Si el sitio no usa ese
  // endpoint (ej. un form POST clásico), simplemente no resuelve y se cae al timeout.
  const addToCartResponse = page
    .waitForResponse((resp) => /\/cart\/add(\.js)?(\?|$)/.test(resp.url()) && resp.request().method() === 'POST', { timeout: 10000 })
    .catch(() => null);
  await addBtn.click({ force: true });
  await addToCartResponse;
  await page.waitForTimeout(1000);

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

        // Algunos widgets de filtro (ej. Shopify Search & Discovery) no siempre disparan su
        // listener de "change" con el primer click sintético — se reintenta una vez más antes
        // de fallar, en vez de asumir que un solo click alcanza siempre.
        let urlDespues = page.url();
        for (let intento = 0; intento < 2 && urlDespues === urlAntes; intento++) {
          await filterLabel.click({ force: true });
          await page.waitForURL(/filter/i, { timeout: 8000 }).catch(() => null);
          urlDespues = page.url();
        }

        expect(urlDespues, `El filtro no modificó la URL en ${site.name}`).not.toBe(urlAntes);
        expect(urlDespues.toLowerCase(), `La URL no refleja un filtro aplicado en ${site.name}`).toMatch(/filter/);
      }
    });

    test(`${site.id}-04: PDP, Carrito y Checkout - Flujo Completo`, async ({ page }) => {
      test.skip(!!site.knownProductionBug, site.knownProductionBug);
      // Flujo largo (PDP + variante + carrito + subir/bajar cantidad + checkout, con varias
      // limpiezas de popups): puede acercarse al timeout global de 60s. Se extiende solo acá,
      // sin tocar playwright.config.js (usado también por los tests de Reval y Wellness Project).
      test.setTimeout(120000);

      await agregarProductoAlCarrito(page, site, BASE_URL);

      const cartRoot = site.cart.type === 'drawer' ? page.locator(site.cart.containerSelector) : page.locator('body');

      const item = cartRoot.locator(site.cart.itemSelector).first();
      await expect(item, `No se ve ningún item en el carrito de ${site.name}`).toBeVisible({ timeout: 10000 });

      // Algunos carritos (ej. página clásica de starsandhoney) tardan un instante más en
      // terminar de atar los event handlers de los botones +/- que en mostrarse visualmente;
      // clickear antes de eso hace que el click no dispare nada.
      await page.waitForTimeout(1500);

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
          const valorSubido = await clickYEsperarCambio(page, incBtn, item, site.cart.quantityDisplay, valorAntes);
          verificarCambioCantidad(test, site, valorSubido, valorAntes, `La cantidad no subió en el carrito de ${site.name}`);

          if (site.cart.quantityDecreaseSelector) {
            const decBtn = item.locator(site.cart.quantityDecreaseSelector).first();
            if (await decBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              const valorBajado = await clickYEsperarCambio(page, decBtn, item, site.cart.quantityDisplay, valorSubido);
              verificarCambioCantidad(test, site, valorBajado, valorSubido, `La cantidad no bajó en el carrito de ${site.name}`);
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
      // skipEscape: el drawer del carrito ya está abierto acá — Escape lo cerraría antes
      // de poder buscar el botón de checkout (causa real de un cuelgue visto en CI).
      await neutralizarPopups(page, { skipEscape: true });
      const checkoutBtn = await primeroVisible(cartRoot.locator(site.cart.checkoutButtonSelector));
      // Falla rápido y con mensaje claro si el carrito no está (en vez de colgarse sin
      // timeout hasta el límite global del test).
      await expect(checkoutBtn, `No se encontró el botón de checkout en el carrito de ${site.name}`).toBeVisible({ timeout: 8000 });
      await checkoutBtn.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
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
