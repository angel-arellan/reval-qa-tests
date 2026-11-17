// Control de las corridas programadas del informe semanal (.github/workflows/reporte-semanal.yml).
//
// GitHub larga los horarios programados con demoras de hasta 10 h o directamente no los larga,
// así que el workflow tiene varios horarios desde la madrugada del lunes. Este script:
// 1. Si el informe de esta semana ya salió (corrida exitosa titulada "Informe semanal" desde el
//    lunes 00:00 de Argentina), escribe enviado=si en GITHUB_OUTPUT y la corrida no hace nada.
// 2. Si todavía no salió y es lunes antes de las 08:27 (Argentina), espera hasta esa hora: el
//    informe tarda ~3 min en armarse y llega 08:30. Mientras espera, las demás corridas
//    programadas quedan en cola (concurrency) y después ven que ya salió.
// 3. Si es más tarde, sigue y se manda en el momento.
//
// Prueba local sin esperar: AHORA=2026-11-23T06:10:00Z SIN_ESPERAR=1 GH_TOKEN=... \
//   GITHUB_REPOSITORY=angel-arellan/reval-qa-tests node .github/scripts/informe-semanal-control.js

const fs = require('fs');

const ahora = () => (process.env.AHORA ? new Date(process.env.AHORA) : new Date());
const REPO = process.env.GITHUB_REPOSITORY;
const RUN_ID = Number(process.env.GITHUB_RUN_ID || 0);
// Título de las corridas que mandan el informe a todos (run-name del workflow). Hasta el 17-nov
// las corridas se titulaban con el nombre del workflow: se cuentan también.
const TITULOS = ['Informe semanal', 'Informe semanal de QA por mail (lunes)'];
const ESPERA_MAXIMA = 340 * 60e3; // el job tiene 360 min de límite

// Lunes 00:00 de esta semana en Argentina (UTC-3, sin horario de verano), en milisegundos UTC.
function lunesDeEstaSemana(fecha) {
  const art = new Date(fecha.getTime() - 3 * 3600e3);
  const dow = (art.getUTCDay() + 6) % 7;
  return Date.UTC(art.getUTCFullYear(), art.getUTCMonth(), art.getUTCDate() - dow) + 3 * 3600e3;
}

async function yaSalio(desde) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/reporte-semanal.yml/runs?status=success&per_page=50`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'informe-semanal-control' },
  });
  if (!r.ok) throw new Error(`GitHub respondió ${r.status} al listar las corridas del informe`);
  const { workflow_runs: corridas } = await r.json();
  return corridas.filter((c) => c.id !== RUN_ID && TITULOS.includes(c.display_title) && new Date(c.created_at).getTime() >= desde).length;
}

function salida(clave, valor) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`);
  console.log(`→ ${clave}=${valor}`);
}

(async () => {
  const lunes = lunesDeEstaSemana(ahora());
  // Solo lunes y martes (Argentina): si GitHub larga un horario con días de atraso, no se manda.
  if ((ahora().getTime() - lunes) / 864e5 >= 2) {
    console.log('Ya no es lunes ni martes en Argentina: no se manda.');
    return salida('enviado', 'si');
  }
  const objetivo = lunes + (8 * 60 + 27) * 60e3; // lunes 08:27 Argentina
  const previos = await yaSalio(lunes);
  console.log(`Informes enviados desde el lunes ${new Date(lunes).toISOString()}: ${previos}`);
  if (previos > 0) return salida('enviado', 'si');

  const falta = objetivo - ahora().getTime();
  if (falta <= 0) return console.log('Ya pasaron las 08:27 del lunes: se manda ahora.');
  if (falta > ESPERA_MAXIMA) {
    console.log(`Faltan ${Math.round(falta / 60e3)} min para las 08:27: demasiado temprano, lo manda un horario posterior.`);
    return salida('enviado', 'si');
  }
  console.log(`Espero ${Math.round(falta / 60e3)} min, hasta las 08:27 (Argentina), para mandarlo 08:30.`);
  if (!process.env.SIN_ESPERAR) await new Promise((r) => setTimeout(r, falta));
  // Por si mientras tanto alguien lo mandó a mano.
  if ((await yaSalio(lunes)) > 0) return salida('enviado', 'si');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
