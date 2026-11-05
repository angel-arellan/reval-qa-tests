// Informe semanal de QA: un PDF por proyecto (para reenviar al cliente) y un mail interno con
// el resumen de todos los proyectos.
//
// Arma todo con datos reales de GitHub Actions (las corridas programadas de la semana): cuántas
// rondas de prueba se hicieron, cuáles pasaron, qué falló y cuándo se resolvió. No vuelve a
// correr ningún test.
//
// Uso:
//   node .github/scripts/reporte-semanal.js --salida <carpeta> [--ultimos 7] [--enviar]
//   --ultimos N  usa los últimos N días hasta ahora (para vistas previas). Sin esto toma la
//                semana anterior completa, de lunes a domingo (hora de Argentina).
//   --enviar     manda el mail. Sin esto solo deja los PDF y el mail en HTML en la carpeta.
//   --simular-resoluciones  (vista previa) lista las pantallas de la suite multi-resolución
//                aunque todavía no tenga corridas en el período.
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY; para enviar: MAIL_USERNAME, MAIL_PASSWORD (contraseña
// de aplicación de Gmail), REPORTE_DESTINATARIOS (separados por coma), REPORTE_FIRMA.
//
// Cómo se interpreta cada corrida de un job (ver los workflows):
// - ok: pasó todo en la primera pasada.
// - recuperada: algo falló pero pasó en la re-ejecución de 3 minutos después (corte de red,
//   popup, CDN lento). No se informa al cliente.
// - falla: falló en las dos pasadas (6 intentos). Es lo que alerta a Slack.
// - infra: falló GitHub (npm, instalación del navegador) antes de probar la tienda. No cuenta.
// Las fallas seguidas forman un "incidente" que termina en la primera corrida que pasa. Si entre
// la última falla y esa corrida hubo un commit que nombra al proyecto (ej. "fix: Ena Sport
// reemplazó los filtros..."), el incidente se informa como ajuste de las pruebas por un cambio
// en el sitio, no como una falla de la tienda.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');
const sites = require(path.join(RAIZ, 'tests/config/sites.js'));
const cfg = require(path.join(RAIZ, 'tests/config/reporte.js'));
const actividades = require(path.join(RAIZ, 'tests/config/actividades-qa.js'));
const { resoluciones } = require(path.join(RAIZ, 'tests/config/resoluciones.js'));

const REPO = process.env.GITHUB_REPOSITORY || 'angel-arellan/reval-qa-tests';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const TZ = 'America/Argentina/Buenos_Aires';
const FIRMA = process.env.REPORTE_FIRMA || 'Equipo de QA · Latech Factory';
const MAX_LOGS = 120;

// Frecuencia programada de cada workflow (en horas), para comparar rondas previstas vs reales.
const FRECUENCIA_HORAS = {
  'playwright.yml': 1,
  'playwright-multisite.yml': 1,
  'playwright-multisite-salud.yml': 2,
  'playwright-resoluciones.yml': 4,
};

// ---------------------------------------------------------------------------------------------
// Utilidades

const args = process.argv.slice(2);
const arg = (n) => {
  const i = args.indexOf(n);
  return i === -1 ? null : args[i + 1];
};
const SALIDA = path.resolve(arg('--salida') || 'reporte-semanal');
const ULTIMOS = Number(arg('--ultimos')) || 0;
const ENVIAR = args.includes('--enviar');
// Solo para vistas previas: muestra la lista de pantallas de la suite multi-resolución aunque
// todavía no haya corrido en el período.
const SIMULAR_RESOLUCIONES = args.includes('--simular-resoluciones');

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const normalizar = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const plural = (n, uno, varios) => `${n.toLocaleString('es-AR')} ${n === 1 ? uno : varios}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function partes(d) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('es-AR', {
      timeZone: TZ, weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).map((p) => [p.type, p.value])
  );
}
const diaMes = (d) => { const p = partes(d); return `${p.day}/${p.month}`; };
const fechaHora = (d) => { const p = partes(d); return `${p.weekday} ${p.day}/${p.month}, ${p.hour}:${p.minute} h`; };

function periodo() {
  const ahora = new Date();
  if (ULTIMOS) return { desde: new Date(ahora - ULTIMOS * 864e5), hasta: ahora };
  // Lunes 00:00 de esta semana en Argentina (UTC-3, sin horario de verano) → semana anterior.
  const art = new Date(ahora.getTime() - 3 * 3600e3);
  const dow = (art.getUTCDay() + 6) % 7;
  const lunes = Date.UTC(art.getUTCFullYear(), art.getUTCMonth(), art.getUTCDate() - dow) + 3 * 3600e3;
  return { desde: new Date(lunes - 7 * 864e5), hasta: new Date(lunes - 1000) };
}

async function gh(ruta, { texto = false } = {}) {
  const url = ruta.startsWith('http') ? ruta : `https://api.github.com${ruta}`;
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'reporte-semanal-qa' },
    });
    if (r.status === 404 || r.status === 410) return null;
    if (r.ok) return texto ? r.text() : r.json();
    if (r.status >= 500 || r.status === 429 || r.status === 403) {
      await sleep(3000 * (intento + 1));
      continue;
    }
    throw new Error(`GitHub API respondió ${r.status} en ${ruta}`);
  }
  throw new Error(`GitHub API no respondió en ${ruta}`);
}

