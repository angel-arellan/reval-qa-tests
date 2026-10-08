// Alerta de Slack unificada para todos los workflows de Playwright.
//
// Lee el reporte JSON de Playwright (de la pasada de CONFIRMACIÓN, o sea fallas que se
// repitieron en 6 intentos) y manda a Slack QUÉ falló y POR QUÉ, en lenguaje claro.
// Si no hay ningún test fallido en el reporte (ej. el job falló instalando dependencias,
// un problema de GitHub y no de la tienda) NO se manda alerta: solo se avisa cuando algo
// que el cliente usa no funciona.
//
// Uso: node .github/scripts/alerta-slack.js "<título>" "<sitio>" "<url del sitio>"
// Env: SLACK_WEBHOOK, RUN_URL, REPORTE (default resultados.json)

const fs = require('fs');

const [titulo, sitio, urlSitio] = process.argv.slice(2);
const reporte = process.env.REPORTE || 'resultados.json';

const limpiar = (t) => (t || '').replace(/\u001b\[[0-9;]*m/g, '').trim();

// Traduce los errores genéricos de Playwright a algo que se entienda sin abrir el reporte.
function motivo(errores) {
  const msgs = errores.map((e) => limpiar(e.message)).filter(Boolean);
  // Los mensajes propios de los tests ("No se encontró el botón de...") son los más claros.
  const propio = msgs
    .map((m) => m.split('\n')[0].replace(/^Error:\s*/, ''))
    .find((m) => !/^(Test timeout|Timeout|page\.|locator\.|expect\(|TimeoutError|Target page)/i.test(m));
  if (propio) return propio.slice(0, 300);
  const todo = msgs.join('\n');
  if (/Test timeout|Target page, context or browser has been closed/i.test(todo)) {
    const paso = todo.match(/waiting for (locator\([^\n]+?\))/i);
    return `La página no respondió a tiempo (el test se quedó esperando${paso ? ` ${paso[1].slice(0, 120)}` : ''})`;
  }
  if (/page\.goto|net::ERR|ERR_/i.test(todo)) {
    const m = todo.match(/(net::ERR_[A-Z_]+|ERR_[A-Z_]+)?\s*at (https?:\/\/\S+)/);
    return `La página no cargó${m ? `: ${m[2]}${m[1] ? ` (${m[1]})` : ''}` : ' (error de red o del servidor)'}`;
  }
  return (msgs[0] || 'Error sin detalle').split('\n')[0].replace(/^Error:\s*/, '').slice(0, 300);
}

function fallidos() {
  if (!fs.existsSync(reporte)) return [];
  const r = JSON.parse(fs.readFileSync(reporte, 'utf8'));
  const out = [];
  const walk = (s) => {
    (s.suites || []).forEach(walk);
    (s.specs || []).forEach((sp) => {
      sp.tests.forEach((t) => {
        if (['expected', 'skipped', 'flaky'].includes(t.status)) return;
        const ultimo = t.results[t.results.length - 1] || {};
        const nombre = sp.title.replace(/^[A-Z0-9_]+-(?=[A-Z0-9-]*\d+:)/, '').replace(/^[A-Z-]*\d+:\s*/, '');
        out.push({ nombre, motivo: motivo(ultimo.errors || (ultimo.error ? [ultimo.error] : [])) });
      });
    });
  };
  (r.suites || []).forEach(walk);
  return out;
}

async function main() {
  const lista = fallidos();
  if (!lista.length) {
    console.log('Sin tests fallidos en el reporte: la falla fue del entorno de CI, no de la tienda. No se alerta.');
    return;
  }
  const texto =
    `🚨 *${titulo}${sitio ? ` - ${sitio}` : ''}*\n` +
    (urlSitio ? `🌐 ${urlSitio}\n` : '') +
    `\n❌ *Qué falló* (confirmado: falló 6 veces en dos pasadas separadas):\n` +
    lista.map((f) => `• *${f.nombre}:* ${f.motivo}`).join('\n') +
    (process.env.RUN_URL ? `\n\n🔗 Reporte con capturas: ${process.env.RUN_URL}` : '');
  console.log(texto);
  if (!process.env.SLACK_WEBHOOK) return console.log('SLACK_WEBHOOK no definido: no se envía.');
  const res = await fetch(process.env.SLACK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto }),
  });
  console.log(`Slack respondió ${res.status}`);
}

main().catch((e) => {
  console.error(e);
});
