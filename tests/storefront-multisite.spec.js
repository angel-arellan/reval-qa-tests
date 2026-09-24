const { test, expect } = require('@playwright/test');
const sites = require('./config/sites');

test.use({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 720 }
});

const POPUP_SELECTOR =
  '[id*="klaviyo"], [class*="newsletter"], [id*="shopify-section-popup"], [class*="cookie"], [id*="cookie"],' +
  '[id*="alia"], [class*="alia"], [role="dialog"][aria-modal="true"]:not([id*="facet" i]):not([class*="facet" i]):not([aria-label="Shopping cart" i]), [data-kl-scroll-locking-modal],' +
  '[id*="chat-widget"], [class*="chat-widget"], [id*="chat-launcher"], [class*="chat-launcher"],' +
  '[id*="gorgias-chat"], [id*="tidio"], [id*="intercom"], [class*="intercom"], iframe[title*="chat" i],' +
  '[id*="onetrust"], [class*="onetrust"], [id*="cookiebot"], [class*="cookiebot"], .modal-backdrop,' +
  'pandectes-cmp, [aria-label="Cookie consent" i], [id*="recart"], [id*="ltkpopup"]';
// [id*="ltkpopup"]: vendor de marketing ("LTK") visto en barenecessities.com. Inyecta
// #ltkpopup-container (role="dialog" aria-modal="true", ya cubierto por el patrón genérico de
// arriba) pero TAMBIÉN #ltkpopup-overlay: un <div aria-hidden="true"> invisible que queda
// cubriendo TODO el viewport y absorbe cualquier click real, incluso después de cerrar el
// popup con "NO, THANKS" — confirmado con Locator.click() fallando con "intercepts pointer
// events" apuntando a ese div, y con document.elementFromPoint() sobre el header devolviendo
// ese overlay en vez del menú. El patrón genérico de role=dialog no lo alcanza porque no
// tiene ese atributo. Bloquear por id (no por rol) evita tocar el resto de los sitios.
// pandectes-cmp: visto SOLO en GitHub Actions (nunca en local) — el consent management
// platform "Pandectes" muestra este banner según geolocalización de la IP, y GitHub Actions
// corre desde datacenters distintos a donde se probó en local. Confirmado en un run real de
// SwissGear CA: <pandectes-cmp role="region" aria-label="Cookie consent"> interceptando el
// click del checkout.
// Deliberadamente NO se incluye un wildcard genérico tipo [class*="popup"]: ninguno de los
// carritos/drawers configurados hoy usa esa palabra en su clase, pero a medida que se sumen
// más tiendas (con temas distintos) un patrón tan amplio puede terminar ocultando el drawer
// real de un carrito nuevo en vez de un popup. Mejor sumar el vendor puntual cuando aparezca.
// :not([id*="facet" i]):not([class*="facet" i]) en el patrón de role="dialog": el panel
// nativo de filtros de Shopify Search & Discovery (tema Dawn y derivados) se implementa como
// <div id="FacetsModal-inner" role="dialog" aria-modal="true">, y la limpieza anti-popup lo
// mataba apenas se abría (confirmado en sofiasarkany.com). "facet(s)" es un patrón propio de
// ese componente de Shopify, no específico de un sitio, así que la exclusión es genérica.
// :not([aria-label="Shopping cart" i]): el storefront headless custom de comfrt.com
// (constructor "Bite") marca su propio drawer de carrito real con role="dialog"
// aria-modal="true" aria-label="Shopping cart" (accesibilidad correcta, no es un popup) — sin
// esta exclusión, la limpieza anti-popup lo ocultaba y lo eliminaba del DOM apenas se abría.
// [id*="recart"]: la app "Recart" (SMS marketing/cart recovery) de comfrt.com inyecta
// #recart-root y #recart-popup-root, dos <div> invisibles que después de interactuar con el
// carrito (confirmado tras tocar +/- de cantidad) pasan a cubrir la pantalla por encima del
// drawer y absorben el click siguiente (confirmado con document.elementFromPoint() sobre las
// coordenadas del botón de Checkout). No se usa la clase "needsclick" (es de FastClick y
// podría existir legítimamente en otros sitios), se apunta puntualmente al id del vendor.

