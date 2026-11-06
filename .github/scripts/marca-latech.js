// Marca Latech para piezas generadas por código (informe semanal de QA, PDF y mail).
// Los valores salen del brandbook: .claude/skills/latech-brandbook/SKILL.md. Si cambia la marca,
// se cambia ahí y acá.

const fs = require('fs');
const path = require('path');

const ASSETS = path.resolve(__dirname, '../../.claude/skills/latech-brandbook/assets');

const COLORES = {
  azul: '#2447A4',
  azulClaro: '#E9EDF8',
  negro: '#000000',
  tinta: '#171717',
  blanco: '#FFFFFF',
  pizarra: '#23303B',
  grisFondo: '#F5F5F5',
  grisBorde: '#D1D5DB',
  grisTexto: '#8C939E',
};

const FUENTE = "'DM Sans', Helvetica, Arial, sans-serif";
const FUENTE_LINK = '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..700&display=swap" rel="stylesheet">';

// Los SVG oficiales son de 800×800 con el logo chico en el centro: se recorta el viewBox.
const RECORTES = {
  'logo-completo-contenedor': [251.5, 376.5, 297, 47],
  'logo-completo': [253.2, 378.2, 293.5, 43.6],
  'isologo-contenedor': [353, 353, 94, 94],
  isologo: [358.2, 358.2, 83.6, 83.6],
};

// logoSvg('logo-completo-azul', 26) → <svg> recortado de 26 px de alto, listo para insertar.
function logoSvg(nombre, alto) {
  const svg = fs.readFileSync(path.join(ASSETS, `${nombre}.svg`), 'utf8');
  const tipo = Object.keys(RECORTES).find((k) => nombre.startsWith(k));
  const [x, y, w, h] = RECORTES[tipo];
  const ancho = Math.round((alto * w) / h);
  return svg.replace(/width="800" height="800" viewBox="0 0 800 800"/, `width="${ancho}" height="${alto}" viewBox="${x} ${y} ${w} ${h}"`).trim();
}

const proporcion = (nombre) => {
  const [, , w, h] = RECORTES[Object.keys(RECORTES).find((k) => nombre.startsWith(k))];
  return w / h;
};

module.exports = { COLORES, FUENTE, FUENTE_LINK, logoSvg, proporcion };
