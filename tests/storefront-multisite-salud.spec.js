// Suite de SALUD TÉCNICA para todas las tiendas de tests/config/sites.js.
//
// Complementa (no reemplaza) a storefront-multisite.spec.js: acá no se hacen flujos de
// compra, solo se navega en modo lectura por Home, Colección y PDP buscando problemas que
// el cliente final sufre pero que ningún test funcional detecta:
//   SALUD-01  Excepciones JS no capturadas del propio sitio
//   SALUD-02  Recursos propios (imágenes, scripts, CSS, fuentes) que responden 4xx/5xx
//   SALUD-03  Links internos rotos en header y footer
//   SALUD-04  Contenido roto del theme (Liquid error, translation missing, NaN, undefined)
//   SALUD-05  Tracking presente (GA4 / GTM / Meta Pixel)
//   SALUD-06  Página 404 funcional (devuelve 404 y mantiene la navegación)
//   SALUD-07  Precio visible y válido en la PDP
//
// Son tiendas productivas de clientes: esta suite NUNCA agrega al carrito, envía
// formularios ni crea pedidos. Solo navegación y requests GET.
//
// Los títulos usan el formato `${site.id}-SALUD-NN` para que el workflow pueda filtrar por
// sitio con --grep, igual que la suite funcional.

const { test, expect } = require('@playwright/test');
const sites = require('./config/sites');
const ajustes = require('./config/salud');

test.use({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 720 },
});

// Mismos vendors de popups que bloquea la suite funcional: acá no molestan clicks (no hay),
// pero evitan ruido de errores/recursos que no son del sitio.
const DOMINIOS_POPUP_BLOQUEADOS = [/alia-prod\.com/, /attn\.tv/];

// Tracking: se detecta por las requests de red (cubre también los Web Pixels de Shopify,
// que corren dentro de iframes sandbox y no exponen gtag/fbq en window).
const PATRONES_TRACKING = [
  // Se buscan rutas (no solo dominios) para cubrir también GTM server-side en dominio propio.
  { nombre: 'GA4', patron: /\/g\/collect\?|google-analytics\.com\/(g\/)?collect|\/gtag\/js\?id=/ },
  { nombre: 'GTM', patron: /\/gtm\.js\?id=/ },
  { nombre: 'Meta Pixel', patron: /fbevents\.js|facebook\.com\/tr[/?]/ },
  // Web Pixels de Shopify instalados por apps (canal Google, canal Facebook, etc.) o custom
  // pixels del merchant. Sus requests a GA/Meta salen desde un worker sandbox que Playwright
  // no ve (confirmado en tienda.adepac.cl), así que se toma su presencia como señal.
  // "web-pixel-shopify-app-pixel" NO cuenta: Shopify lo carga siempre en todas las tiendas.
  { nombre: 'Shopify Web Pixel', patron: /\/web-pixel-\d+@|web-pixel-shopify-custom-pixel@/ },
];

// Textos que delatan un theme roto. Se buscan en el texto visible del <body>.
const TEXTOS_ROTOS = [
  /Liquid error/i,
  /Liquid syntax error/i,
  /translation missing/i,
  /\bNaN\b/,
  /\$\s?undefined|undefined\s?\$/,
  /\[object Object\]/,
];

// Excepciones que aparecen de forma intermitente en muchas tiendas Shopify y no son del
// theme: snippets inline de apps consultan window.Shopify.customerPrivacy antes de que
// Shopify termine de cargarlo (visto en Marmot AR, Ena Sport y Ailu y Andi, no en todas las
// corridas). Alertarían al azar sin ser accionables para el sitio.
const ERRORES_JS_GLOBALES_IGNORADOS = [/reading 'marketingAllowed'/];

const TIPOS_RECURSO = new Set(['document', 'script', 'stylesheet', 'image', 'font']);

function ajustesDe(site) {
  return ajustes[site.id] || {};
}

function hostsPropios(site) {
  const host = new URL(site.baseUrl).hostname.replace(/^www\./, '');
  return [host, 'cdn.shopify.com'];
}

function esPropia(url, site) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return hostsPropios(site).some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function coincide(texto, patrones = []) {
  return patrones.some((p) => p.test(texto));
}