// Varios sitios muestran popups (newsletter, promos) con delay tras la carga o el scroll,
// justo en el momento en que un click se dispara. En vez de depender de barridos puntuales
// (que siempre pueden perder el timing exacto), se inyecta un MutationObserver que los
// elimina apenas aparecen en el DOM, durante toda la vida de la página.
// El widget de popup de starsandhoney.com (vendor "alia", visto en backend.alia-prod.com /
// files.alia-prod.com) se re-inserta solo apenas se lo borra del DOM — más rápido de lo que
// cualquier limpieza reactiva puede seguirle el ritmo. La forma confiable de sacarlo del
// medio es bloquear la petición de red a su dominio para que el widget nunca llegue a cargar.
// El popup "You've Got A Mystery Offer" de comfrt.com (vendor "Attentive", cdn.attn.tv /
// <tienda>.attn.tv) aparece de forma probabilística (no en cada carga) como overlay a
// pantalla completa con clases hasheadas del mismo storefront custom, sin ningún id/clase
// reconocible por los patrones genéricos — mismo fix que alia-prod.com.
const DOMINIOS_POPUP_BLOQUEADOS = [/alia-prod\.com/, /attn\.tv/];

// Algunos temas implementan su drawer de carrito REAL como un diálogo accesible nativo
// (<div role="dialog" aria-modal="true">) — exactamente el mismo patrón de marcado que usan
// los popups ilegítimos que POPUP_SELECTOR busca eliminar (confirmado en threebirdnest.com:
// el wrapper real del carrito es role="dialog"[aria-modal="true"], y la limpieza genérica lo
// ocultaba con display:none antes de que Playwright pudiera verlo abierto). Para no debilitar
// la defensa genérica para todos los sitios, un sitio puede optar explícitamente
// (`cart.drawerCollidesWithPopupSelector: true`) por excluir de esta limpieza cualquier
// elemento que CONTENGA su propio `cart.containerSelector` real, sin tocar el comportamiento
// para ningún sitio que no lo active.
function popupSelectorParaSitio(site) {
  if (site?.cart?.drawerCollidesWithPopupSelector && site.cart.containerSelector) {
    const contenedor = site.cart.containerSelector;
    // POPUP_SELECTOR es una lista separada por comas (varios selectores simples); encadenar
    // ":not(...)" directo al final de un string con comas solo modificaría el ÚLTIMO
    // selector de la lista, no todos. Se envuelve con :is(...) para agrupar la lista entera
    // en un solo selector compuesto antes de negar.
    // El contenedor real del carrito puede colisionar con POPUP_SELECTOR de dos formas
    // distintas según el theme: siendo él mismo el elemento con role="dialog" (ej. Ailu y
    // Andi, <cart-drawer id="cart-drawer" role="dialog" aria-modal="true">) o siendo un
    // descendiente de un wrapper más externo que matchea el patrón (ej. Three Bird Nest,
    // donde el contenido real vive DENTRO del <div role="dialog">). Se excluyen ambos casos.
    return `:is(${POPUP_SELECTOR}):not(:is(${contenedor})):not(:has(${contenedor}))`;
  }
  return POPUP_SELECTOR;
}

function sitioDeTest(testInfo) {
  const match = /^([A-Z0-9_]+)-\d+:/.exec(testInfo.title);
  return match ? sites.find((s) => s.id === match[1]) || null : null;
}

