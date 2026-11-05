// Web institucional de Latech (latechfactory.com): que todo ande, sin enviar formularios.
//
// Complementa a lo que ya corre para LATECH_FACTORY en las suites multisite (home, mobile,
// imágenes, salud técnica, responsive y multi-resolución) con lo propio de un sitio
// institucional: todas las páginas del sitemap, el menú, casos, blog, el formulario de
// contacto y el menú mobile. Corre en .github/workflows/playwright-resoluciones.yml junto con
// el resto de las pruebas de LATECH_FACTORY (los títulos empiezan con "LATECH_FACTORY-").
//
// Regla: el formulario de contacto NUNCA se completa ni se envía; solo se verifica que esté
// visible y habilitado.

const { test, expect, devices } = require('@playwright/test');

const BASE = 'https://latechfactory.com';
const SECCIONES = [
  ['Cases', '/cases'],
  ['About Us', '/about'],
  ['Careers', '/careers'],
  ['Blog', '/blog'],
  ['Contact', '/contact'],
];

// Sin hits de analítica desde las pruebas (para no ensuciar las métricas del sitio).
const ANALITICA = /(google-analytics\.com|analytics\.google\.com)\/(g\/)?collect|googleadservices\.com\/pagead\/conversion|facebook\.com\/tr|static\.hotjar\.com|aplo-evnt\.com|doubleclick\.net/;

test.beforeEach(async ({ page }) => {
  await page.route(ANALITICA, (route) => route.abort());
});

async function irA(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
}

async function validarPagina(page, contexto) {
  const titulo = await page.title();
  expect(titulo, `${contexto}: bloqueo anti-bots`).not.toContain('Just a moment');
  expect(titulo, `${contexto} cayó en una página "no encontrada": ${page.url()}`).not.toMatch(/(^|\W)404(\W|$)|not found|no encontrada/i);
  const texto = await page.locator('body').innerText({ timeout: 15000 });
  expect(texto, `${contexto}: error del servidor`).not.toMatch(/Application error|Internal Server Error|Error 500/i);
  expect(texto.trim().length, `${contexto}: la página cargó vacía (${page.url()})`).toBeGreaterThan(200);
}

// Click normal y, si una animación o una capa del sitio no lo deja (ej. el botón "Contact" del
// header se mueve todo el tiempo y nunca queda "estable"), click del propio link vía JS: el
// router de Next.js navega igual que con un click real.
async function clickNavegando(locator) {
  await locator.click({ timeout: 8000 }).catch(() => locator.evaluate((el) => el.click()));
}

// El link que realmente está al frente en pantalla (no tapado por un menú o una capa).
async function alFrente(locator) {
  const total = await locator.count();
  for (let i = 0; i < total; i++) {
    const ok = await locator.nth(i).evaluate((a) => {
      const r = a.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > window.innerHeight) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (a === hit || a.contains(hit));
    }).catch(() => false);
    if (ok) return locator.nth(i);
  }
  return null;
}

async function primerVisible(locator) {
  const total = await locator.count();
  for (let i = 0; i < total; i++) if (await locator.nth(i).isVisible().catch(() => false)) return locator.nth(i);
  return null;
}

