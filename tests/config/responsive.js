// Ajustes por sitio para la suite responsive (storefront-multisite-responsive.spec.js).
//
// La lista de sitios sale de tests/config/sites.js; acá solo van excepciones por id de
// sitio. Un sitio sin entrada corre todos los chequeos con la detección genérica.
//
// Claves soportadas (todas opcionales):
// - menuMobile: { toggle: '<selector>' } — botón del menú hamburguesa cuando la detección
//   genérica no lo encuentra. menuMobile: false si el sitio no tiene menú hamburguesa.
// - precioVisible: false — tienda que oculta precios (B2B / cotización).
// - compraVisible: false — tienda que oculta el botón de compra a usuarios sin login.

module.exports = {
  ADEPAC: { precioVisible: false },
  // Mayorista: precios y botón de compra solo para clientes registrados y logueados.
  INTI_TEA_PROFESIONAL: { precioVisible: false, compraVisible: false },
};
