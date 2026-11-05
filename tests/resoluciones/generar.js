// Genera la suite multi-resolución a partir de los specs que ya corren en producción.
//
//   node tests/resoluciones/generar.js        → escribe tests/generados/*.spec.js
//   RESOLUCIONES_LOTE=2 node tests/resoluciones/generar.js → solo las resoluciones del lote 2
//   npx playwright test tests/generados --grep "SWISSGEAR_COM-"
//
// Por cada resolución de tests/config/resoluciones.js crea una copia de
// storefront-multisite.spec.js (y de storefront-multisite-responsive.spec.js para celulares y
// tablets) con tres cambios: el tamaño de pantalla / dispositivo emulado, el nombre de la
// resolución al final del título de cada test, y solo los tests que aplican a esa resolución.
// Los specs originales no se modifican: cualquier arreglo que se les haga llega solo a todas
// las resoluciones la próxima vez que se genere.
//
// Además, en las copias se bloquean los envíos de analítica (GA4, Meta, TikTok, Shopify
// Analytics...): son tiendas de clientes y multiplicar las visitas y "agregar al carrito" de
// prueba por cada resolución ensuciaría sus métricas. Los scripts cargan igual (no cambia el
// comportamiento del sitio), solo no llega el "hit" a la plataforma.
//
// Si un spec original cambia de forma que alguna transformación deja de aplicar, el script
// falla con un mensaje claro en vez de generar una copia que en silencio no cambia nada.

const fs = require('fs');
const path = require('path');
const { resoluciones, ajustes } = require('../config/resoluciones');

const RAIZ = path.resolve(__dirname, '..');
const SALIDA = path.join(RAIZ, 'generados');

const ANALITICA =
  /(google-analytics\.com|analytics\.google\.com)\/(g\/)?collect|googleadservices\.com\/pagead\/conversion|facebook\.com\/tr|\/\.well-known\/shopify\/monorail|monorail-edge\.shopifysvc\.com|analytics\.tiktok\.com\/api|ct\.pinterest\.com|bat\.bing\.com\/action|px\.ads\.linkedin\.com/;

function reemplazar(texto, patron, reemplazo, descripcion, archivo) {
  let cantidad = 0;
  const nuevo = texto.replace(patron, (...args) => {
    cantidad++;
    return typeof reemplazo === 'function' ? reemplazo(...args) : reemplazo;
  });
  if (!cantidad) {
    throw new Error(`generar.js: no se pudo aplicar "${descripcion}" en ${archivo}. ¿Cambió el spec original? Revisar tests/resoluciones/generar.js.`);
  }
  return nuevo;
}

function cabecera(res) {
  return `
// ARCHIVO GENERADO por tests/resoluciones/generar.js — no editar (se regenera en cada corrida).
// Resolución: ${res.nombre}
const __RES = ${JSON.stringify({ id: res.id, grupo: res.grupo, nombre: res.nombre })};
const __AJUSTES = ${JSON.stringify(ajustes)};
// Devuelve test() si el test aplica a esta resolución y sitio; si no, una función vacía para
// que ni siquiera se registre (no aparece como "skipped" en los reportes).
const __testPara = (site, numero, incluidos) => {
  const omitir = __AJUSTES[site.id]?.omitir || {};
  const fuera = [...(omitir[__RES.id] || []), ...(omitir[__RES.grupo] || [])];
  return incluidos.includes(numero) && !fuera.includes(numero) ? test : () => {};
};
`;
}

const BLOQUEO_ANALITICA = `

// Agregado por generar.js: no mandar hits de analítica de las corridas multi-resolución, y al
// menos 2 minutos por test (la emulación de celulares y varias resoluciones en paralelo son más
// lentas que la corrida horaria a 1280×720; los tests que ya pedían más tiempo lo conservan).
test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(Math.max(testInfo.timeout, 120000));
  await page.route(${ANALITICA.toString()}, (route) => route.abort());
});
`;

function usoDispositivo(res) {
  if (res.device) {
    return `const { defaultBrowserType: __dbt, ...__DISPOSITIVO } = devices[${JSON.stringify(res.device)}];\ntest.use(__DISPOSITIVO);`;
  }
  return null;
}

