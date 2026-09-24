// Suite RESPONSIVE / MOBILE para todas las tiendas de tests/config/sites.js.
//
// Complementa al test -07 de storefront-multisite.spec.js (que solo mide overflow de la Home
// en mobile) sumando Colección, PDP, tablet y la interacción mobile más usada: el menú.
//   RESP-01  Mobile: Colección y PDP sin overflow horizontal
//   RESP-02  Tablet: Home, Colección y PDP sin overflow horizontal
//   RESP-03  Mobile: el menú hamburguesa abre y muestra la navegación
//   RESP-04  Mobile: PDP con título, imagen, precio y botón de compra visibles
//   RESP-05  Mobile: meta viewport correcto
//   RESP-06  Mobile: imágenes del primer pantallazo cargan (sin imágenes rotas)
//
// Son tiendas productivas de clientes: esta suite NUNCA agrega al carrito, envía
// formularios ni crea pedidos. Solo navega, abre el menú y lee.

const { test, expect, devices } = require('@playwright/test');
const sites = require('./config/sites');
const ajustes = require('./config/responsive');

// defaultBrowserType no se puede fijar dentro de un describe; se descarta y se corre en
// Chromium con la emulación del dispositivo (viewport, UA mobile, touch, DPR).
const { defaultBrowserType: _a, ...MOBILE } = devices['iPhone 13'];
const { defaultBrowserType: _b, ...TABLET } = devices['iPad Mini'];

const DOMINIOS_POPUP_BLOQUEADOS = [/alia-prod\.com/, /attn\.tv/];
const TOLERANCIA_OVERFLOW_PX = 4;

// Candidatos genéricos de botón de menú mobile, en orden de especificidad. Se toma el
// primero visible dentro de la franja superior de la pantalla (el header).
const TOGGLES_MENU = [
  'header-drawer summary',
  'summary[aria-controls*="menu" i]',
  'button[aria-controls*="menu" i]',
  'button[aria-controls*="drawer" i]',
  'button[aria-controls*="nav" i]',
  '[aria-label*="menu" i]:is(button, a, summary, [role="button"])',
  '[aria-label*="menú" i]:is(button, a, summary, [role="button"])',
  '[aria-label*="navigation" i]:is(button, a, summary, [role="button"])',
  'button[class*="hamburger" i], button[class*="burger" i], [class*="hamburger" i]:is(a, summary, [role="button"])',
  '[class*="menu-toggle" i], [class*="menu-trigger" i], [class*="nav-toggle" i]',
  '[class*="mobile-menu" i]:is(button, a, summary), [class*="mobile-nav" i]:is(button, a, summary)',
  '[data-action*="menu" i], [data-drawer-toggle], [data-toggle*="menu" i]',
  // Por texto visible: "MENU" (starsandhoney.com), "Open menu drawer" (comfrt.com).
  ':is(button, summary, label, a, [role="button"]):text-matches("^\\s*(open\\s+)?(menu|menú)(\\s+drawer)?\\s*$", "i")',
  // <details><summary class="mobile-toggle"> (sofiasarkany.com) y variantes.
  'summary[class*="toggle" i], summary[class*="mobile" i]',
  '[class*="hamburger" i]:is(label, button, a, summary, [role="button"])',
];

// Descarta botones que matchean los patrones genéricos pero NO abren el menú: el "Close menu"
// del backdrop, o los drawers de carrito/búsqueda (aria-controls="CartDrawer", etc.).
async function esToggleDeMenu(locator) {
  return locator.evaluate((el) => {
    const texto = `${el.getAttribute('aria-label') || ''} ${el.innerText || ''}`;
    const controla = el.getAttribute('aria-controls') || '';
    return !/close|cerrar/i.test(texto) && !/cart|search|bag|carrito|busca/i.test(controla);
  }).catch(() => false);
}

function ajustesDe(site) {
  return ajustes[site.id] || {};
}

async function bloquearPopups(page) {
  await page.route('**/*', (route) => {
    if (DOMINIOS_POPUP_BLOQUEADOS.some((p) => p.test(route.request().url()))) return route.abort();
    return route.continue();
  });
}

async function visitar(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  // Carruseles con JS propio aplican su clipping recién al hidratar (ver test -07 del spec
  // funcional): se les da margen antes de medir.
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return response;
}

async function urlPdp(page, site) {
  if (site.pdp?.path) return new URL(site.pdp.path, site.baseUrl).href;
  for (const path of [site.collection?.path, site.search?.term && `/search?q=${encodeURIComponent(site.search.term)}&type=product`]) {
    if (!path) continue;
    await visitar(page, new URL(path, site.baseUrl).href);
    const href = await page.locator('a[href*="/products/"]').first().getAttribute('href').catch(() => null);
    if (href) return new URL(href, site.baseUrl).href;
  }
  return null;
}