async function enParalelo(items, limite, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) {
      const j = i++;
      out[j] = await fn(items[j]);
    }
  }));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Proyectos y qué se les prueba

function contadorPorPrefijo(prefijo, filtroArchivo, sinCompra) {
  return (t) => filtroArchivo(t.file) && t.title.startsWith(prefijo) && !(sinCompra && /-04:/.test(t.title));
}

function revisamosTienda(site) {
  const filas = [];
  const tienda = site.ecommerce !== false;
  filas.push(['inicio', 'Página de inicio y menú', site.header?.hasMegaMenu
    ? 'La página carga sin errores, se ven el logo y el pie de página, y el menú principal se despliega y lleva a una categoría.'
    : 'La página carga sin errores, se ven el logo y el pie de página, y los links del menú llevan a su sección.']);
  if (tienda) {
    filas.push(['buscador', 'Buscador', `Buscamos un producto (por ejemplo «${site.search?.term}») y verificamos que aparezcan resultados y que se pueda entrar a uno.`]);
    filas.push(['catalogo', 'Catálogo y filtros', site.collection?.filters?.enabled
      ? 'Una categoría muestra productos, se aplica un filtro (talle, color, tipo, etc.) y se abre un producto.'
      : 'Una categoría muestra productos y se puede abrir uno.']);
    if (!site.knownProductionBug) {
      filas.push(['compra', 'Producto, carrito y checkout', 'Elegimos una variante, agregamos al carrito, cambiamos la cantidad y llegamos hasta la página de pago. Nunca se completa una compra.']);
    }
    filas.push(['cuenta', 'Cuenta de cliente y páginas legales', 'El ingreso a la cuenta, los términos y condiciones y la política de privacidad cargan bien.']);
  }
  filas.push(['celular', 'Celulares y tablets', tienda
    ? 'En celular el menú se abre, la ficha de producto muestra foto, precio y botón de compra, y nada se sale de la pantalla.'
    : 'En celular el menú se abre y nada se sale de la pantalla.']);
  filas.push(['tecnico', 'Salud técnica', 'Sin errores en el código del sitio, links rotos, imágenes caídas ni textos mal cargados, y la página de «no encontrado» funciona.']);
  return [...filas, ...((cfg.revisamosExtra || {})[site.id] || [])];
}

function proyectos() {
  const lista = sites
    .filter((s) => !cfg.excluir.includes(s.id))
    .map((s) => {
      const sinCompra = !!s.knownProductionBug;
      return {
        id: s.id,
        nombre: s.name,
        url: s.baseUrl,
        site: s,
        nota: cfg.notas[s.id] || null,
        revisamos: revisamosTienda(s),
        suites: [
          { clave: 'funcional', workflow: 'playwright-multisite.yml', job: `Storefront - ${s.name}`, contar: contadorPorPrefijo(`${s.id}-`, (f) => f === 'storefront-multisite.spec.js', sinCompra) },
          { clave: 'salud', workflow: 'playwright-multisite-salud.yml', job: `Salud y Responsive - ${s.name}`, contar: contadorPorPrefijo(`${s.id}-`, (f) => /^storefront-multisite-(salud|responsive)\.spec\.js$/.test(f), false) },
          { clave: 'resoluciones', workflow: 'playwright-resoluciones.yml', job: `Resoluciones - ${s.name}`, contar: contadorPorPrefijo(`${s.id}-`, (f) => f.startsWith('generados/') || f === 'web-latech.spec.js', sinCompra) },
        ],
      };
    });
  for (const e of cfg.extras) {
    lista.push({
      ...e,
      nota: cfg.notas[e.id] || null,
      suites: e.suites.map((su) => ({
        ...su,
        contar: su.prefijo
          ? contadorPorPrefijo(su.prefijo, (f) => f.startsWith('generados/'), false)
          : (t) => su.archivos.includes(t.file) && !(su.excluirTitulos && su.excluirTitulos.test(t.title)),
      })),
    });
  }
  return lista;
}