test.beforeEach(async ({ page }, testInfo) => {
  const popupSelector = popupSelectorParaSitio(sitioDeTest(testInfo));
  // Se guarda en la propia instancia de Page (lado Node, no en el browser) para que
  // neutralizarPopups() -- llamada desde decenas de puntos del spec sin acceso a `site` --
  // pueda reutilizar el mismo selector ya resuelto sin tener que cambiar su firma.
  page.__popupSelector = popupSelector;

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (DOMINIOS_POPUP_BLOQUEADOS.some((patron) => patron.test(url))) {
      return route.abort();
    }
    return route.continue();
  });

  // Defensa adicional vía CSS puro: un <style> se aplica en cuanto el motor lo parsea, sin
  // esperar a que corra JS ante cada mutación del DOM — cubre la ventana más temprana (el
  // primer frame) donde un overlay recién insertado puede interceptar un click antes de que
  // el MutationObserver de abajo llegue a reaccionar. Se usa addInitScript (no addStyleTag)
  // para que el <style> se re-inyecte en CADA navegación, no solo en la página actual.
  await page.addInitScript((selector) => {
    // document.documentElement ya existe apenas se crea el documento (antes que <head>) en
    // la gran mayoría de los sitios, así que se cuelga ahí directamente en vez de esperar un
    // evento que llega más tarde. Pero en sitios que hidratan su theme de forma asíncrona con
    // frameworks pesados (ej. rbxactive.com, con React) se vio en vivo que en el instante
    // exacto en que corre este script document.documentElement puede ser null todavía — sin
    // esta guarda, appendChild tira una excepción síncrona que aborta el resto del
    // addInitScript en silencio, dejando TODA la limpieza anti-popup desactivada para esa
    // carga de página. Se reintenta con setTimeout(0) hasta que exista.
    const inyectar = () => {
      if (!document.documentElement) {
        setTimeout(inyectar, 0);
        return;
      }
      const estilo = document.createElement('style');
      estilo.textContent = `${selector} { display: none !important; pointer-events: none !important; }`;
      document.documentElement.appendChild(estilo);
    };
    inyectar();
  }, popupSelector);

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
    // Misma guarda que el <style> de arriba: document.documentElement puede ser null en el
    // instante exacto en que corre este script en sitios con hidratación asíncrona pesada.
    const iniciar = () => {
      if (!document.documentElement) {
        setTimeout(iniciar, 0);
        return;
      }
      new MutationObserver(kill).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
      });
      kill();
      setInterval(kill, 1000);
    };
    iniciar();
  }, popupSelector);
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
    }, page.__popupSelector || POPUP_SELECTOR);
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
  const INTENTOS_MAX = 3;
  let ultimoError;
  for (let intento = 0; intento < INTENTOS_MAX; intento++) {
    await cerrarPopupSiExiste(page);
    if (intento > 0) {
      // skipEscape: acá casi siempre se está reintentando un click dentro de un drawer de
      // carrito ya abierto (+/-, checkout). Presionar Escape lo cerraría a él también, no
      // solo al popup que interceptó el click.
      await neutralizarPopups(page, { skipEscape: true });
    }
    try {
      // force solo en el último intento: un click real (sin force) es el que efectivamente
      // dispara los listeners nativos del sitio: recurrir a force de entrada puede "acertar"
      // visualmente sin que el handler de click del sitio llegue a correr.
      const forzar = intento === INTENTOS_MAX - 1;
      await locator.click({ timeout: 5000, force: forzar, ...options });
      return;
    } catch (e) {
      ultimoError = e;
    }
  }
  throw ultimoError;
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
    return;
  }

  // Selector custom tipo combobox+listbox ARIA (visto en barenecessities.com: un
  // <button role="combobox" aria-haspopup="listbox"> que al clickear despliega una lista
  // <[role="option"]> posicionada con position:fixed). El theme duplica el trigger para
  // desktop/mobile (uno de los dos con bounding box 0x0), de ahí primeroVisible(). La lista
  // de opciones puede ser mucho más alta que el viewport de test — alcanza con elegir la
  // primera opción disponible para completar el flujo de compra real, no hace falta una
  // variante específica.
  if (pdp.variantType === 'combobox-listbox') {
    const trigger = await primeroVisible(opciones);
    await trigger.click();
    await page.waitForTimeout(600);
    const option = page.locator(pdp.variantOptionSelector || '[role="option"]').first();
    await option.click({ timeout: 8000 });
    await page.waitForTimeout(600);
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
  const esperarRespuestaCartAdd = () =>
    page
      .waitForResponse((resp) => /\/cart\/add(\.js)?(\?|$)/.test(resp.url()) && resp.request().method() === 'POST', { timeout: 10000 })
      .catch(() => null);

  let addToCartResponse = esperarRespuestaCartAdd();
  await addBtn.click({ force: true });
  let respuesta = await addToCartResponse;

  // Algunos custom elements (ej. <buy-buttons> de Ailu y Andi) a veces no terminan de
  // hidratar su listener de submit para cuando Playwright hace el primer click, sobre todo
  // justo después de domcontentloaded — el resultado es que ese click no dispara ningún
  // request real a /cart/add (confirmado con logging de red: 0 requests en la ventana de
  // 10s). Reintentar una vez resuelve esto sin enmascarar un fallo real del sitio (si el
  // segundo intento tampoco responde, se sigue cayendo al timeout normal de abajo).
  // Gateado por sitio (`pdp.retryAddToCartClick`) para no arriesgar un doble-submit en
  // temas con form POST clásico, donde la ausencia de respuesta AJAX es esperable.
  if (!respuesta && site.pdp.retryAddToCartClick) {
    addToCartResponse = esperarRespuestaCartAdd();
    await addBtn.click({ force: true });
    respuesta = await addToCartResponse;
  }
  await page.waitForTimeout(1000);

  if (site.cart.type === 'drawer') {
    const drawer = page.locator(site.cart.containerSelector).first();
    // Algunos temas modernos implementan el drawer como un custom element con
    // `display: contents` en el host (ej. Ailu y Andi, Three Bird Nest) — el wrapper en sí
    // no tiene bounding box aunque su contenido ya esté visible y poblado. En esos casos
    // isVisible() del contenedor da falso negativo. Se acepta como señal válida de "el
    // carrito abrió" que el contenedor sea visible O que ya haya aparecido el item dentro.
    // .first() al final es necesario: cuando el contenedor SÍ tiene bounding box (la mayoría
    // de los sitios) .or() sin esto devuelve la unión de AMBOS matches (contenedor + item),
    // lo que viola el modo estricto de toBeVisible() al resolver a más de un elemento.
    const abrio = site.cart.itemSelector
      ? drawer.or(page.locator(site.cart.containerSelector).locator(site.cart.itemSelector).first()).first()
      : drawer;
    await expect(abrio, `El carrito no se abrió tras agregar en ${site.name}`).toBeVisible({ timeout: 10000 });
  } else {
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await aceptarCookies(page, site);
    await neutralizarPopups(page);
    await validarSinErrores(page, 'Carrito');
  }
}

