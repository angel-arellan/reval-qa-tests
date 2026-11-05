// Textos y proyectos del informe semanal de QA (.github/scripts/reporte-semanal.js).
//
// Los sitios de tests/config/sites.js entran solos al informe (un PDF por tienda). Acá solo
// van:
// - extras: proyectos que no están en sites.js (Reval y The Wellness Project, que corren en
//   .github/workflows/playwright.yml). Cada suite dice de qué workflow y job salen sus
//   resultados, y qué archivos (o prefijo de título) cuentan sus pruebas. revisamos es la
//   tabla "Qué revisamos" del PDF: [área, título, explicación]; el área une la fila con las
//   fallas de la semana (inicio, buscador, catalogo, compra, cuenta, celular, tecnico, admin).
// - notas: texto para el cliente, en lenguaje simple, sobre algo conocido de su tienda que
//   hace que una prueba esté en pausa (sites.js guarda el detalle técnico en
//   knownProductionBug; ese texto NO se manda al cliente).
// - excluir: ids que no deben generar PDF.

module.exports = {
  extras: [
    {
      id: 'TWP',
      nombre: 'The Wellness Project',
      url: 'https://www.thewellnessproject.com.ar',
      suites: [
        { clave: 'twp-tienda', workflow: 'playwright.yml', job: 'Storefront Theme Tests', archivos: ['theme-prod-storefront.spec.js'] },
        { clave: 'resoluciones', workflow: 'playwright-resoluciones.yml', job: 'Resoluciones - The Wellness Project', prefijo: 'TWP-' },
        {
          clave: 'reval-prod',
          workflow: 'playwright.yml',
          job: 'Production Environment Tests',
          archivos: ['reval-prod-regression.spec.js', 'reval-customer-portal-prod.spec.js'],
        },
      ],
      revisamos: [
        ['inicio', 'Página de inicio y menú', 'La tienda carga sin errores, se ven el logo y el pie de página y el menú lleva a las secciones.'],
        ['buscador', 'Buscador', 'Buscar un producto devuelve resultados.'],
        ['catalogo', 'Catálogo', 'Las categorías muestran productos.'],
        ['compra', 'Producto, carrito y checkout', 'Se agrega un producto en compra única y en suscripción, se revisa el carrito y se llega hasta la página de pago, sin comprar.'],
        ['cuenta', 'Cuenta de cliente', 'El ingreso a la cuenta y las secciones de pedidos, perfil y suscripciones cargan correctamente.'],
        ['cuenta', 'Páginas legales', 'Términos y condiciones y política de privacidad están accesibles.'],
        ['admin', 'Panel de suscripciones (Reval)', 'Las 9 secciones del panel de administración de suscripciones abren sin errores.'],
      ],
    },
    {
      id: 'REVAL_STG',
      nombre: 'Reval (entorno de pruebas)',
      url: 'Tienda de prueba mp-subscriptions',
      interno: true,
      suites: [
        {
          clave: 'reval-stg',
          workflow: 'playwright.yml',
          job: 'Staging Environment Tests',
          archivos: ['reval-smoke-regression.spec.js', 'reval-customer-portal-stg.spec.js'],
        },
      ],
      revisamos: [
        ['admin', 'Panel de administración', 'Las 9 secciones del panel (inicio, suscripciones, clientes, pedidos, planes, productos, sorpresas, herramientas y configuración) abren sin errores.'],
        ['cuenta', 'Portal del cliente', 'Pedidos, suscripciones, perfil y páginas legales del portal del suscriptor cargan correctamente.'],
      ],
    },
  ],

  notas: {
    SWISSGEAR_COM:
      'Cambiar la cantidad de un producto dentro del carrito no se actualiza correctamente. Ya está reportado; mientras se corrige, la prueba automática de carrito y checkout queda en pausa para no generar avisos repetidos.',
    LUSSOCLOUD:
      'En la ficha de producto, después de elegir talle o color, el botón para agregar al carrito deja de responder por un error del tema. Ya está reportado; mientras se corrige, la prueba automática de carrito y checkout queda en pausa.',
    ADEPAC:
      'El botón «Comprar» de la ficha de producto lleva a la publicación de Mercado Libre en lugar de agregar al carrito de la tienda. Si es intencional no hace falta ningún cambio; por eso la prueba de carrito y checkout queda en pausa.',
    INTI_TEA_PROFESIONAL:
      'Al ser una tienda mayorista, los precios y la compra solo se ven con una cuenta aprobada, así que el carrito y el checkout no se prueban como visitante.',
  },

  excluir: [],
};