function generarFuncional(res) {
  const archivo = 'storefront-multisite.spec.js';
  let src = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');

  src = reemplazar(
    src,
    "const { test, expect } = require('@playwright/test');",
    () => `const { test, expect, devices } = require('@playwright/test');${cabecera(res)}`,
    'import de @playwright/test',
    archivo
  );
  src = reemplazar(src, /require\('\.\//g, "require('../", 'rutas relativas', archivo);

  if (res.device) {
    src = reemplazar(
      src,
      /test\.use\(\{\s*userAgent:[^\n]*\n\s*viewport: \{ width: 1280, height: 720 \}\s*\}\);/,
      () => usoDispositivo(res),
      'test.use con viewport 1280x720',
      archivo
    );
  } else {
    src = reemplazar(
      src,
      /(test\.use\(\{\s*userAgent:[^\n]*\n\s*)viewport: \{ width: 1280, height: 720 \}/,
      (_, antes) => `${antes}viewport: ${JSON.stringify(res.viewport).replace(/"/g, '')}`,
      'viewport 1280x720',
      archivo
    );
  }

  src = reemplazar(
    src,
    /\btest\(`\$\{site\.id\}-(\d{2}): ([^`]*)`/g,
    (_, n, titulo) => `__testPara(site, '${n}', ${JSON.stringify(res.funcional)})(\`\${site.id}-${n}: ${titulo} [${res.nombre}]\``,
    'títulos de los tests',
    archivo
  );
  src = reemplazar(src, /route\.continue\(\)/g, 'route.fallback()', 'route.continue → fallback', archivo);
  return src + BLOQUEO_ANALITICA;
}

function generarResponsive(res) {
  const archivo = 'storefront-multisite-responsive.spec.js';
  let src = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');

  src = reemplazar(
    src,
    "const { test, expect, devices } = require('@playwright/test');",
    () => `const { test, expect, devices } = require('@playwright/test');${cabecera(res)}`,
    'import de @playwright/test',
    archivo
  );
  src = reemplazar(src, /require\('\.\//g, "require('../", 'rutas relativas', archivo);
  src = reemplazar(src, "devices['iPhone 13']", `devices[${JSON.stringify(res.device)}]`, 'dispositivo mobile', archivo);
  src = reemplazar(
    src,
    /\btest\(`\$\{site\.id\}-(RESP-\d{2}): ([^`]*)`/g,
    (_, n, titulo) => `__testPara(site, '${n}', ${JSON.stringify(res.responsive)})(\`\${site.id}-${n}: ${titulo} [${res.nombre}]\``,
    'títulos de los tests',
    archivo
  );
  src = reemplazar(src, /route\.continue\(\)/g, 'route.fallback()', 'route.continue → fallback', archivo);
  return src + BLOQUEO_ANALITICA;
}

// The Wellness Project (theme-prod-storefront.spec.js): no está en sites.js, sus tests no usan
// site.id. Se les antepone "TWP-" al título para poder filtrarlos con --grep "TWP-".
function generarTwp(res) {
  const archivo = 'theme-prod-storefront.spec.js';
  let src = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');

  src = reemplazar(
    src,
    "const { test, expect } = require('@playwright/test');",
    () => `const { test, expect, devices } = require('@playwright/test');${cabecera(res)}`,
    'import de @playwright/test',
    archivo
  );
  if (res.device) {
    src = reemplazar(
      src,
      /test\.use\(\{\s*userAgent:[^\n]*\n/,
      () => `const { defaultBrowserType: __dbt, ...__DISPOSITIVO } = devices[${JSON.stringify(res.device)}];\ntest.use({\n  ...__DISPOSITIVO,\n`,
      'test.use con userAgent',
      archivo
    );
    src = reemplazar(src, /,\s*viewport: \{ width: 1280, height: 720 \}/, '', 'viewport 1280x720', archivo);
  } else {
    src = reemplazar(
      src,
      /viewport: \{ width: 1280, height: 720 \}/,
      `viewport: ${JSON.stringify(res.viewport).replace(/"/g, '')}`,
      'viewport 1280x720',
      archivo
    );
  }
  src = reemplazar(
    src,
    /\btest\('(STF-\d{2}): ([^']*)'/g,
    (_, n, titulo) => `__testPara({ id: 'TWP' }, '${n}', ${JSON.stringify(res.twp || [])})(${JSON.stringify(`TWP-${n}: ${titulo} [${res.nombre}]`)}`,
    'títulos de los tests',
    archivo
  );
  return src + BLOQUEO_ANALITICA;
}

function main() {
  fs.rmSync(SALIDA, { recursive: true, force: true });
  fs.mkdirSync(SALIDA, { recursive: true });
  const generados = [];
  const lote = process.env.RESOLUCIONES_LOTE;
  const elegidas = lote === undefined || lote === '' ? resoluciones : resoluciones.filter((r) => String(r.lote) === String(lote));
  if (!elegidas.length) throw new Error(`generar.js: el lote ${lote} no tiene resoluciones (ver tests/config/resoluciones.js)`);
  for (const res of elegidas) {
    if (res.twp?.length) {
      const destino = path.join(SALIDA, `twp-${res.id}.spec.js`);
      fs.writeFileSync(destino, generarTwp(res));
      generados.push(destino);
    }
    if (res.funcional?.length) {
      const destino = path.join(SALIDA, `funcional-${res.id}.spec.js`);
      fs.writeFileSync(destino, generarFuncional(res));
      generados.push(destino);
    }
    if (res.responsive?.length) {
      const destino = path.join(SALIDA, `responsive-${res.id}.spec.js`);
      fs.writeFileSync(destino, generarResponsive(res));
      generados.push(destino);
    }
  }
  console.log(`Suite multi-resolución generada (${generados.length} archivos en ${path.relative(process.cwd(), SALIDA)}/):`);
  for (const res of elegidas) console.log(`  • ${res.nombre}: funcional [${res.funcional.join(', ')}]${res.responsive.length ? ` + ${res.responsive.join(', ')}` : ''}`);
}

main();
