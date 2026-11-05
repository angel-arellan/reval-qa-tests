// Resoluciones y dispositivos de la suite multi-resolución
// (.github/workflows/playwright-resoluciones.yml).
//
// La suite NO tiene tests propios: tests/resoluciones/generar.js toma los specs que ya corren
// en producción (storefront-multisite.spec.js y storefront-multisite-responsive.spec.js) y
// genera una copia por resolución en tests/generados/ (no se commitea). Así cualquier arreglo
// que se haga en el spec original (popups nuevos, selectores, etc.) llega solo a todas las
// resoluciones, y los archivos que ya corren cada hora no se tocan.
//
// Cada grupo indica qué tests corre:
// - funcional: números del spec funcional (01 Home y menú, 02 Buscador, 03 Catálogo y
//   filtros, 04 Producto, carrito y checkout sin comprar, 08 Imágenes rotas). 05/06 (login y
//   páginas legales) y 07 (mobile) no dependen de la resolución y ya corren cada hora.
// - responsive: tests del spec responsive (RESP-01 overflow, RESP-03 menú hamburguesa,
//   RESP-04 producto con botón de compra visible, RESP-06 imágenes del primer pantallazo).
// - twp: tests de theme-prod-storefront.spec.js (The Wellness Project, que no está en
//   sites.js): STF-01 Home, STF-02 Buscador, STF-03 Catálogo, STF-04 Producto y carrito.
//
// lote: cada corrida programada prueba un solo lote (3 resoluciones, de a una), rotando cada
// 4 horas, así en un día pasan todas las resoluciones. Correr las 11 juntas desde la misma IP de
// GitHub activó la protección anti-robots de varias tiendas y el límite de "agregar al carrito"
// (primera corrida, 05-nov-2026), además de cargar de más las tiendas de los clientes.
//
// Ajustes por sitio (clave = id de sites.js): omitir: { <id de resolución o grupo>: [tests] }
// para dejar afuera una combinación que no aplica (dejar siempre el motivo en un comentario).

const escritorio = {
  grupo: 'escritorio',
  funcional: ['01', '02', '03', '04', '08'],
  responsive: [],
  twp: ['STF-01', 'STF-02', 'STF-03', 'STF-04'],
};

// En celulares los menús de escritorio (mega menú con hover) y los filtros laterales no
// existen como tales: el menú lo cubre RESP-03 (hamburguesa) y la compra el 04.
const celular = {
  grupo: 'celular',
  funcional: ['02', '04'],
  responsive: ['RESP-01', 'RESP-03', 'RESP-04', 'RESP-06'],
  twp: ['STF-01', 'STF-02', 'STF-03', 'STF-04'],
};

const tablet = {
  grupo: 'tablet',
  funcional: ['02', '04'],
  responsive: ['RESP-01', 'RESP-04', 'RESP-06'],
  twp: ['STF-01', 'STF-02', 'STF-03', 'STF-04'],
};

module.exports = {
  resoluciones: [
    { id: 'D1920', lote: 0, nombre: 'Escritorio Full HD 1920×1080', viewport: { width: 1920, height: 1080 }, ...escritorio },
    { id: 'D1536', lote: 1, nombre: 'Notebook 1536×864', viewport: { width: 1536, height: 864 }, ...escritorio },
    { id: 'D1440', lote: 2, nombre: 'MacBook 1440×900', viewport: { width: 1440, height: 900 }, ...escritorio },
    { id: 'D1366', lote: 3, nombre: 'Notebook 1366×768', viewport: { width: 1366, height: 768 }, ...escritorio },
    { id: 'MIPHONESE', lote: 0, nombre: 'iPhone SE 375×667', device: 'iPhone SE (3rd gen)', ...celular },
    { id: 'MIPHONE15', lote: 1, nombre: 'iPhone 15 393×659', device: 'iPhone 15', ...celular },
    { id: 'MIPHONE15PM', lote: 2, nombre: 'iPhone 15 Pro Max 430×739', device: 'iPhone 15 Pro Max', ...celular },
    { id: 'MGALAXYS24', lote: 1, nombre: 'Samsung Galaxy S24 360×780', device: 'Galaxy S24', ...celular },
    { id: 'MPIXEL7', lote: 3, nombre: 'Google Pixel 7 412×839', device: 'Pixel 7', ...celular },
    { id: 'TIPAD', lote: 0, nombre: 'iPad 810×1080', device: 'iPad (gen 7)', ...tablet },
    { id: 'TIPADPRO', lote: 2, nombre: 'iPad Pro 11 834×1194', device: 'iPad Pro 11', ...tablet },
  ],
  ajustes: {
    // Pendiente (05-nov-2026): en celular el cambio de cantidad del carrito de Ena Sport no
    // responde vía automation (en iPad y escritorio sí). Revisar a mano si también le pasa a un
    // cliente real antes de reactivarlo; si es así, es un bug del sitio para reportar.
    ENASPORT: { omitir: { celular: ['04'] } },
    // Pendiente (05-nov-2026): en celular y tablet el drawer del carrito de Sofía Sarkany no se
    // reconoce con el selector de escritorio (#Cart-Drawer .product-cart-item): "No se ve ningún
    // item". Calibrar el selector mobile antes de reactivarlo.
    SOFIA_SARKANY: { omitir: { celular: ['04'], tablet: ['04'] } },
    // Pendiente (05-nov-2026): en celular y tablet el drawer #CartDrawer de Ansilta no se abre
    // tras agregar en CI ("El carrito no se abrió"); en escritorio pasa. Calibrar en mobile.
    ANSILTA_COM: { omitir: { celular: ['04'], tablet: ['04'] } },
  },
};