for (const site of sites) {
  const BASE_URL = process.env[`STOREFRONT_URL_${site.id}`] || site.baseUrl;
  // Por defecto se asume que el sitio es una tienda (los 4 sitios ya existentes no declaran
  // este campo). Los sitios informativos/landing sin carrito (agregados a partir del batch de
  // reconocimiento de 16 sitios) declaran `ecommerce: false` en sites.js: para esos no tiene
  // sentido correr búsqueda/catálogo/PDP-carrito/login/políticas (son paths de e-commerce que
  // no existen en un sitio sin tienda), así que solo corren Home+Header y el chequeo mobile.
  const esEcommerce = site.ecommerce !== false;

  test.describe(`Storefront Multisite – ${site.name} (${BASE_URL})`, () => {

    test(`${site.id}-01: Home & Header - Navegación por Categorías`, async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Home');

      // Se usa primeroVisible() en vez de .first(): algunos sitios (ej. Ena Sport) tienen un
      // botón de búsqueda mobile oculto en desktop (sm:hidden) que aparece antes que el logo
      // real en el orden del DOM — .first() sin filtrar visibilidad agarraba ese nodo oculto.
      // logoSelector/footerSelector (opcionales, a nivel sitio): algunos landings sin tienda
      // (ej. latechfactory.com) son custom-built sin <header>/<footer>/<nav> semánticos ni
      // ninguna clase reconocible como "logo" — para esos casos el sitio puede declarar su
      // propio selector; si no lo declara, el comportamiento genérico es idéntico al actual.
      const logo = await primeroVisible(page.locator(site.logoSelector || '[class*="logo"], header a'));
      await expect(logo).toBeVisible({ timeout: 10000 });

      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));

      // Sin timeout fijo: expect(...).toBeVisible ya hace polling hasta 5s por default,
      // que cubre de sobra la animación del scroll suave.
      // primeroVisible(): algunos sitios (ej. Ailu y Andi) renderizan más de un <footer> —
      // plantillas internas ocultas de un custom element además del footer real — y .first()
      // sin filtrar visibilidad agarraba siempre uno de los ocultos.
      const footer = await primeroVisible(page.locator(site.footerSelector || 'footer, [role="contentinfo"]'));
      await expect(footer).toBeVisible();

      if (site.header?.hasMegaMenu) {
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
          // clickResiliente (no un .click() plano): en menús que abren con una transición CSS
          // (ej. machinerymasterslive.com, opacity con transition) un click justo durante la
          // transición puede caer en la ventana en que Playwright considera el elemento "not
          // stable" todavía — confirmado en vivo con ~1/3 de intentos fallando sin retry.
          await clickResiliente(page, sublink);
          await page.waitForLoadState('domcontentloaded');
          await neutralizarPopups(page);
          await validarSinErrores(page, 'Subcategoría del Header');
        }
      }
    });

    if (esEcommerce) {

    test(`${site.id}-02: Buscador - Búsqueda en Vivo`, async ({ page }) => {
      await page.goto(`${BASE_URL}/search?q=${site.search.term}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Resultados de Búsqueda');

      const producto = await primeroVisible(page.locator('a[href*="/products/"]'));
      await expect(producto).toBeVisible({ timeout: 10000 });

      // Best-effort: el título que muestra la card de resultado "debería" corresponder con el
      // <h1> real de la PDP a la que lleva. Se reporta como anotación informativa, NUNCA como
      // fallo duro: en varios temas (confirmado en vivo) el primer link visible a "/products/"
      // en la página de búsqueda es un banner promocional (ej. "CURSO NUEVO! Conocé el último
      // lanzamiento!" en Ailu y Andi) y no la card real del resultado — un selector genérico
      // que distinga "card de resultado real" de "banner promocional" no es confiable across
      // los ~13 temas distintos que ya soporta este sistema, así que forzarlo como assert duro
      // generaría alertas falsas de Slack por un límite de la heurística, no por un bug real.
      const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
      const textoOriginalEnBusqueda = await producto.textContent();
      const tituloEnBusqueda = normalizar(textoOriginalEnBusqueda);

      if (tituloEnBusqueda.length >= 8) {
        // Todo el bloque en un try/catch con timeouts cortos y explícitos: es un chequeo
        // best-effort, así que en ningún caso puede arrastrar el test hasta su timeout
        // global de 60s si el sitio es lento para esta interacción puntual (confirmado en
        // vivo en RBX Active: el click de producto.click() sin timeout propio tardó ~55s en
        // superar los chequeos de actionability de Playwright, dejando muy poco margen para
        // el resto del test).
        try {
          await producto.click({ timeout: 8000 });
          // No se usa waitForLoadState('domcontentloaded'): algunos temas (ej. RBX Active,
          // React SPA) navegan client-side sin un nuevo evento de carga de documento, y ese
          // wait se cuelga hasta el timeout global del test. Esperar el <h1> directamente
          // funciona para navegación real y para SPA por igual.
          await page.locator('h1').first().waitFor({ state: 'attached', timeout: 8000 });
          await neutralizarPopups(page);
          const tituloEnPDP = normalizar(await page.locator('h1').first().textContent());
          const extracto = tituloEnBusqueda.slice(0, 15);
          const corresponde = tituloEnPDP.includes(extracto);
          test.info().annotations.push({
            type: corresponde ? 'info' : 'warning',
            description: corresponde
              ? `Título de búsqueda↔PDP OK en ${site.name}`
              : `No se pudo confirmar que el título de la card de búsqueda corresponda con la PDP en ${site.name} (buscado: "${textoOriginalEnBusqueda}") — best-effort, no bloquea el test.`,
          });
        } catch (e) {
          test.info().annotations.push({
            type: 'info',
            description: `No se pudo verificar el título de búsqueda↔PDP en ${site.name} (best-effort, no bloquea el test): ${e.message?.split('\n')[0]}`,
          });
        }
      }
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

        // Algunos paneles agrupan las opciones en acordeones colapsados (max-height: 0) —
        // hay que expandir la sección puntual (ej. "Size" en RBX Active) antes de que el
        // checkbox/label sea clickeable de verdad. Sin esto, Playwright puede reportar el
        // label como "attached"/"visible" (falso positivo por clipping de un ancestro) pero
        // el click nunca llega a marcar el checkbox. Opcional: si el sitio no lo declara, el
        // comportamiento es idéntico al actual.
        if (site.collection.filters.sectionToggleSelector) {
          const sectionToggle = page.locator(site.collection.filters.sectionToggleSelector).first();
          if (await sectionToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            await clickResiliente(page, sectionToggle);
            await page.waitForTimeout(500);
          }
        }

        // skipEscape: en sitios donde el toggle abre un <details>/<summary> nativo o un
        // drawer de filtros (ej. Adepac), Escape lo cierra de nuevo -- el label del filtro
        // sigue "attached" al DOM (por eso el waitFor de abajo no lo detecta) pero deja de
        // estar realmente en pantalla, y el click con force:true termina cayendo sobre lo
        // que haya debajo (ej. una card de producto), navegando a un lugar equivocado en vez
        // de aplicar el filtro.
        await neutralizarPopups(page, { skipEscape: true });

        const filterLabel = page.locator(site.collection.filters.labelSelector).first();
        await filterLabel.waitFor({ state: 'attached', timeout: 5000 });
        // scrollIntoView vía evaluate (no el auto-scroll de Playwright): en paneles con
        // listas largas dentro de un contenedor con overflow propio (ej. Ena Sport, facetas
        // de sabor) el auto-scroll de click() a veces deja el elemento igual fuera del
        // viewport visual ("Element is outside of the viewport"), porque no siempre resuelve
        // bien un ancestro con su propio scroll interno.
        await filterLabel.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});

        // Algunos widgets de filtro (ej. Shopify Search & Discovery) no siempre disparan su
        // listener de "change" con el primer click sintético — se reintenta una vez más antes
        // de fallar, en vez de asumir que un solo click alcanza siempre.
        // urlChangePattern: por defecto se exige que la URL contenga "filter" (Shopify Search
        // & Discovery nativo). Algunos sitios usan un filtro custom con otro formato de query
        // (ej. RBX Active: "?sizes=M") — declarar este campo reemplaza ese patrón por sitio.
        const patronUrl = site.collection.filters.urlChangePattern || /filter/i;
        let urlDespues = page.url();
        try {
          for (let intento = 0; intento < 2 && urlDespues === urlAntes; intento++) {
            await filterLabel.click({ force: true });

            // Algunos temas (ej. Sofía Sarkany, RBX Active) no aplican el filtro apenas se
            // tilda el checkbox — exigen un click extra en un botón "Aplicar"/"Apply" del
            // panel. Opcional: si el sitio no lo declara, el comportamiento es idéntico al
            // actual.
            if (site.collection.filters.applyButtonSelector) {
              const applyBtn = page.locator(site.collection.filters.applyButtonSelector).first();
              if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                try {
                  await applyBtn.click({ force: true });
                } catch (clickError) {
                  // Algunos paneles de filtro (ej. Bare Necessities: dropdown "Band Size")
                  // son un panel position:fixed cuyo contenido (lista + botón Apply) excede
                  // el viewport de test (1280x720) — el botón queda "visible" pero Playwright
                  // rechaza dispatchear un click ahí incluso con force (no permite coordenadas
                  // fuera del viewport). Confirmado en vivo: el filtro SÍ aplica de verdad
                  // (URL y cantidad de productos cambian) si se dispara un click nativo del
                  // DOM en vez de uno basado en coordenadas de mouse. Fallback puntual a ese
                  // error para no enmascarar otros fallos reales de click.
                  if (/outside of the viewport/i.test(clickError.message)) {
                    await applyBtn.evaluate((el) => el.click());
                  } else {
                    throw clickError;
                  }
                }
              }
            }

            await page.waitForURL(patronUrl, { timeout: 8000 }).catch(() => null);
            urlDespues = page.url();
          }
        } catch (e) {
          // click({force:true}) puede tirar "Element is outside of the viewport" incluso con
          // force (no es una de las actionability checks que force bypassea) cuando el
          // ancestro con scroll propio no logra posicionar el elemento — visto en vivo de
          // forma intermitente en Ena Sport. Con softCheck se trata como "no se pudo
          // confirmar" en vez de reventar el test; sin softCheck se preserva el fallo duro
          // para no ocultar un problema real de selectores en el resto de los sitios.
          if (!site.collection.filters.softCheck) throw e;
        }

        const filtroAplicado = urlDespues !== urlAntes && patronUrl.test(urlDespues.toLowerCase());

        if (site.collection.filters.softCheck) {
          // Confirmado en vivo (ej. Ena Sport) con scripts aislados idénticos, corridos
          // varias veces seguidas sin ningún cambio de nuestro lado: a veces el click real
          // dispara el listener de "change" del widget de filtro y a veces no — es una
          // condición de carrera del propio JS del sitio al hidratar el panel, no un
          // problema de selectores. Se valida best-effort para no generar alertas falsas de
          // Slack por esto en cada corrida horaria.
          test.info().annotations.push({
            type: filtroAplicado ? 'info' : 'warning',
            description: filtroAplicado
              ? `Filtro OK en ${site.name}`
              : `No se pudo confirmar que el filtro aplique vía automation en ${site.name} (best-effort, no bloquea el test)`,
          });
        } else {
          expect(urlDespues, `El filtro no modificó la URL en ${site.name}`).not.toBe(urlAntes);
          expect(urlDespues.toLowerCase(), `La URL no refleja un filtro aplicado en ${site.name}`).toMatch(patronUrl);
        }
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
        const valorSubido = await esperarCambioCantidad(page, item, site.cart.quantityDisplay, valorAntes);
        expect(valorSubido, `La cantidad no subió en el carrito de ${site.name}`).toBe(cantidadSubida);

        await input.fill(valorAntes);
        await input.dispatchEvent('change');
        const valorBajado = await esperarCambioCantidad(page, item, site.cart.quantityDisplay, valorSubido);
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

    } // fin if (esEcommerce)

    test(`${site.id}-07: Responsive Mobile - Home sin overflow horizontal`, async ({ page }) => {
      // Viewport de un iPhone chico a propósito: si algo rompe el layout, suele notarse
      // primero en el ancho más angosto realista, no en un mobile grande.
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Home Mobile');

      // Algunos carruseles con JS propio (ej. Keen Slider, visto en barenecessities.com)
      // recién aplican su clipping real (overflow-x:hidden sobre su propio track) un
      // instante después de 'domcontentloaded' — confirmado en vivo: medir el overflow
      // inmediatamente después de la carga muestra ~19px de más (el slide siguiente del
      // carrusel todavía sin clippear), pero ese valor cae solo a 0 sin ninguna interacción
      // nuestra apenas la librería termina de inicializar (~1-1.5s después). Un usuario real
      // tampoco alcanza a interactuar en esa ventana. Se le da ese margen antes de medir para
      // no reportar como bug de layout lo que en realidad es timing de hidratación.
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

      // Overflow horizontal es el síntoma más común y más visible de un layout responsive
      // roto (un elemento con un ancho fijo, una imagen sin max-width, etc.). Se tolera un
      // margen chico (scrollbars, redondeos de subpíxel) en vez de exigir 0 exacto.
      const overflowPx = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(
        overflowPx,
        `Overflow horizontal de ${overflowPx}px detectado en mobile en ${site.name} (algún elemento se desborda del viewport)`
      ).toBeLessThanOrEqual(4);

      // primeroVisible() en vez de .first(): algunos sitios tienen secciones de header
      // ocultas en mobile (ej. Ena Sport, cuya mega nav de desktop matchea primero por el
      // selector genérico pero tiene display:none en este viewport). logoSelector se
      // reutiliza acá como "algo del header" para sitios sin <header> semántico.
      const header = await primeroVisible(page.locator(site.logoSelector || 'header, [class*="header"]'));
      await expect(header, `Header no visible en mobile en ${site.name}`).toBeVisible({ timeout: 10000 });

      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      const footer = await primeroVisible(page.locator(site.footerSelector || 'footer, [role="contentinfo"]'));
      await expect(footer, `Footer no visible en mobile en ${site.name}`).toBeVisible();
    });

    test(`${site.id}-08: Visual - Elementos rotos`, async ({ page }) => {
      // Test visual separado de los funcionales (01-07) a propósito, para que quede claro en
      // Slack/CI si lo que falló es una interacción (búsqueda, carrito, etc.) o algo puramente
      // visual. Detección basada en inspección del DOM, SIN capturar ni guardar ninguna
      // imagen/screenshot en cada corrida (Playwright ya adjunta un screenshot automático
      // solo cuando un test falla, vía playwright.config.js) — así no se acumulan fotos en
      // git/GitHub en cada corrida horaria, solo cuando hay algo real para revisar.
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await aceptarCookies(page, site);
      await neutralizarPopups(page);
      await validarSinErrores(page, 'Home Visual');

      const diagnostico = await page.evaluate(() => {
        // Solo imágenes que ocupan espacio real en el layout (descarta las de 0x0, que
        // suelen ser trackers/pixels, no contenido visual real como un banner o una foto).
        const imgsRotas = [...document.querySelectorAll('img')]
          .filter((img) => img.getBoundingClientRect().width > 2 && img.getBoundingClientRect().height > 2)
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.currentSrc || img.src || img.getAttribute('data-src') || '(sin src)');

        return { imgsRotas, hojasDeEstilo: document.styleSheets.length };
      });

      expect(
        diagnostico.imgsRotas,
        `Imagen(es) rota(s) detectada(s) en Home de ${site.name} (ej. un banner o foto de producto que no cargó): ${diagnostico.imgsRotas.join(', ')}`
      ).toHaveLength(0);
      expect(
        diagnostico.hojasDeEstilo,
        `No se detectó ninguna hoja de estilos cargada en ${site.name} — la página podría estar mostrándose sin ningún estilo visual.`
      ).toBeGreaterThan(0);
    });

  });
}
