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
// - revisamosExtra: filas extra de "Qué revisamos" para un sitio de sites.js (mismo formato).
//   Una cuarta posición opcional fija el texto del resultado (ej. 'Revisión manual') para algo
//   que no se verifica de forma automática.
// - excluir: ids que no deben generar PDF.
// El trabajo de QA manual de cada semana se carga en tests/config/actividades-qa.js.

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
          // Los módulos del admin quedan "sin verificar" en GitHub (Shopify pide login): no se
          // cuentan como pruebas realizadas.
          excluirTitulos: /^PROD - TC/,
        },
      ],
      revisamos: [
        ['inicio', 'Página de inicio y menú', 'La tienda carga sin errores, se ven el logo y el pie de página y el menú lleva a las secciones.'],
        ['buscador', 'Buscador', 'Buscar un producto devuelve resultados.'],
        ['catalogo', 'Catálogo', 'Las categorías muestran productos.'],
        ['compra', 'Producto, carrito y checkout', 'Se agrega un producto en compra única y en suscripción, se revisa el carrito y se llega hasta la página de pago, sin comprar.'],
        ['cuenta', 'Cuenta de cliente', 'El ingreso a la cuenta y las secciones de pedidos, perfil y suscripciones cargan correctamente.'],
        ['cuenta', 'Páginas legales', 'Términos y condiciones y política de privacidad están accesibles.'],
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
          archivos: ['reval-smoke-regression.spec.js', 'reval-customer-portal-stg.spec.js', 'reval-storefront-stg.spec.js'],
          excluirTitulos: /^STG - TC/,
        },
      ],
      revisamos: [
        ['compra', 'Compra con suscripción', 'En la tienda de prueba nos suscribimos a un producto, revisamos el carrito de suscripciones, llegamos al checkout de Reval con su formulario completo y volvemos: el carrito tiene que seguir intacto. Nunca se paga.'],
        ['compra', 'Compra única', 'Agregamos un producto sin suscripción, llegamos al checkout de Shopify y volvemos al carrito.'],
        ['celular', 'Desde el celular', 'El mismo recorrido de suscripción hasta el checkout y vuelta, en un iPhone.'],
        ['cuenta', 'Portal del suscriptor', 'Pedidos, suscripciones, perfil y páginas legales del portal cargan correctamente.'],
        ['admin', 'Panel de administración (14 secciones)', 'Inicio, suscripciones, clientes, pedidos, planes, productos, cajas, sorpresas, herramientas, facturación, API & MCP, integraciones, notificaciones y configuración. Shopify no deja entrar al panel a las pruebas automáticas desde la nube, así que se revisa con sesión en cada QA manual.', 'Revisión manual'],
      ],
    },
  ],

  notas: {
    SWISSGEAR_COM:
      'La prueba automática de carrito y checkout está en pausa en esta tienda mientras confirmamos la corrección de un problema al cambiar cantidades dentro del carrito.',
    LUSSOCLOUD:
      'En la ficha de producto, después de elegir talle o color, el botón para agregar al carrito deja de responder por un error del tema. Ya está reportado; mientras se corrige, la prueba automática de carrito y checkout queda en pausa.',
    ADEPAC:
      'El botón «Comprar» de la ficha de producto lleva a la publicación de Mercado Libre en lugar de agregar al carrito de la tienda. Si es intencional no hace falta ningún cambio; por eso la prueba de carrito y checkout queda en pausa.',
    INTI_TEA_PROFESIONAL:
      'Al ser una tienda mayorista, los precios y la compra solo se ven con una cuenta aprobada, así que el carrito y el checkout no se prueban como visitante.',
  },

  revisamosExtra: {
    LATECH_FACTORY: [
      ['inicio', 'Todas las páginas', 'Todas las páginas del sitio (servicios, casos, blog, nosotros, empleos y contacto) responden sin errores.'],
      ['inicio', 'Menú, casos y blog', 'Cada opción del menú lleva a su sección, y se abren un caso de éxito y un artículo del blog sin imágenes rotas.'],
      ['contacto', 'Formulario de contacto', 'El formulario está visible y habilitado, con su botón de envío. Nunca se completa ni se envía.'],
    ],
  },

  excluir: [],
};
