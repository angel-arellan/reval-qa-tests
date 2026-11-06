// Mide la home de cada proyecto con Google Lighthouse (la misma herramienta que usa PageSpeed
// Insights): rendimiento, accesibilidad, buenas prácticas y SEO, en celular y en escritorio.
//
// Corre una vez por día (.github/workflows/lighthouse-diario.yml) y deja cada medición en el log
// como una línea "LIGHTHOUSE_RESULTADO {json}". El informe semanal lee esas líneas y muestra la
// mediana de la semana en el PDF de cada proyecto.
//
// Si existe el secret PAGESPEED_API_KEY usa la API de PageSpeed Insights (los mismos números que
// ve el cliente en pagespeed.web.dev). Si no, corre Lighthouse en el servidor de GitHub.
//
// Uso: node .github/scripts/lighthouse.js [ID ...]   (sin ids mide todos)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');
const sites = require(path.join(RAIZ, 'tests/config/sites.js'));
const { extras } = require(path.join(RAIZ, 'tests/config/reporte.js'));

const CATEGORIAS = ['performance', 'accessibility', 'best-practices', 'seo'];
const LIGHTHOUSE = process.env.LIGHTHOUSE_BIN || path.join(RAIZ, 'node_modules/.bin/lighthouse');

function objetivos() {
  const lista = sites.map((s) => ({ id: s.id, url: s.baseUrl }));
  for (const e of extras) if (!e.interno && /^https?:\/\//.test(e.url)) lista.push({ id: e.id, url: e.url });
  const pedidos = process.argv.slice(2);
  return pedidos.length ? lista.filter((o) => pedidos.includes(o.id)) : lista;
}

function resumir(lhr) {
  const c = lhr.categories;
  const a = lhr.audits;
  const punt = (k) => (c[k] && typeof c[k].score === 'number' ? Math.round(c[k].score * 100) : null);
  const ms = (k) => (a[k] && typeof a[k].numericValue === 'number' ? Math.round(a[k].numericValue) : null);
  return {
    rendimiento: punt('performance'),
    accesibilidad: punt('accessibility'),
    buenasPracticas: punt('best-practices'),
    seo: punt('seo'),
    lcpMs: ms('largest-contentful-paint'),
    fcpMs: ms('first-contentful-paint'),
    tbtMs: ms('total-blocking-time'),
    cls: a['cumulative-layout-shift'] ? Math.round(a['cumulative-layout-shift'].numericValue * 1000) / 1000 : null,
  };
}

async function conApi(url, estrategia) {
  const q = new URLSearchParams({ url, strategy: estrategia === 'celular' ? 'mobile' : 'desktop', key: process.env.PAGESPEED_API_KEY });
  CATEGORIAS.forEach((c) => q.append('category', c.toUpperCase().replace('-', '_')));
  const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`PageSpeed respondió ${r.status}: ${j.error?.message || ''}`.slice(0, 200));
  return { ...resumir(j.lighthouseResult), fuente: 'pagespeed' };
}

function conCli(url, estrategia) {
  const salida = path.join(os.tmpdir(), `lh-${process.pid}-${estrategia}.json`);
  const args = [
    url,
    '--output=json',
    `--output-path=${salida}`,
    `--only-categories=${CATEGORIAS.join(',')}`,
    '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
    '--max-wait-for-load=45000',
    '--quiet',
    ...(estrategia === 'escritorio' ? ['--preset=desktop'] : []),
  ];
  const r = spawnSync(LIGHTHOUSE, args, { timeout: 180000, encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(salida)) throw new Error(`Lighthouse terminó con código ${r.status}: ${(r.stderr || '').slice(-200)}`);
  const lhr = JSON.parse(fs.readFileSync(salida, 'utf8'));
  fs.rmSync(salida, { force: true });
  if (lhr.runtimeError) throw new Error(`Lighthouse no pudo medir: ${lhr.runtimeError.code}`);
  return { ...resumir(lhr), fuente: 'lighthouse' };
}

async function main() {
  let fallas = 0;
  for (const { id, url } of objetivos()) {
    for (const estrategia of ['celular', 'escritorio']) {
      let resultado = null;
      for (let intento = 0; intento < 2 && !resultado; intento++) {
        try {
          resultado = process.env.PAGESPEED_API_KEY ? await conApi(url, estrategia) : conCli(url, estrategia);
        } catch (e) {
          console.log(`  ${id} ${estrategia}: intento ${intento + 1} falló (${e.message})`);
        }
      }
      if (!resultado || resultado.rendimiento === null) {
        fallas++;
        continue;
      }
      console.log(`LIGHTHOUSE_RESULTADO ${JSON.stringify({ id, url, estrategia, ...resultado })}`);
    }
  }
  console.log(`Mediciones con error: ${fallas}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