// Instrumenta la página: junta excepciones JS, respuestas fallidas y requests de tracking
// durante toda la vida del test.
function instrumentar(page, site) {
  const registro = { erroresJs: [], recursosFallidos: [], tracking: new Set() };

  page.on('pageerror', (error) => {
    registro.erroresJs.push({ url: page.url(), mensaje: error.message, stack: error.stack || '' });
  });

  page.on('response', (response) => {
    const request = response.request();
    const url = response.url();
    if (response.status() < 400) return;
    if (!TIPOS_RECURSO.has(request.resourceType())) return;
    if (!esPropia(url, site)) return;
    registro.recursosFallidos.push({ pagina: page.url(), url, status: response.status(), tipo: request.resourceType() });
  });

  page.context().on('request', (request) => {
    for (const { nombre, patron } of PATRONES_TRACKING) {
      if (patron.test(request.url())) registro.tracking.add(nombre);
    }
  });

  return registro;
}

async function bloquearPopups(page) {
  await page.route('**/*', (route) => {
    if (DOMINIOS_POPUP_BLOQUEADOS.some((p) => p.test(route.request().url()))) return route.abort();
    return route.continue();
  });
}

async function visitar(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Dejar que carguen imágenes lazy del primer viewport, apps y pixels.
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return response;
}

// Resuelve la URL de una PDP real: la configurada, o el primer producto de la colección, o
// el primer resultado de búsqueda.
async function urlPdp(page, site) {
  if (site.pdp?.path) return new URL(site.pdp.path, site.baseUrl).href;
  for (const path of [site.collection?.path, site.search?.term && `/search?q=${encodeURIComponent(site.search.term)}&type=product`]) {
    if (!path) continue;
    await visitar(page, new URL(path, site.baseUrl).href);
    const href = await page.locator('main a[href*="/products/"], a[href*="/products/"]').first().getAttribute('href').catch(() => null);
    if (href) return new URL(href, site.baseUrl).href;
  }
  return null;
}

// Páginas a recorrer según el tipo de sitio.
async function paginasDelSitio(page, site) {
  const paginas = [{ nombre: 'Home', url: site.baseUrl }];
  if (site.ecommerce === false) return paginas;
  if (site.collection?.path) paginas.push({ nombre: 'Colección', url: new URL(site.collection.path, site.baseUrl).href });
  const pdp = await urlPdp(page, site);
  if (pdp) paginas.push({ nombre: 'PDP', url: pdp });
  return paginas;
}