// Lista todos los tests (sin correrlos) para saber cuántas pruebas hace cada ronda.
function listarTests() {
  execSync('node tests/resoluciones/generar.js', { cwd: RAIZ, stdio: 'ignore' });
  const archivo = path.join(os.tmpdir(), `lista-tests-${process.pid}.json`);
  execSync('npx playwright test --list --reporter=json', {
    cwd: RAIZ,
    stdio: 'ignore',
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: archivo, PLAYWRIGHT_JSON_OUTPUT_FILE: archivo },
  });
  const json = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const tests = [];
  const recorrer = (suite, archivoSuite) => {
    const file = suite.file || archivoSuite;
    (suite.specs || []).forEach((sp) => tests.push({ file: (sp.file || file).replace(/^tests\//, ''), title: sp.title }));
    (suite.suites || []).forEach((s) => recorrer(s, file));
  };
  (json.suites || []).forEach((s) => recorrer(s, s.file));
  return tests;
}

// ---------------------------------------------------------------------------------------------
// Datos de GitHub Actions

function clasificarJob(job) {
  if (['cancelled', 'skipped'].includes(job.conclusion) || !job.conclusion) return 'omitida';
  const pasos = job.steps || [];
  // "Run <algo>" con nombre propio (los pasos sin nombre que usan una action se llaman
  // "Run actions/checkout@v4", etc.).
  const correr = pasos.find((s) => /^Run (?![\w.-]+\/[\w.-]+@)/.test(s.name));
  const confirmar = pasos.find((s) => /^Confirmar fallas/.test(s.name));
  if (!correr || !correr.conclusion || correr.conclusion === 'skipped') return 'infra';
  if (confirmar?.conclusion === 'failure') return 'falla';
  if (job.conclusion === 'success') return confirmar?.conclusion === 'success' ? 'recuperada' : 'ok';
  return 'infra';
}

// El paso de alerta (.github/scripts/alerta-slack.js) imprime en el log "• *<test>:* <motivo>".
function fallasDelLog(log) {
  const vistos = new Map();
  for (const linea of (log || '').split('\n')) {
    const m = linea.match(/• \*(.+?):\* (.+?)\s*$/);
    if (m && !vistos.has(m[1])) vistos.set(m[1], m[2]);
  }
  return [...vistos].map(([nombre, motivo]) => ({ nombre, motivo }));
}

async function corridas(workflow, { desde, hasta }) {
  const rango = `${desde.toISOString().replace(/\.\d+Z$/, 'Z')}..${hasta.toISOString().replace(/\.\d+Z$/, 'Z')}`;
  const out = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const d = await gh(`/repos/${REPO}/actions/workflows/${workflow}/runs?event=schedule&per_page=100&page=${pagina}&created=${encodeURIComponent(rango)}`);
    if (!d) return null; // el workflow todavía no existe en GitHub
    out.push(...d.workflow_runs);
    if (d.workflow_runs.length < 100) break;
  }
  return out.filter((r) => r.status === 'completed');
}

const AREAS = [
  ['celular', /^(Mobile|Tablet|Responsive|Celular)\b/i],
  ['contacto', /Formulario/i],
  ['inicio', /p[aá]ginas del sitemap|men[uú] lleva|Casos de [eé]xito/i],
  ['inicio', /^Home\b|Link de categor/i],
  ['buscador', /Buscador/i],
  ['catalogo', /Cat[aá]logo/i],
  ['compra', /Carrito|Checkout|PDP/i],
  ['admin', /^(STG|PROD) - TC/],
  ['cuenta', /Login|Cuenta|Perfil|Pedidos|Suscripciones|Direcci[oó]n|T[eé]rminos|Privacidad|Pol[ií]ticas/i],
  ['tecnico', /Visual|Excepciones|Recursos|Links internos|contenido roto|Tracking|404|Precio|Im[aá]genes/i],
];
const areaDe = (nombre) => (AREAS.find(([, re]) => re.test(nombre)) || ['otro'])[0];
const dispositivoDe = (nombre) => (nombre.match(/\[([^\]]+)\]\s*$/) || [])[1] || null;

const TEXTO_AREA = {
  inicio: 'La página de inicio o el menú principal no funcionaron como se esperaba.',
  buscador: 'El buscador no devolvió resultados o no permitió entrar a un producto.',
  catalogo: 'La categoría o los filtros no respondieron correctamente.',
  compra: 'No se pudo completar el recorrido hasta la página de pago (agregar al carrito, carrito o checkout).',
  cuenta: 'El acceso a la cuenta o alguna página legal no cargó.',
  celular: 'En celular o tablet, alguna parte de la tienda no se mostró correctamente.',
  tecnico: 'Detectamos errores técnicos (archivos, enlaces o imágenes que no cargaban).',
  admin: 'Alguna sección del panel de administración no cargó correctamente.',
  contacto: 'El formulario de contacto no se mostró correctamente.',
  otro: 'Una de las pruebas automáticas no pasó.',
};
const NOMBRE_AREA = {
  inicio: 'página de inicio y menú', buscador: 'buscador', catalogo: 'catálogo y filtros', compra: 'carrito y checkout',
  cuenta: 'cuenta de cliente', contacto: 'formulario de contacto', celular: 'celulares y tablets', tecnico: 'salud técnica', admin: 'panel de administración', otro: 'pruebas generales',
};

async function recolectar(lista, rango) {
  const workflows = [...new Set(lista.flatMap((p) => p.suites.map((s) => s.workflow)))];
  const porJob = new Map(); // nombre de job → [{ run, job, estado }]
  const rondas = {}; // workflow → cantidad de corridas programadas
  for (const wf of workflows) {
    const runs = await corridas(wf, rango);
    if (runs === null) continue; // workflow nuevo que todavía no está en GitHub
    rondas[wf] = runs.length;
    const conJobs = await enParalelo(runs, 6, async (run) => ({
      run,
      jobs: (await gh(`/repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`))?.jobs || [],
    }));
    for (const { run, jobs } of conJobs) {
      for (const job of jobs) {
        const clave = `${wf}::${job.name}`;
        if (!porJob.has(clave)) porJob.set(clave, []);
        porJob.get(clave).push({ run, job, fecha: new Date(run.created_at), sha: run.head_sha, estado: clasificarJob(job) });
      }
    }
  }

  // Logs de las fallas confirmadas: qué test falló y por qué.
  const fallas = [...porJob.values()].flat().filter((e) => e.estado === 'falla').sort((a, b) => b.fecha - a.fecha).slice(0, MAX_LOGS);
  await enParalelo(fallas, 6, async (e) => {
    const log = await gh(`/repos/${REPO}/actions/jobs/${e.job.id}/logs`, { texto: true }).catch(() => null);
    if (log === null) return;
    if (/Sin tests fallidos en el reporte/.test(log)) e.estado = 'infra';
    e.tests = fallasDelLog(log);
  });

  const compararCache = new Map();
  const commitsEntre = async (base, head) => {
    const k = `${base}...${head}`;
    if (!compararCache.has(k)) compararCache.set(k, gh(`/repos/${REPO}/compare/${k}`).then((c) => c?.commits || []).catch(() => []));
    return compararCache.get(k);
  };

  for (const p of lista) {
    p.incidentes = [];
    p.stats = { rondas: 0, ok: 0, recuperadas: 0, fallas: 0, infra: 0, pruebas: 0, porSuite: {} };
    for (const su of p.suites) {
      const serie = (porJob.get(`${su.workflow}::${su.job}`) || []).sort((a, b) => a.fecha - b.fecha);
      const st = { rondas: 0, ok: 0, recuperadas: 0, fallas: 0, infra: 0 };
      let actual = null;
      for (const e of serie) {
        if (e.estado === 'omitida') continue;
        if (e.estado === 'infra') { st.infra++; continue; }
        st.rondas++;
        p.stats.pruebas += su.cantidad || 0;
        if (e.estado === 'falla') {
          st.fallas++;
          if (!actual) actual = { suite: su.clave, inicio: e.fecha, corridas: [], tests: new Map() };
          actual.corridas.push(e);
          actual.ultimaFalla = e;
          (e.tests || []).forEach((t) => actual.tests.set(t.nombre, t.motivo));
        } else {
          st[e.estado === 'ok' ? 'ok' : 'recuperadas']++;
          if (actual) {
            actual.fin = e.fecha;
            actual.finSha = e.sha;
            p.incidentes.push(actual);
            actual = null;
          }
        }
      }
      if (actual) p.incidentes.push(actual);
      p.stats.porSuite[su.clave] = st;
      for (const k of ['rondas', 'ok', 'recuperadas', 'fallas', 'infra']) p.stats[k] += st[k];
    }

    for (const inc of p.incidentes) {
      inc.areas = [...new Set([...inc.tests.keys()].map(areaDe))];
      if (!inc.areas.length) inc.areas = ['otro'];
      inc.dispositivos = [...new Set([...inc.tests.keys()].map(dispositivoDe).filter(Boolean))];
      inc.causa = 'sitio';
      // "Bloqueo en X" = la página respondió con el desafío anti-robots ("Just a moment...")
      // a los servidores de GitHub. Un comprador real no lo ve: no es una caída de la tienda.
      const motivos = [...inc.tests.values()];
      if (motivos.length && motivos.every((m) => /^Bloqueo en |Just a moment|anti-?bot/i.test(m))) inc.causa = 'bloqueo';
      if (inc.causa === 'sitio' && inc.fin && inc.finSha && inc.finSha !== inc.ultimaFalla.sha) {
        const commits = await commitsEntre(inc.ultimaFalla.sha, inc.finSha);
        const claves = [normalizar(p.nombre), normalizar(p.id)];
        const ajuste = commits.find((c) => claves.some((k) => k && normalizar(c.commit.message).includes(k)));
        if (ajuste) {
          inc.causa = 'ajuste';
          inc.commit = ajuste.commit.message.split('\n')[0];
        }
      }
    }
    p.incidentes.sort((a, b) => a.inicio - b.inicio);
  }
  return rondas;
}

// ---------------------------------------------------------------------------------------------
// Trabajo de QA manual (tests/config/actividades-qa.js)

const diaISO = (d) => { const p = partes(d); return `${p.year}-${p.month.padStart(2, '0')}-${p.day.padStart(2, '0')}`; };
function actividadesDelPeriodo(rango) {
  const desde = diaISO(rango.desde);
  const hasta = diaISO(rango.hasta);
  return actividades.filter((a) => a.fecha >= desde && a.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
const fechaCorta = (iso) => { const [, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}`; };
const CLASE_RESULTADO = { Aprobado: 'verde', 'Aprobado con observaciones': 'amarillo', 'Con problemas': 'rojo', Parcial: 'gris' };

function htmlActividades(lista) {
  if (!lista?.length) return '';
  return `<h2>Trabajo de QA de la semana</h2>${lista.map((a) => `
    <div class="incidente">
      <div><b>${esc(a.titulo)}</b> <span class="estado ${CLASE_RESULTADO[a.resultado] || 'gris'}">${esc(a.resultado)}</span></div>
      <div class="cuando">${esc(fechaCorta(a.fecha))}</div>
      <div style="margin-top:4px">${esc(a.resumen)}</div>
      ${a.hallazgos?.length ? `<div style="margin-top:6px"><b>Encontramos:</b><ul style="margin:2px 0 0;padding-left:18px">${a.hallazgos.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      ${a.pendientes?.length ? `<div style="margin-top:6px"><b>Pendiente:</b><ul style="margin:2px 0 0;padding-left:18px">${a.pendientes.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
    </div>`).join('')}`;
}

// ---------------------------------------------------------------------------------------------
// Textos

function estadoProyecto(p) {
  const abiertos = p.incidentes.filter((i) => !i.fin && i.causa === 'sitio');
  const delSitio = p.incidentes.filter((i) => i.causa === 'sitio');
  if (!p.stats.rondas) return { clase: 'gris', etiqueta: 'Sin datos', resumen: 'No hubo rondas de prueba registradas en el período.' };
  if (abiertos.length) {
    return {
      clase: 'rojo',
      etiqueta: 'Requiere atención',
      resumen: `Hay un tema abierto en ${abiertos.map((i) => i.areas.map((a) => NOMBRE_AREA[a]).join(' y ')).join('; ')} que estamos siguiendo. El detalle está más abajo.`,
    };
  }
  if (delSitio.length) {
    return {
      clase: 'amarillo',
      etiqueta: 'Con novedades',
      resumen: `La semana tuvo ${plural(delSitio.length, 'interrupción', 'interrupciones')}, ya ${delSitio.length === 1 ? 'resuelta' : 'resueltas'}. Fuera de eso, todo funcionó con normalidad.`,
    };
  }
  if (p.incidentes.length) {
    const ajuste = p.incidentes.some((i) => i.causa === 'ajuste');
    return {
      clase: 'verde',
      etiqueta: 'Funcionando bien',
      resumen: ajuste
        ? 'La tienda funcionó con normalidad. Hubo un cambio en el sitio que nos llevó a actualizar una de las pruebas; no vimos impacto para los compradores.'
        : 'La tienda funcionó con normalidad. En algún momento la protección anti-robots del sitio frenó a nuestras pruebas, algo que no afecta a los compradores.',
    };
  }
  return {
    clase: 'verde',
    etiqueta: 'Funcionando bien',
    resumen: `Semana sin novedades: todas las rondas de prueba pasaron sin problemas.`,
  };
}

function textoIncidente(inc) {
  if (inc.causa === 'bloqueo') {
    return `La protección anti-robots del sitio frenó a nuestras pruebas automáticas (${inc.areas.map((a) => NOMBRE_AREA[a]).join(' y ')}), así que en ese lapso no pudimos verificar esa parte. Es una protección normal y no la ven los compradores.`;
  }
  if (inc.causa === 'ajuste') {
    return `Detectamos un cambio en el sitio (diseño, filtros o ventanas emergentes) en ${inc.areas.map((a) => NOMBRE_AREA[a]).join(' y ')}. Actualizamos las pruebas para el nuevo diseño; no se trató de una falla para los compradores.`;
  }
  const base = inc.areas.map((a) => TEXTO_AREA[a]).join(' ');
  return inc.dispositivos.length ? `${base} Se vio en: ${inc.dispositivos.join(', ')}.` : base;
}

function pantallasProbadas(p) {
  if (p.interno) return [];
  const lista = ['Escritorio 1280×720'];
  if (p.site) lista.push('iPhone 13 (390×664)', 'iPad Mini (768×1024)');
  const tieneResoluciones = SIMULAR_RESOLUCIONES
    ? p.suites.some((s) => s.clave === 'resoluciones' && s.cantidad)
    : (p.stats.porSuite.resoluciones?.rondas || 0) > 0;
  if (tieneResoluciones) lista.push(...resoluciones.map((r) => r.nombre));
  return lista;
}

// ---------------------------------------------------------------------------------------------
// HTML

const ESTILOS = `
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif; color: #1d2433; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 2px; font-weight: 700; letter-spacing: -0.2px; }
  h2 { font-size: 12pt; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d9dee7; }
  .marca { font-size: 9pt; color: #5b6475; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px; }
  .sub { color: #5b6475; margin: 0; }
  .estado { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9pt; font-weight: 700; }
  .verde { background: #e3f3e8; color: #1e6b3a; } .amarillo { background: #fdf1d8; color: #8a5a00; }
  .rojo { background: #fbe3e1; color: #9b2c22; } .gris { background: #eceef2; color: #4b5363; }
  .resumen { margin: 16px 0 6px; padding: 12px 14px; background: #f5f7fa; border-left: 3px solid #1f3a5f; }
  .cifras { display: flex; gap: 10px; margin: 14px 0 4px; }
  .cifra { flex: 1; border: 1px solid #d9dee7; border-radius: 6px; padding: 10px 12px; }
  .cifra b { display: block; font-size: 16pt; color: #1f3a5f; }
  .cifra span { font-size: 8.5pt; color: #5b6475; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.6px; color: #5b6475; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #d9dee7; }
  td { padding: 8px; border-bottom: 1px solid #eceef2; vertical-align: top; }
  td.area { font-weight: 600; width: 27%; }
  td.res { width: 21%; white-space: nowrap; }
  .ok { color: #1e6b3a; font-weight: 600; } .warn { color: #8a5a00; font-weight: 600; } .bad { color: #9b2c22; font-weight: 600; }
  .incidente { border: 1px solid #d9dee7; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; page-break-inside: avoid; }
  .incidente .cuando { font-size: 9pt; color: #5b6475; }
  .chips span { display: inline-block; border: 1px solid #d9dee7; border-radius: 10px; padding: 1px 8px; margin: 2px 4px 2px 0; font-size: 8.5pt; }
  .nota { padding: 10px 12px; background: #fdf8ec; border: 1px solid #f1e2b8; border-radius: 6px; }
  .pie { margin-top: 22px; font-size: 8.5pt; color: #5b6475; }
`;

function htmlProyecto(p, rango) {
  const est = estadoProyecto(p);
  const porArea = (clave) => p.incidentes.filter((i) => i.areas.includes(clave));
  const filas = p.revisamos.map(([clave, titulo, texto, fijo]) => {
    if (fijo) return `<tr><td class="area">${esc(titulo)}</td><td>${esc(texto)}</td><td class="res"><span style="color:#4b5363;font-weight:600">${esc(fijo)}</span></td></tr>`;
    if (!p.stats.rondas) return `<tr><td class="area">${esc(titulo)}</td><td>${esc(texto)}</td><td class="res"><span style="color:#4b5363">Sin datos todavía</span></td></tr>`;
    const incs = porArea(clave);
    const delSitio = incs.filter((i) => i.causa === 'sitio');
    let res = '<span class="ok">Sin problemas</span>';
    if (delSitio.some((i) => !i.fin)) res = '<span class="bad">En revisión</span>';
    else if (delSitio.length) res = `<span class="warn">${plural(delSitio.length, 'interrupción', 'interrupciones')}, resuelta${delSitio.length === 1 ? '' : 's'}</span>`;
    else if (incs.length) {
      const nota = incs.some((i) => i.causa === 'ajuste') ? 'prueba actualizada' : 'unas horas sin verificar';
      res = `<span class="ok">Sin problemas</span><br><span style="font-size:8.5pt;color:#5b6475">${nota}</span>`;
    }
    return `<tr><td class="area">${esc(titulo)}</td><td>${esc(texto)}</td><td class="res">${res}</td></tr>`;
  }).join('');

  const incidentes = p.incidentes.length
    ? p.incidentes.map((i) => `
      <div class="incidente">
        <div><b>${esc({ ajuste: 'Actualización de pruebas', bloqueo: 'Pruebas frenadas por la protección anti-robots' }[i.causa] || i.areas.map((a) => NOMBRE_AREA[a][0].toUpperCase() + NOMBRE_AREA[a].slice(1)).join(' y '))}</b></div>
        <div class="cuando">Detectado: ${esc(fechaHora(i.inicio))} · ${i.fin ? `${{ ajuste: 'Prueba actualizada', bloqueo: 'Pruebas normalizadas' }[i.causa] || 'Funcionando de nuevo'}: ${esc(fechaHora(i.fin))}` : '<span class="bad">Sigue abierto al cierre del informe</span>'}</div>
        <div style="margin-top:4px">${esc(textoIncidente(i))}</div>
      </div>`).join('')
    : '<p>No hubo incidentes en la semana.</p>';

  const pantallas = pantallasProbadas(p);
  const pctOk = p.stats.rondas ? Math.round((1 - p.incidentes.filter((i) => i.causa === 'sitio').reduce((n, i) => n + i.corridas.length, 0) / p.stats.rondas) * 1000) / 10 : null;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe semanal · ${esc(p.nombre)}</title><style>${ESTILOS}</style></head><body>
    <div class="marca">Latech Factory · Monitoreo de calidad</div>
    <h1>${esc(p.nombre)}</h1>
    <p class="sub">${esc(p.url)}</p>
    <p class="sub">Informe semanal del ${esc(diaMes(rango.desde))} al ${esc(diaMes(rango.hasta))} · <span class="estado ${est.clase}">${esc(est.etiqueta)}</span></p>

    <div class="resumen">${esc(est.resumen)}${p.actividades?.length ? ` Además, esta semana hicimos ${plural(p.actividades.length, 'revisión manual', 'revisiones manuales')}; el detalle está al final.` : ''}</div>

    <div class="cifras">
      <div class="cifra"><b>${p.stats.rondas.toLocaleString('es-AR')}</b><span>rondas de prueba en la semana</span></div>
      <div class="cifra"><b>${p.stats.pruebas.toLocaleString('es-AR')}</b><span>pruebas individuales realizadas</span></div>
      <div class="cifra"><b>${pctOk === null ? '—' : `${pctOk.toLocaleString('es-AR')}%`}</b><span>de las rondas sin fallas en la tienda</span></div>
      ${pantallas.length ? `<div class="cifra"><b>${pantallas.length}</b><span>tamaños de pantalla y dispositivos</span></div>` : ''}
    </div>

    <h2>Qué revisamos y cómo salió</h2>
    <table><thead><tr><th>Área</th><th>Qué verificamos</th><th>Resultado</th></tr></thead><tbody>${filas}</tbody></table>

    ${pantallas.length ? `<h2>Pantallas y dispositivos</h2><div class="chips">${pantallas.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}

    <h2>Novedades de la semana</h2>
    ${incidentes}

    ${htmlActividades(p.actividades)}

    ${p.nota ? `<h2>Para tener en cuenta</h2><div class="nota">${esc(p.nota)}</div>` : ''}

    <div class="pie">
      Las pruebas se hacen solas, varias veces por día, como si fueran un cliente real navegando el sitio desde distintos dispositivos.
      Nunca se completan compras ni se envían formularios. Cuando una prueba falla, se repite a los pocos minutos antes de considerarla un problema,
      para descartar cortes momentáneos de internet; si se confirma, el equipo recibe un aviso en el momento.<br><br>${esc(FIRMA)}
    </div>
  </body></html>`;
}

function htmlInterno(lista, rango, rondas, pdfs, manual = []) {
  const filas = lista.map((p) => {
    const est = estadoProyecto(p);
    const delSitio = p.incidentes.filter((i) => i.causa === 'sitio').length;
    const ajustes = p.incidentes.filter((i) => i.causa !== 'sitio').length;
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eceef2"><b>${esc(p.nombre)}</b></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eceef2"><span class="estado ${est.clase}">${esc(est.etiqueta)}</span></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eceef2;text-align:right">${p.stats.rondas}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eceef2;text-align:right">${p.stats.pruebas.toLocaleString('es-AR')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eceef2;text-align:right">${delSitio}${ajustes ? ` <span style="color:#5b6475">(+${ajustes} de pruebas)</span>` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eceef2;text-align:right">${p.stats.recuperadas}</td>
    </tr>`;
  }).join('');

  const detalle = lista.filter((p) => p.incidentes.length).map((p) => `
    <p style="margin:14px 0 4px"><b>${esc(p.nombre)}</b></p>
    <ul style="margin:0;padding-left:18px">${p.incidentes.map((i) => `
      <li style="margin-bottom:6px">${esc(fechaHora(i.inicio))} → ${i.fin ? esc(fechaHora(i.fin)) : '<b>sigue abierto</b>'} · ${{ ajuste: `ajuste de pruebas (<i>${esc(i.commit)}</i>)`, bloqueo: 'bloqueo anti-robots en CI (no va como falla)' }[i.causa] || 'falla en la tienda'}
        <br><span style="color:#5b6475">${[...i.tests].map(([n, m]) => `${esc(n)}: ${esc(m)}`).join('<br>') || 'sin detalle en el log'}</span></li>`).join('')}
    </ul>`).join('');

  const avisos = Object.entries(rondas)
    .map(([wf, n]) => {
      const previstas = Math.round((rango.hasta - rango.desde) / 3600e3 / (FRECUENCIA_HORAS[wf] || 1));
      return n < previstas * 0.6 ? `<li>${esc(wf)}: corrió ${n} veces de ${previstas} previstas.</li>` : '';
    })
    .join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${ESTILOS} body{font-size:10.5pt;max-width:760px}</style></head><body>
    <p>Hola,</p>
    <p>Te paso el resumen de QA de la semana del ${esc(diaMes(rango.desde))} al ${esc(diaMes(rango.hasta))}.
    Adjunto va el informe de cada proyecto en PDF, escrito para poder reenviarlo tal cual al cliente.</p>
    <table style="border-collapse:collapse;width:100%;font-size:10pt">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px">Proyecto</th><th style="text-align:left;padding:6px 8px">Estado</th>
        <th style="text-align:right;padding:6px 8px">Rondas</th><th style="text-align:right;padding:6px 8px">Pruebas</th>
        <th style="text-align:right;padding:6px 8px">Incidentes</th><th style="text-align:right;padding:6px 8px">Fallas que se recuperaron solas</th>
      </tr></thead><tbody>${filas}</tbody></table>
    ${detalle ? `<h2>Detalle técnico (no va en los PDF)</h2>${detalle}` : ''}
    ${manual.length ? `<h2>Trabajo de QA manual de la semana</h2><ul style="padding-left:18px">${manual.map((a) => `
      <li style="margin-bottom:6px"><b>${esc(fechaCorta(a.fecha))} · ${esc(a.proyectos.map((id) => lista.find((p) => p.id === id)?.nombre || id).join(', '))}</b>: ${esc(a.titulo)} (${esc(a.resultado)})${a.informe ? ` · <a href="${esc(a.informe)}">informe completo</a>` : ''}</li>`).join('')}</ul>` : ''}
    ${avisos ? `<h2>Para revisar</h2><p>GitHub no disparó todas las corridas programadas:</p><ul>${avisos}</ul>` : ''}
    <p style="margin-top:18px">PDF adjuntos: ${pdfs.length}.</p>
    <p>Saludos,<br>${esc(FIRMA)}</p>
  </body></html>`;
}

// ---------------------------------------------------------------------------------------------

async function main() {
  if (!TOKEN) throw new Error('Falta GITHUB_TOKEN (o GH_TOKEN) para leer las corridas de GitHub Actions.');
  const rango = periodo();
  console.log(`Período: ${rango.desde.toISOString()} → ${rango.hasta.toISOString()}`);

  const lista = proyectos();
  const tests = listarTests();
  // La suite multi-resolución corre un lote por ronda (ver tests/config/resoluciones.js).
  const lotes = new Set(resoluciones.map((r) => r.lote)).size || 1;
  for (const p of lista) {
    for (const su of p.suites) {
      su.cantidad = tests.filter(su.contar).length;
      if (su.clave === 'resoluciones') su.cantidad = Math.round(su.cantidad / lotes);
    }
  }

  const rondas = await recolectar(lista, rango);
  const enPeriodo = actividadesDelPeriodo(rango);
  for (const p of lista) p.actividades = enPeriodo.filter((a) => a.proyectos.includes(p.id));
  fs.mkdirSync(SALIDA, { recursive: true });

  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pdfs = [];
  const fechaArchivo = diaMes(rango.hasta).replace('/', '-');
  for (const p of lista) {
    const html = htmlProyecto(p, rango);
    const base = `Informe QA ${p.nombre.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ+.-]/g, '')} ${fechaArchivo}`;
    fs.writeFileSync(path.join(SALIDA, `${base}.html`), html);
    await page.setContent(html, { waitUntil: 'load' });
    const destino = path.join(SALIDA, `${base}.pdf`);
    await page.pdf({
      path: destino,
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' },
    });
    pdfs.push(destino);
    console.log(`  • ${p.nombre}: ${estadoProyecto(p).etiqueta} (${p.stats.rondas} rondas, ${p.incidentes.length} incidentes)`);
  }
  await browser.close();

  const interno = htmlInterno(lista, rango, rondas, pdfs, enPeriodo);
  fs.writeFileSync(path.join(SALIDA, 'mail-interno.html'), interno);
  console.log(`Listo: ${pdfs.length} PDF y mail-interno.html en ${SALIDA}`);

  if (!ENVIAR) return;
  const destinatarios = (process.env.REPORTE_DESTINATARIOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!destinatarios.length || !process.env.MAIL_USERNAME || !process.env.MAIL_PASSWORD) {
    throw new Error('Para enviar faltan REPORTE_DESTINATARIOS, MAIL_USERNAME o MAIL_PASSWORD.');
  }
  const nodemailer = require('nodemailer');
  const transporte = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
  });
  const info = await transporte.sendMail({
    from: { name: FIRMA.split('·')[0].trim(), address: process.env.MAIL_USERNAME },
    to: destinatarios,
    subject: `Informe semanal de QA · ${diaMes(rango.desde)} al ${diaMes(rango.hasta)}`,
    html: interno,
    attachments: pdfs.map((f) => ({ filename: path.basename(f), path: f })),
  });
  console.log(`Mail enviado a ${destinatarios.length} destinatario(s): ${info.messageId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