async function paginas(page, site, { incluirHome }) {
  const lista = incluirHome ? [{ nombre: 'Home', url: site.baseUrl }] : [];
  if (site.ecommerce === false) return lista.length ? lista : [{ nombre: 'Home', url: site.baseUrl }];
  if (site.collection?.path) lista.push({ nombre: 'Colección', url: new URL(site.collection.path, site.baseUrl).href });
  const pdp = await urlPdp(page, site);
  if (pdp) lista.push({ nombre: 'PDP', url: pdp });
  return lista;
}

// Mide el overflow horizontal y, si lo hay, identifica los elementos más anchos que el
// viewport para que el reporte diga QUÉ se desborda, no solo cuánto.
async function medirOverflow(page) {
  return page.evaluate(() => {
    const ancho = window.innerWidth;
    // Se mide lo que el usuario sufre de verdad: cuánto se puede desplazar la página hacia el
    // costado. scrollWidth solo puede dar falsos positivos (drawers cerrados fuera de pantalla
    // cuando el body tiene overflow-x: hidden y la página en realidad no se mueve).
    const y = window.scrollY;
    window.scrollTo(100000, y);
    const overflow = Math.max(window.scrollX, document.scrollingElement.scrollLeft);
    window.scrollTo(0, y);
    const culpables = [];
    if (overflow > 0) {
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Elementos totalmente fuera de pantalla (drawers cerrados) no son el desborde visible.
        if (r.right > ancho + 4 && r.left < ancho) {
          // Si un ancestro recorta el contenido (overflow hidden/auto), no desborda la página.
          let recortado = false;
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (/(hidden|auto|scroll|clip)/.test(cs.overflowX)) { recortado = true; break; }
          }
          if (recortado) continue;
          const id = el.id ? `#${el.id}` : '';
          const clase = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
          culpables.push(`${el.tagName.toLowerCase()}${id}${clase} (+${Math.round(r.right - ancho)}px)`);
          if (culpables.length >= 5) break;
        }
      }
    }
    return { overflow, culpables };
  });
}

async function chequearOverflow(page, site, lista, dispositivo) {
  const problemas = [];
  for (const { nombre, url } of lista) {
    await visitar(page, url);
    const { overflow, culpables } = await medirOverflow(page);
    if (overflow > TOLERANCIA_OVERFLOW_PX) {
      problemas.push(`${nombre}: ${overflow}px de overflow (${url})${culpables.length ? ` → ${culpables.join(', ')}` : ''}`);
    }
  }
  expect(problemas, `Overflow horizontal en ${dispositivo} en ${site.name}:\n${problemas.map((p) => `  • ${p}`).join('\n')}`).toHaveLength(0);
}

// Toma una "foto" de los elementos navegables visibles (en viewport y no ocultos por CSS) y
// los marca con un id, para después poder contar cuáles aparecieron NUEVOS al abrir el menú.
// Se compara por identidad y no por cantidad: al abrirse un drawer, tapa parte de la página
// y el total puede bajar aunque el menú haya abierto perfecto.
async function fotoNavegables(page) {
  return page.evaluate(() => {
    window.__qaNavId = window.__qaNavId || 0;
    // Incluye botones y <summary>: varios menús mobile muestran las categorías de primer
    // nivel como acordeones (botones), no como links (ej. swissgear.com).
    return [...document.querySelectorAll('a[href], button, summary, [role="menuitem"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight || r.right < 1 || r.left > window.innerWidth - 1) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
    }).map((el) => {
      if (!el.dataset.qaNav) el.dataset.qaNav = String(++window.__qaNavId);
      return el.dataset.qaNav;
    });
  });
}

// Señales de que el toggle cambió a "abierto", independientes de lo que se vea: sirve para
// themes cuyo drawer ya está en el DOM "visible" pero detrás del contenido hasta abrirse
// (confirmado en starsandhoney.com, donde el botón pasa de "MENU" a "CLOSE").
async function estadoToggle(toggle) {
  return toggle.evaluate((el) => ({
    expandido: el.getAttribute('aria-expanded') === 'true' || !!el.closest('details')?.open,
    texto: (el.innerText || '').trim(),
    claseBody: document.body.className,
  })).catch(() => null);
}


