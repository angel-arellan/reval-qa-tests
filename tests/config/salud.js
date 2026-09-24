// Ajustes por sitio para la suite de salud técnica (storefront-multisite-salud.spec.js).
//
// La lista de sitios sale de tests/config/sites.js (única fuente de verdad); este archivo
// solo guarda excepciones puntuales por id de sitio, para no tocar sites.js ni el spec
// funcional que ya corre en producción. Un sitio sin entrada acá corre todos los chequeos
// con los valores por defecto.
//
// Claves soportadas (todas opcionales):
// - tracking: false — el sitio no tiene GA4/GTM/Meta Pixel detectable (o lo carga solo tras
//   aceptar cookies). Salta el chequeo SALUD-05.
// - ignorarRecursos: [RegExp] — URLs de recursos propios que fallan de forma conocida y que
//   no queremos que alerten cada 2 horas (dejar siempre un comentario con el motivo).
// - ignorarErroresJs: [RegExp] — mensajes de excepciones JS conocidas a ignorar.
// - ignorarLinks: [RegExp] — hrefs de header/footer a excluir del chequeo de links.
// - precioVisible: false — tienda B2B que oculta precios a usuarios sin login. SALUD-07 solo
//   valida el precio contra el dato de Shopify (/products/<handle>.js), no en pantalla.
//
// LÍNEA BASE: los errores que ya existían en producción al crear la suite (sep-2026) se
// registran acá para que la alerta de Slack salte solo ante errores NUEVOS. No son
// falsos positivos: son bugs reales del theme, informados para que se corrijan. Cuando se
// arreglen, borrar la entrada para que el chequeo vuelva a cubrirlos.
//
// Regla de oro: son tiendas productivas de clientes. Esta suite solo LEE (navega y hace GET);
// nunca agrega al carrito, envía formularios, ni crea pedidos.

module.exports = {
  LUSSOCLOUD: {
    // Línea base: vendor.js del theme (t/201) tira "Cannot read properties of null (reading
    // 'dataset')" en la PDP.
    ignorarErroresJs: [/reading 'dataset'/],
  },
  ENASPORT: {
    // Línea base: MegaMenuPromoCarousel.connectedCallback (theme.js, t/41) tira "reading
    // 'classList'" en la PDP.
    ignorarErroresJs: [/reading 'classList'/],
  },
  SOFIA_SARKANY: {
    // Línea base: full-menu-horizontal.js (theme t/1641) usa debounce() antes de que esté
    // definido ("debounce is not defined"). Intermitente, depende del orden de carga.
    ignorarErroresJs: [/debounce is not defined/],
  },
  ADEPAC: {
    // La PDP no muestra precio en pantalla (solo SKU, título y "Comprar"), aunque Shopify sí
    // tiene precio cargado. Parece modelo de cotización B2B ("Cotizar" en el header).
    // Confirmar con el cliente si es intencional; si no lo es, borrar esta línea.
    precioVisible: false,
  },
  INTI_TEA_PROFESIONAL: {
    // Tienda mayorista: los precios solo se muestran a clientes registrados y logueados.
    precioVisible: false,
  },
};