test.describe('Latech Factory – web institucional (latechfactory.com)', () => {
  test.use({ viewport: { width: 1366, height: 768 } });
  test.describe.configure({ timeout: 180000 });

  test('LATECH_FACTORY-WEB-01: Todas las páginas del sitemap responden', async ({ request }) => {
    const xml = await (await request.get(`${BASE}/sitemap.xml`, { timeout: 20000 })).text();
    const urls = [...new Set([...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]))];
    expect(urls.length, 'El sitemap.xml no lista páginas').toBeGreaterThan(5);

    const rotas = [];
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(async (url) => {
        let status = 0;
        for (let intento = 0; intento < 2 && (status === 0 || status >= 500 || status === 429); intento++) {
          status = await request.get(url, { timeout: 20000, maxRedirects: 5 }).then((r) => r.status()).catch(() => 0);
        }
        if (status === 0 || status === 404 || status === 410 || status >= 500) rotas.push(`${status || 'sin respuesta'} ${url}`);
      }));
    }
    expect(rotas, `Páginas del sitemap que no cargan (${rotas.length} de ${urls.length}):\n${rotas.map((r) => `  • ${r}`).join('\n')}`).toHaveLength(0);
  });

  test('LATECH_FACTORY-WEB-02: El menú lleva a cada sección', async ({ page }) => {
    for (const [nombre, path] of SECCIONES) {
      await irA(page, BASE);
      const link = await primerVisible(page.locator(`a[href="${path}"]`));
      expect(link, `No se ve el link "${nombre}" en el menú de la home`).not.toBeNull();
      await clickNavegando(link);
      await page.waitForURL((u) => u.pathname.startsWith(path), { timeout: 20000 });
      await validarPagina(page, `Sección ${nombre}`);
    }
    // Services no es un link directo del menú (se despliega): se valida la página igual.
    await irA(page, `${BASE}/services`);
    await validarPagina(page, 'Sección Services');
  });

  test('LATECH_FACTORY-WEB-03: Casos de éxito y blog abren', async ({ page }) => {
    for (const [nombre, listado] of [['Caso de éxito', '/cases'], ['Artículo del blog', '/blog']]) {
      await irA(page, `${BASE}${listado}`);
      await validarPagina(page, `Listado ${listado}`);
      const item = await primerVisible(page.locator(`a[href^="${listado}/"]`));
      expect(item, `El listado ${listado} no muestra ningún ${nombre.toLowerCase()}`).not.toBeNull();
      const destino = await item.getAttribute('href');
      await item.scrollIntoViewIfNeeded().catch(() => {});
      await clickNavegando(item);
      await page.waitForURL((u) => u.pathname === destino, { timeout: 20000 }).catch(() => {});
      expect(new URL(page.url()).pathname, `${nombre}: el click no abrió ${destino}`).toBe(destino);
      await validarPagina(page, nombre);
      const imagenesRotas = await page.evaluate(() => [...document.querySelectorAll('img')]
        .filter((img) => img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().width > 20)
        .map((img) => img.currentSrc || img.src));
      expect(imagenesRotas, `${nombre} con imágenes rotas: ${imagenesRotas.join(', ')}`).toHaveLength(0);
    }
  });

  test('LATECH_FACTORY-WEB-04: Formulario de contacto visible y habilitado (sin enviar)', async ({ page }) => {
    await irA(page, `${BASE}/contact`);
    await validarPagina(page, 'Contacto');
    for (const [campo, selector] of [
      ['nombre', 'input[name="name"]'],
      ['email', 'input[name="email"]'],
      ['mensaje', 'textarea[name="message"]'],
    ]) {
      const el = page.locator(selector).first();
      await el.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
      await expect(el, `El campo ${campo} del formulario de contacto no se ve`).toBeVisible({ timeout: 15000 });
      await expect(el, `El campo ${campo} del formulario de contacto está deshabilitado`).toBeEnabled();
    }
    // Solo se verifica que exista el botón "Send" y que no esté deshabilitado. NUNCA se clickea.
    const enviar = page.getByRole('button', { name: /^\s*(send|enviar)\s*$/i }).first();
    await expect(enviar, 'No está el botón "Send" del formulario de contacto').toBeAttached({ timeout: 10000 });
    expect(await enviar.isDisabled(), 'El botón "Send" del formulario de contacto está deshabilitado').toBe(false);
  });
});

test.describe('Latech Factory – web institucional en celular', () => {
  const { defaultBrowserType: _d, ...IPHONE } = devices['iPhone 13'];
  test.use(IPHONE);
  test.describe.configure({ timeout: 120000 });

  test('LATECH_FACTORY-WEB-05: Celular - el menú abre y lleva a una sección', async ({ page }) => {
    await irA(page, BASE);
    const toggle = page.locator('div:has(> svg > use[href*="menu-mobile"])').first();
    await expect(toggle, 'No se ve el botón del menú en celular').toBeVisible({ timeout: 15000 });
    await clickNavegando(toggle);
    // El menú de celular es un carrusel de tarjetas (01 Home, 02 Services...) con un botón
    // "Contact Us" debajo. Se valida que abra y que ese botón lleve a la sección.
    await expect.poll(async () => !!(await alFrente(page.getByText('Home', { exact: true }))), { message: 'El menú de celular no se abrió (no aparece la tarjeta "Home")', timeout: 10000 }).toBe(true);
    const contacto = page.getByRole('link', { name: /contact us/i });
    await expect.poll(async () => !!(await alFrente(contacto)), { message: 'El menú de celular no se abrió (no aparece "Contact Us" al frente)', timeout: 10000 }).toBe(true);
    await clickNavegando(await alFrente(contacto));
    await page.waitForURL((u) => u.pathname.startsWith('/contact'), { timeout: 20000 });
    await validarPagina(page, 'Contacto desde el menú de celular');
  });
});