async function aceptarCookies(page, site) {
  if (!site.cookieBannerAcceptSelector) return;
  const boton = page.locator(site.cookieBannerAcceptSelector).first();
  if (await boton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await boton.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

function formatearLista(items, max = 15) {
  const lineas = items.slice(0, max).map((i) => `  • ${i}`);
  if (items.length > max) lineas.push(`  … y ${items.length - max} más`);
  return lineas.join('\n');
}

for (const site of sites) {
  const cfg = ajustesDe(site);

  test.describe(`Salud técnica – ${site.name} (${site.baseUrl})`, () => {
    // Los chequeos son independientes: si uno falla, los demás igual corren y reportan.
    // Timeout amplio: se recorren hasta 3 páginas completas y algunos sitios son pesados.
    test.describe.configure({ timeout: 180000 });

    test.beforeEach(async ({ page }) => {
      await bloquearPopups(page);
    });

    test(`${site.id}-SALUD-01: Sin excepciones JS del propio sitio`, async ({ page }) => {
      const registro = instrumentar(page, site);
      const paginas = await paginasDelSitio(page, site);
      registro.erroresJs.length = 0; // descartar lo ocurrido resolviendo la PDP
      for (const { url } of paginas) await visitar(page, url);

      // Solo cuentan las excepciones cuyo stack apunta a código servido por el propio sitio
      // (theme en cdn.shopify.com o el dominio de la tienda). Los errores de apps de terceros
      // quedan fuera: no son accionables para el equipo del sitio y generan ruido.
      const propios = registro.erroresJs.filter((e) => {
        if (coincide(e.mensaje, ERRORES_JS_GLOBALES_IGNORADOS)) return false;
        if (coincide(e.mensaje, cfg.ignorarErroresJs)) return false;
        const urlsStack = e.stack.match(/https?:\/\/[^\s)]+/g) || [];
        if (urlsStack.length === 0) return false;
        const origen = urlsStack[0].replace(/:\d+:\d+$/, '');
        // Solo archivos .js del theme/sitio. Los scripts inline del HTML se excluyen: en su
        // gran mayoría son snippets que inyectan apps (tracking, reviews, consentimiento) y
        // fallaban según la geolocalización del runner sin impacto visible (confirmado en
        // comfrt.com: error solo desde GitHub Actions, en un script inline minificado).
        return esPropia(origen, site) && /\.js(\?|$)/.test(origen) && !/\/extensions\//.test(origen);
      });
      const unicos = [...new Map(propios.map((e) => [e.mensaje, e])).values()];
      expect(
        unicos,
        `Excepciones JS del theme en ${site.name}:\n${formatearLista(unicos.map((e) => `${e.mensaje} (en ${e.url})`))}`,
      ).toHaveLength(0);
    });

    test(`${site.id}-SALUD-02: Recursos propios sin errores 4xx/5xx`, async ({ page }) => {
      const registro = instrumentar(page, site);
      const paginas = await paginasDelSitio(page, site);
      registro.recursosFallidos.length = 0;
      for (const { url } of paginas) await visitar(page, url);

      const fallidos = registro.recursosFallidos.filter(
        (r) => !coincide(r.url, cfg.ignorarRecursos) && r.tipo !== 'document',
      );
      const unicos = [...new Map(fallidos.map((r) => [r.url, r])).values()];
      expect(
        unicos,
        `Recursos rotos en ${site.name}:\n${formatearLista(unicos.map((r) => `${r.status} ${r.tipo} ${r.url}`))}`,
      ).toHaveLength(0);
    });

    test(`${site.id}-SALUD-03: Links internos de header y footer sin 404/5xx`, async ({ page }) => {
      await visitar(page, site.baseUrl);
      const origen = new URL(site.baseUrl).origin;
      const hrefs = await page.$$eval('header a[href], footer a[href]', (links) => links.map((a) => a.href));
      const internos = [...new Set(
        hrefs
          .filter((h) => h.startsWith('http'))
          .map((h) => h.split('#')[0])
          .filter((h) => new URL(h).hostname.replace(/^www\./, '') === new URL(origen).hostname.replace(/^www\./, ''))
          .filter((h) => !/\/(cart|checkout|account)(\/|$|\?)/.test(new URL(h).pathname))
          .filter((h) => !coincide(h, cfg.ignorarLinks)),
      )].slice(0, 80);

      expect(internos.length, `No se encontraron links internos en header/footer de ${site.name}`).toBeGreaterThan(0);

      // GET livianos en lotes de 5, sin navegar: comparten cookies con la página.
      const rotos = [];
      for (let i = 0; i < internos.length; i += 5) {
        await Promise.all(internos.slice(i, i + 5).map(async (url) => {
          let status = 0;
          for (let intento = 0; intento < 2 && (status === 0 || status >= 500 || status === 429); intento++) {
            if (intento > 0) await page.waitForTimeout(1500);
            status = await page.request.get(url, { timeout: 20000, maxRedirects: 5 }).then((r) => r.status()).catch(() => 0);
          }
          // 403/429 suelen ser protección anti-bot (Cloudflare), no links rotos.
          if (status === 0 || status === 404 || status === 410 || status >= 500) rotos.push(`${status || 'sin respuesta'} ${url}`);
        }));
      }
      expect(rotos, `Links rotos en header/footer de ${site.name}:\n${formatearLista(rotos)}`).toHaveLength(0);
    });

    test(`${site.id}-SALUD-04: Sin contenido roto del theme (Liquid error, NaN, translation missing)`, async ({ page }) => {
      const paginas = await paginasDelSitio(page, site);
      const hallazgos = [];
      for (const { nombre, url } of paginas) {
        await visitar(page, url);
        const texto = await page.locator('body').innerText().catch(() => '');
        for (const patron of TEXTOS_ROTOS) {
          const m = texto.match(patron);
          if (m) {
            const i = texto.indexOf(m[0]);
            hallazgos.push(`${nombre}: "${texto.slice(Math.max(0, i - 40), i + 60).replace(/\s+/g, ' ').trim()}" (${url})`);
          }
        }
      }
      expect(hallazgos, `Contenido roto del theme en ${site.name}:\n${formatearLista(hallazgos)}`).toHaveLength(0);
    });

    test(`${site.id}-SALUD-05: Tracking presente (GA4 / GTM / Meta Pixel)`, async ({ page }) => {
      test.skip(cfg.tracking === false, 'Sitio sin tracking detectable (ver tests/config/salud.js)');
      const registro = instrumentar(page, site);
      await visitar(page, site.baseUrl);
      await aceptarCookies(page, site);
      // Algunos sitios cargan los pixels con delay o recién al primer scroll.
      await page.mouse.wheel(0, 800).catch(() => {});
      await page.waitForTimeout(4000);
      const enWindow = await page.evaluate(() => [
        Array.isArray(window.dataLayer) && window.dataLayer.length > 0 && 'dataLayer',
        typeof window.gtag === 'function' && 'gtag',
        typeof window.fbq === 'function' && 'fbq',
      ].filter(Boolean)).catch(() => []);
      enWindow.forEach((n) => registro.tracking.add(n));
      expect(
        registro.tracking.size,
        `No se detectó ninguna request de GA4, GTM ni Meta Pixel en la Home de ${site.name}`,
      ).toBeGreaterThan(0);
    });

    test(`${site.id}-SALUD-06: Página 404 funcional`, async ({ page }) => {
      const url = new URL('/pages/qa-reval-pagina-inexistente-404', site.baseUrl).href;
      const response = await visitar(page, url);
      expect(response?.status(), `La URL inexistente ${url} no devolvió 404`).toBe(404);
      const textoBody = (await page.locator('body').innerText().catch(() => '')).trim();
      expect(textoBody.length, `La página 404 de ${site.name} está vacía`).toBeGreaterThan(50);
      const linksNavegacion = await page.locator('header a[href], nav a[href], a[href="/"]').count();
      expect(linksNavegacion, `La página 404 de ${site.name} no tiene navegación para volver a la tienda`).toBeGreaterThan(0);
    });

    test(`${site.id}-SALUD-07: Precio visible y válido en la PDP`, async ({ page }) => {
      test.skip(site.ecommerce === false, 'Sitio sin tienda');
      const url = await urlPdp(page, site);
      expect(url, `No se pudo resolver una PDP para ${site.name}`).toBeTruthy();

      // Dato de Shopify (fuente de verdad): /products/<handle>.js
      const handle = new URL(url).pathname.split('/products/')[1]?.split('/')[0];
      const json = await page.request.get(new URL(`/products/${handle}.js`, site.baseUrl).href, { timeout: 20000 })
        .then((r) => (r.ok() ? r.json() : null)).catch(() => null);
      if (json) {
        expect(json.price, `El producto ${handle} de ${site.name} tiene precio 0 o inválido en Shopify`).toBeGreaterThan(0);
      }

      // Lo que ve el cliente: un importe con símbolo de moneda en el contenido principal.
      // Tiendas B2B que ocultan precios sin login marcan precioVisible: false en salud.js.
      if (cfg.precioVisible === false) return;
      await visitar(page, url);
      const texto = await page.locator('main, #MainContent, body').first().innerText().catch(() => '');
      const importe = /(US\$|CA\$|C\$|AR\$|CLP|ARS|\$|€|£)\s?\d{1,3}([.,\s]?\d{3})*([.,]\d{1,2})?/;
      // Se compara un booleano (no el texto) para que el reporte no vuelque la página entera.
      // No se busca "$0.00" en el texto: el subtotal del carrito vacío lo muestra legítimamente;
      // el precio en cero se valida arriba contra el dato de Shopify.
      expect(importe.test(texto), `No se ve ningún precio con moneda en la PDP de ${site.name} (${url})`).toBe(true);
    });
  });
}