for (const site of sites) {
  const cfg = ajustesDe(site);

  test.describe(`Responsive mobile – ${site.name} (${site.baseUrl})`, () => {
    test.use(MOBILE);
    test.describe.configure({ timeout: 180000 });
    test.beforeEach(async ({ page }) => bloquearPopups(page));

    test(`${site.id}-RESP-01: Mobile - Colección y PDP sin overflow horizontal`, async ({ page }) => {
      test.skip(site.ecommerce === false, 'Sitio sin tienda: la Home mobile ya la cubre el test -07');
      await chequearOverflow(page, site, await paginas(page, site, { incluirHome: false }), 'mobile');
    });

    test(`${site.id}-RESP-03: Mobile - Menú hamburguesa abre y muestra la navegación`, async ({ page }) => {
      test.skip(cfg.menuMobile === false, 'Sitio sin menú hamburguesa (ver tests/config/responsive.js)');
      await visitar(page, site.baseUrl);

      const selectores = cfg.menuMobile?.toggle ? [cfg.menuMobile.toggle] : TOGGLES_MENU;
      let toggle = null;
      for (const selector of selectores) {
        const candidatos = page.locator(selector);
        const total = await candidatos.count();
        for (let i = 0; i < total && !toggle; i++) {
          const c = candidatos.nth(i);
          const caja = await c.boundingBox().catch(() => null);
          if (caja && caja.width > 0 && caja.y < 200 && await c.isVisible().catch(() => false) && await esToggleDeMenu(c)) {
            // Se fija el elemento concreto (ElementHandle), no el selector: en varios themes el
            // botón cambia de texto al abrir ("MENU" → "CLOSE" en starsandhoney.com) y un
            // Locator por texto dejaría de encontrarlo y se colgaría hasta el timeout.
            toggle = await c.elementHandle();
          }
        }
        if (toggle) break;
      }
      expect(toggle, `No se encontró el botón de menú mobile en el header de ${site.name}`).not.toBeNull();

      const antes = new Set(await fotoNavegables(page));
      const estadoAntes = await estadoToggle(toggle);
      const evaluar = async () => {
        const nuevos = (await fotoNavegables(page)).filter((id) => !antes.has(id)).length;
        const estado = await estadoToggle(toggle);
        const cambioEstado = !!estado && !!estadoAntes && (
          (estado.expandido && !estadoAntes.expandido) ||
          (estado.texto !== estadoAntes.texto && estadoAntes.texto !== '') ||
          estado.claseBody !== estadoAntes.claseBody
        );
        return { nuevos, cambioEstado, abierto: nuevos >= 3 || cambioEstado };
      };

      // Click vía JS (no Locator.click) a propósito: un popup de marketing tapando el header
      // no debe hacer fallar un test cuyo objetivo es el menú. Si el JS click no abre (algunos
      // themes escuchan pointer/touch), se intenta con un tap real.
      await toggle.evaluate((el) => el.click());
      await page.waitForTimeout(2000);
      let resultado = await evaluar();
      if (!resultado.abierto) {
        await toggle.tap({ timeout: 5000, force: true }).catch(() => {});
        await page.waitForTimeout(2000);
        resultado = await evaluar();
      }
      expect(
        resultado.abierto,
        `El menú mobile de ${site.name} no se abrió al tocar la hamburguesa (elementos nuevos visibles: ${resultado.nuevos}, sin cambio de estado del botón)`,
      ).toBe(true);
    });

    test(`${site.id}-RESP-04: Mobile - PDP con título, imagen, precio y botón de compra visibles`, async ({ page }) => {
      test.skip(site.ecommerce === false, 'Sitio sin tienda');
      const url = await urlPdp(page, site);
      expect(url, `No se pudo resolver una PDP para ${site.name}`).toBeTruthy();
      await visitar(page, url);

      // Algunos themes duplican el título (un h1 para desktop oculto en mobile y otro visible,
      // ej. lussocloud.com): se busca el primero VISIBLE, con fallback a clases de título.
      const titulos = page.locator('h1, [class*="product" i][class*="title" i]');
      await expect.poll(async () => {
        for (let i = 0; i < await titulos.count(); i++) if (await titulos.nth(i).isVisible().catch(() => false)) return true;
        return false;
      }, { message: `Título del producto no visible en mobile en ${site.name} (${url})`, timeout: 10000 }).toBe(true);

      const imagenOk = await page.evaluate(() => [...document.querySelectorAll('main img, [id*="MainContent" i] img, img')].some((img) => {
        const r = img.getBoundingClientRect();
        return img.complete && img.naturalWidth > 0 && r.width >= 150 && r.top < window.innerHeight * 1.5;
      }));
      expect(imagenOk, `No se ve la imagen principal del producto en mobile en ${site.name} (${url})`).toBe(true);

      if (cfg.precioVisible !== false) {
        const texto = await page.locator('main, #MainContent, body').first().innerText().catch(() => '');
        const importe = /(US\$|CA\$|C\$|AR\$|CLP|ARS|\$|€|£)\s?\d{1,3}([.,\s]?\d{3})*([.,]\d{1,2})?/;
        expect(importe.test(texto), `No se ve el precio en la PDP mobile de ${site.name} (${url})`).toBe(true);
      }

      if (cfg.compraVisible === false) return;
      // Se reutiliza el selector de "agregar al carrito" verificado en vivo en sites.js.
      // No se clickea: solo se valida que el cliente pueda verlo y tocarlo en mobile.
      const selectorCompra = site.pdp?.addToCartSelector || 'form[action*="/cart/add"] [type="submit"], button[name="add"]';
      const botones = page.locator(selectorCompra);
      let boton = null;
      let botonFuera = null;
      for (let i = 0; i < await botones.count() && !boton; i++) {
        const b = botones.nth(i);
        await b.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        if (!await b.isVisible().catch(() => false)) continue;
        // Varios themes tienen más de un botón (el del formulario y uno sticky/duplicado):
        // se toma el primero que realmente quede dentro del ancho de la pantalla.
        const c = await b.boundingBox().catch(() => null);
        if (c && c.x >= -1 && c.x + c.width <= page.viewportSize().width + 1) boton = b;
        else if (!botonFuera) botonFuera = c;
      }
      expect(!boton && botonFuera, `El botón de compra de ${site.name} se sale de la pantalla en mobile`).toBeFalsy();
      if (!boton) {
        // Varios themes ocultan el botón de compra hasta que se elige una variante (talle,
        // color), confirmado en lussocloud.com. En ese caso lo que el cliente necesita ver en
        // mobile es el selector de variantes.
        const selectorVariantes = [
          site.pdp?.variantInputSelector && `${site.pdp.variantInputSelector} + label`,
          site.pdp?.variantInputSelector,
          'variant-radios label, variant-selects select, fieldset input[type="radio"] + label',
          'select[name*="option" i], select[name="id"], [class*="swatch" i] label, [class*="variant" i] button',
        ].filter(Boolean).join(', ');
        const variantes = page.locator(selectorVariantes);
        let hayVariantes = false;
        for (let i = 0; i < Math.min(await variantes.count(), 20) && !hayVariantes; i++) {
          await variantes.nth(i).scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
          hayVariantes = await variantes.nth(i).isVisible().catch(() => false);
        }
        expect(hayVariantes, `Ni el botón de compra ni el selector de variantes se ven en la PDP mobile de ${site.name} (${url})`).toBe(true);
        return;
      }
      const caja = await boton.boundingBox();
      expect(caja.height, `El botón de compra de ${site.name} es demasiado chico para tocar en mobile (${Math.round(caja.height)}px)`).toBeGreaterThanOrEqual(24);
    });

    test(`${site.id}-RESP-05: Mobile - Meta viewport correcto`, async ({ page }) => {
      await visitar(page, site.baseUrl);
      const viewport = await page.locator('meta[name="viewport"]').first().getAttribute('content').catch(() => null);
      expect(viewport, `${site.name} no tiene <meta name="viewport"> (el sitio se vería como desktop achicado en mobile)`).toBeTruthy();
      expect(viewport, `El meta viewport de ${site.name} no usa width=device-width`).toMatch(/width\s*=\s*device-width/);
    });

    test(`${site.id}-RESP-06: Mobile - Imágenes del primer pantallazo cargan`, async ({ page }) => {
      await visitar(page, site.baseUrl);
      const rotas = await page.evaluate(() => [...document.querySelectorAll('img')].filter((img) => {
        const r = img.getBoundingClientRect();
        const enPantalla = r.width > 20 && r.height > 20 && r.top < window.innerHeight && r.bottom > 0;
        const cs = getComputedStyle(img);
        return enPantalla && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && img.complete && img.naturalWidth === 0;
      }).map((img) => img.currentSrc || img.src || '(sin src)'));
      expect(rotas, `Imágenes rotas en el primer pantallazo mobile de ${site.name}:\n${rotas.slice(0, 10).map((s) => `  • ${s}`).join('\n')}`).toHaveLength(0);
    });
  });

  test.describe(`Responsive tablet – ${site.name} (${site.baseUrl})`, () => {
    test.use(TABLET);
    test.describe.configure({ timeout: 180000 });
    test.beforeEach(async ({ page }) => bloquearPopups(page));

    test(`${site.id}-RESP-02: Tablet - Home, Colección y PDP sin overflow horizontal`, async ({ page }) => {
      await chequearOverflow(page, site, await paginas(page, site, { incluirHome: true }), 'tablet');
    });
  });
}
