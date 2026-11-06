// Chequeos de seguridad básica y estabilidad de cada proyecto, para el informe semanal.
//
// Son todos PASIVOS: solo se hacen pedidos GET de lectura, como los de cualquier navegador. No se
// prueban ataques ni se envían datos. La "estabilidad" son 10 visitas seguidas a la home (con un
// segundo entre cada una) para medir el tiempo de respuesta: NO es una prueba de carga. Una prueba
// de estrés real sobre la tienda productiva de un cliente puede afectar a compradores reales y
// Shopify bloquea ese tráfico, así que no se hace.
//
// Corre junto con Lighthouse en .github/workflows/calidad-diaria.yml y deja cada resultado en el
// log como "SEGURIDAD_RESULTADO {json}" para que lo lea el informe semanal.
//
// Uso: node .github/scripts/seguridad.js [ID ...]   (sin ids revisa todos)

const tls = require('tls');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const sites = require(path.join(RAIZ, 'tests/config/sites.js'));
const { extras } = require(path.join(RAIZ, 'tests/config/reporte.js'));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ARCHIVOS_SENSIBLES = [
  ['/.env', /^[A-Z0-9_]+=/m],
  ['/.git/config', /\[core\]/],
  ['/.git/HEAD', /^ref: refs\//],
  ['/wp-config.php.bak', /DB_PASSWORD/],
  ['/.DS_Store', /Bud1/],
];

function objetivos() {
  const lista = sites.map((s) => ({ id: s.id, url: s.baseUrl }));
  for (const e of extras) if (!e.interno && /^https?:\/\//.test(e.url)) lista.push({ id: e.id, url: e.url });
  const pedidos = process.argv.slice(2);
  return pedidos.length ? lista.filter((o) => pedidos.includes(o.id)) : lista;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (url, opts = {}) => fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(20000), ...opts });

function certificado(host) {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 15000 }, () => {
      const c = s.getPeerCertificate();
      const vence = c.valid_to ? new Date(c.valid_to) : null;
      resolve({ valido: s.authorized, vence: vence?.toISOString() || null, dias: vence ? Math.floor((vence - Date.now()) / 864e5) : null, tls: s.getProtocol() });
      s.end();
    });
    s.on('error', (e) => resolve({ valido: false, error: e.message }));
    s.on('timeout', () => { resolve({ valido: false, error: 'timeout' }); s.destroy(); });
  });
}

async function revisar({ id, url }) {
  const base = new URL(url);
  const r = { id, url };

  r.certificado = await certificado(base.hostname);

  // ¿Quien entra por http:// termina en https://?
  try {
    const h = await get(`http://${base.host}/`, { redirect: 'manual' });
    r.httpsForzado = [301, 302, 307, 308].includes(h.status) && /^https:\/\//.test(h.headers.get('location') || '');
  } catch {
    r.httpsForzado = null;
  }

  const home = await get(url).catch(() => null);
  if (!home || home.status >= 400) {
    r.error = `La home respondió ${home ? home.status : 'sin respuesta'} (posible bloqueo anti-robots del servidor de pruebas)`;
    return r;
  }
  const hd = (k) => home.headers.get(k) || '';
  const html = await home.text();
  const csp = hd('content-security-policy');
  const cookies = home.headers.getSetCookie ? home.headers.getSetCookie() : [];
  r.cabeceras = {
    hsts: !!hd('strict-transport-security'),
    noSniff: /nosniff/i.test(hd('x-content-type-options')),
    antiEmbebido: !!hd('x-frame-options') || /frame-ancestors/i.test(csp),
    csp: !!csp,
    referrerPolicy: !!hd('referrer-policy'),
  };
  r.versionServidorExpuesta = /\/\d/.test(hd('server')) || /\d/.test(hd('x-powered-by'));
  r.cookiesInseguras = cookies.filter((c) => !/;\s*secure/i.test(c)).length;
  r.contenidoMixto = (html.match(/<(script|img|iframe|link)\b[^>]*\s(src|href)=["']http:\/\//gi) || []).length;

  r.archivosExpuestos = [];
  for (const [ruta, firma] of ARCHIVOS_SENSIBLES) {
    const a = await get(new URL(ruta, url).href, { redirect: 'manual' }).catch(() => null);
    if (a && a.status === 200 && firma.test(await a.text().catch(() => ''))) r.archivosExpuestos.push(ruta);
  }

  // Estabilidad: 10 visitas seguidas a la home, separadas por 1 segundo.
  const tiempos = [];
  let errores = 0;
  for (let i = 0; i < 10; i++) {
    const t0 = Date.now();
    const v = await get(url).catch(() => null);
    if (!v || v.status >= 500) errores++;
    else {
      await v.arrayBuffer().catch(() => {});
      tiempos.push(Date.now() - t0);
    }
    await sleep(1000);
  }
  tiempos.sort((a, b) => a - b);
  r.estabilidad = {
    visitas: 10,
    errores,
    promedioMs: tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null,
    maximoMs: tiempos.length ? tiempos[tiempos.length - 1] : null,
  };
  return r;
}

async function main() {
  for (const o of objetivos()) {
    const r = await revisar(o).catch((e) => ({ ...o, error: e.message }));
    console.log(`SEGURIDAD_RESULTADO ${JSON.stringify(r)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
