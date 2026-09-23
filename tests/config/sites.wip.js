// Sitios en investigación para el sistema multisite (tests/storefront-multisite.spec.js),
// TODAVÍA NO sumados a tests/config/sites.js a propósito.
//
// Por qué existe este archivo separado: tests/config/sites.js alimenta directamente la matrix
// dinámica de .github/workflows/playwright-multisite.yml (corre cada 1 hora y avisa por Slack
// por sitio si falla). Meter acá un sitio con selectores todavía sin confirmar generaría
// alertas horarias ruidosas por cosas que ya se sabe que faltan, no por bugs reales. Este
// archivo NO es leído por el spec ni por el workflow — es solo un lugar para no perder el
// trabajo de reconocimiento ya hecho hasta la próxima sesión.
//
// Para retomar un sitio: mové su bloque de acá a sites.js, corré
// `npx playwright test tests/storefront-multisite.spec.js --grep "<ID>-"` y arreglá lo que
// marque el TODO con evidencia real (no adivinando) antes de dejarlo pasar a producción.
//
// Estado al cierre de esta sesión (16 sitios investigados en total — ver conversación):

module.exports = [
  // ─────────────────────────────────────────────────────────────────────────────────────
  // AILUYANDI — 6/7 tests pasan. Falta: AILUYANDI-04 (carrito) es intermitente.
  // El drawer real (<cart-drawer id="cart-drawer"> con display:contents) a veces tarda más
  // en poblarse de lo que el chequeo de "el carrito abrió" espera. El fix genérico de
  // drawer.or(item).first() en el spec ya lo resuelve la mayoría de las veces (funcionó en
  // un re-run aislado) pero falló en la corrida combinada. Antes de sumarlo: correr
  // AILUYANDI-04 solo, 3-4 veces seguidas, para confirmar si es realmente flaky o hay algo
  // más (quizás aumentar el wait fijo de 1000ms tras el click en agregarProductoAlCarrito()
  // ayude, pero eso es compartido con todos los sitios — no cambiar sin verificar que no
  // rompe nada más).
  {
    id: 'AILUYANDI',
    name: 'Ailu y Andi',
    baseUrl: 'https://ailuyandi.com',
    search: { term: 'curso' },
    header: {
      hasMegaMenu: false,
    },
    collection: {
      path: '/collections/nuestros-cursos',
      filters: { enabled: false },
    },
    pdp: {
      path: '/products/curso-02-de-cocina-con-ailu-y-andi',
      variantType: 'none',
      variantInputSelector: null,
      quantitySelector: null,
      addToCartSelector: 'buy-buttons button[type="submit"]',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#cart-drawer',
      itemSelector: 'line-item',
      quantityIncreaseSelector: 'a.quantity-selector__button:has(svg.icon-quantity-plus)',
      quantityDecreaseSelector: 'a.quantity-selector__button:has(svg.icon-quantity-minus)',
      quantityDisplay: { type: 'input', selector: 'input.quantity-selector__input' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
  // ─────────────────────────────────────────────────────────────────────────────────────
  // COMFRT — 6/7 tests pasan. Falta: COMFRT_COM-04 (carrito).
  // containerSelector '#drawers-cart-closed' resuelve pero queda "hidden" tras agregar — el
  // nombre del id ("closed") sugiere que hay que buscar el contenedor real cuando está
  // ABIERTO (probablemente algo como '#drawers-cart' sin el sufijo, o un atributo/clase que
  // cambia al abrir). Además itemSelector sigue sin confirmar. Es un storefront headless
  // custom (constructor "Bite", clases CSS-modules hasheadas) — inspeccionar en vivo con
  // Playwright después de un add-to-cart real, no adivinar por el HTML estático.
  // También pendiente: confirmar si el toggle "Filters" realmente cambia la URL con
  // "filter" en el string (se dejó filters.enabled: false por las dudas).
  {
    id: 'COMFRT_COM',
    name: 'Comfrt',
    baseUrl: 'https://comfrt.com',
    search: { term: 'hoodie' },
    header: {
      hasMegaMenu: false,
    },
    collection: {
      path: '/collections/hoodies',
      filters: {
        enabled: false, // TODO: existe boton "Filters" pero no se confirmo si la URL resultante contiene "filter" (storefront headless custom)
        toggleSelector: 'button:has-text("Filters")',
        labelSelector: null,
      },
    },
    pdp: {
      path: '/products/minimalist-hoodie',
      variantType: 'radio-label',
      variantInputSelector: 'button[class*="colorOption"]',
      quantitySelector: null,
      addToCartSelector: 'button[class*="addButton"]',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#drawers-cart-closed', // TODO: confirmado que queda "hidden" tras agregar, buscar el selector del estado abierto
      itemSelector: null, // TODO: pendiente de correr el spec real para confirmar
      quantityIncreaseSelector: null,
      quantityDecreaseSelector: null,
      quantityDisplay: null,
      checkoutButtonSelector: 'button:has-text("Checkout")',
    },
  },
  // ─────────────────────────────────────────────────────────────────────────────────────
  // GYMKHANA FINE FOODS — 1/7 tests pasan (solo Login). BLOQUEADO, no es tema de selectores.
  // Confirmado en 2 corridas separadas (con ~1 hora de diferencia): TODAS las páginas
  // (Home, Búsqueda, Catálogo, PDP, Políticas, mobile) tiran timeout de 60s en
  // `page.locator('body').innerText()` — la página queda en blanco, nunca termina de
  // cargar/hidratar en Playwright headless. El único test que pasa (Login) es justamente
  // el único que no llama a validarSinErrores() del mismo modo... en realidad sí lo llama,
  // raro que pase. Antes de reintentar sumar este sitio: correr una vez más para descartar
  // que sea algo transitorio, y si persiste, sospechar de un bloqueo anti-bot específico
  // (posiblemente geo-IP o fingerprinting de Chromium headless) — no es un problema del
  // spec ni de los selectores configurados abajo, que igual quedan sin confirmar.
  {
    id: 'GYMKHANA_FF',
    name: 'Gymkhana Fine Foods',
    baseUrl: 'https://www.gymkhanafinefoods.com',
    search: { term: 'sauce' },
    cookieBannerAcceptSelector: 'a:has-text("No, thanks"), button:has-text("No, thanks")',
    header: {
      hasMegaMenu: true,
      hoverSelector: 'a[data-megamenu-handle="megamenu--shop"]',
      submenuSelector: '[class*="modal_megamenu"]',
      subcategoryLinkSelector: '[class*="modal_megamenu"] a[href="/collections/sauce"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/shop-all',
      filters: {
        enabled: true,
        toggleSelector: 'button:has-text("Filters")',
        labelSelector: 'label:has-text("HOT")',
      },
    },
    pdp: {
      path: '/products/butter-masala-cooking-sauce',
      variantType: 'none',
      variantInputSelector: null,
      quantitySelector: null,
      addToCartSelector: 'button[type="submit"]:has-text("Add to cart")',
    },
    cart: {
      type: 'drawer',
      containerSelector: '[class*="cart_drawer" i]',
      itemSelector: null, // TODO: pendiente de correr el spec real para confirmar
      quantityIncreaseSelector: 'button[aria-label="Increase quantity"]',
      quantityDecreaseSelector: 'button[aria-label="Decrease quantity"]',
      quantityDisplay: null,
      // TODO: el sitio exige un minimo de pedido (banner "ADD +2 JARS FOR MINIMUM ORDER");
      // puede que no aparezca boton de checkout visible con 1 solo item en el carrito.
      checkoutButtonSelector: null,
    },
  },
  // ─────────────────────────────────────────────────────────────────────────────────────
  // THREE BIRD NEST — 6/7 tests pasan. Falta: THREEBIRDNEST-04 (carrito), probablemente
  // flaky por timing con el banner de cookies OneTrust (se ve en el screenshot de la
  // última falla que el banner seguía en pantalla). En la investigación original se había
  // confirmado el flujo completo end-to-end hasta un checkout real, así que la config
  // debería ser correcta — antes de darlo por roto, re-correr THREEBIRDNEST-04 solo 2-3
  // veces para confirmar si es realmente intermitente.
  {
    id: 'THREEBIRDNEST',
    name: 'Three Bird Nest',
    baseUrl: 'https://www.threebirdnest.com',
    search: { term: 'dress' },
    cookieBannerAcceptSelector: '#onetrust-accept-btn-handler',
    header: {
      hasMegaMenu: true,
      hoverSelector: 'button[aria-label="Clothing submenu"]',
      submenuSelector: '#nav-submenu-1',
      subcategoryLinkSelector: '#nav-submenu-1 a[href^="/collections/"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/dresses-and-skirts',
      filters: {
        // El panel de filtros existe y funciona pero vive dentro de un <details><summary>
        // colapsado que el flujo genérico no soporta (falla "Element is not visible"), y la
        // URL resultante usa ?size=M (no contiene "filter"). Deshabilitado a propósito.
        enabled: false,
      },
    },
    pdp: {
      path: '/products/plaid-about-it-pants-brown-navy',
      variantType: 'radio-label',
      variantInputSelector: 'input[type="radio"][id*="-Size-"]',
      quantitySelector: null,
      addToCartSelector: 'button:has-text("Add to Cart")',
    },
    cart: {
      type: 'drawer',
      // Drawer partido en 2 paneles hermanos (Hydrogen/Outsmartly); el wrapper común real
      // tiene bounding box 0. Selector combinado verificado en vivo end-to-end.
      containerSelector: '.cartContents, #cart-checkout-content',
      itemSelector: 'ul[aria-label="Cart items"] li',
      quantityIncreaseSelector: 'button[aria-label="Increase quantity"]',
      quantityDecreaseSelector: 'button[aria-label="Decrease quantity"]',
      quantityDisplay: { type: 'text', selector: '[role="spinbutton"]' },
      checkoutButtonSelector: 'button:has-text("Checkout")',
    },
  },
  // ─────────────────────────────────────────────────────────────────────────────────────
  // RBX ACTIVE — 5/7 tests pasan. Faltan: RBX_ACTIVE-03 (filtro) y RBX_ACTIVE-04 (carrito).
  // Filtro: el click no cambió la URL en absoluto (labelSelector 'label[for="M"]' puede
  // haber cambiado o el toggle "Filters" no abrió el panel esta vez) — re-investigar en
  // vivo. Carrito: '#slide-in-cart-feature-default' resuelve pero queda "hidden" tras
  // agregar — mismo patrón que Comfrt, buscar el selector real del estado abierto o un
  // hijo visible dentro (el mismo fix .or(item) que ya está en el spec no alcanzó acá,
  // raro dado que el recon lo había confirmado con click real — puede ser timing).
  {
    id: 'RBX_ACTIVE',
    name: 'RBX Active',
    baseUrl: 'https://www.rbxactive.com',
    search: { term: 'leggings' },
    cookieBannerAcceptSelector: 'button:has-text("Accept")',
    header: {
      hasMegaMenu: true,
      hoverSelector: 'nav.hN5STude a[href="/collections/women"]',
      submenuSelector: 'nav.hN5STude li:has(a[href="/collections/women"]) div.H4u1QLWD',
      subcategoryLinkSelector: 'nav.hN5STude a[href="/collections/womens-new-arrivals"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/womens-leggings',
      filters: {
        enabled: true,
        toggleSelector: 'button:has-text("Filters")',
        labelSelector: 'label[for="M"]', // TODO: el click no cambió la URL en el último run, revisar en vivo
      },
    },
    pdp: {
      path: '/products/prime-tech-flex-ultra-hold-7-8-legging',
      variantType: 'radio-label',
      variantInputSelector: 'div.q1Mgl3qw div.rU07pP8T:not(.inuw22pw)',
      variantIsLabel: true,
      quantitySelector: null,
      addToCartSelector: 'button:has-text("add to cart")',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#slide-in-cart-feature-default', // TODO: confirmado que queda "hidden" tras agregar, revisar en vivo
      itemSelector: '.bwWhQE2u',
      quantityIncreaseSelector: '.qEaCUxxL span:has-text("+")',
      quantityDecreaseSelector: '.qEaCUxxL span:has-text("-")',
      quantityDisplay: { type: 'text', selector: '.qEaCUxxL p' },
      checkoutButtonSelector: '#slide-in-cart-feature-default a:has-text("Checkout")',
    },
  },
  // ─────────────────────────────────────────────────────────────────────────────────────
  // SOFÍA SARKANY — 5/7 tests pasan. Faltan: SOFIA_SARKANY-03 (filtro) y -04 (carrito).
  // Filtro: el label nunca llegó a estar "attached" — revisar si 'label[for="Filter-color-1"]'
  // sigue siendo válido o si el toggle "Color" no abrió el panel.
  // Carrito: el botón 'button.tdt-add-to-cart' nunca se volvió clickeable (esperó los 120s
  // completos del test) — coincide con lo que ya había marcado el reconocimiento original:
  // el botón queda posicionado fuera del viewport (posible widget de terceros que nunca
  // termina de animarse en headless). Puede ser un problema real de accesibilidad/UX del
  // sitio en automation, no solo un selector mal puesto — investigar con más tiempo antes
  // de sumarlo, o aceptar que este test quede marcado como conocido-fallido si el botón
  // realmente no es utilizable por un bot (lo cual también podría afectar a lectores de
  // pantalla reales, vale la pena mencionárselo al dueño del sitio).
  {
    id: 'SOFIA_SARKANY',
    name: 'Sofía Sarkany',
    baseUrl: 'https://sofiasarkany.com',
    search: { term: 'remera' },
    header: {
      hasMegaMenu: true,
      hoverSelector: 'a.menuItemTitle:has-text("INDUMENTARIA")',
      submenuSelector: '.sub-menu.subMenuFullWidth',
      subcategoryLinkSelector: '.sub-menu.subMenuFullWidth a[href="/collections/mujer-remeras"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/mujer-remeras',
      filters: {
        enabled: true,
        toggleSelector: 'button:has-text("Color")',
        labelSelector: 'label[for="Filter-color-1"]', // TODO: no llegó a "attached" en el último run
      },
    },
    pdp: {
      path: '/products/remera-cheers-gris',
      variantType: 'radio-label',
      variantInputSelector: 'fieldset.product-form__input input[type="radio"][name="Size"]',
      quantitySelector: null,
      addToCartSelector: 'button.tdt-add-to-cart', // TODO: nunca se volvió clickeable en 120s, posible widget que no termina de animar en headless
    },
    cart: {
      type: 'drawer',
      containerSelector: '#Cart-Drawer',
      itemSelector: null, // TODO: no se pudo poblar el carrito para confirmar
      quantityIncreaseSelector: null,
      quantityDecreaseSelector: null,
      quantityDisplay: null,
      checkoutButtonSelector: null,
    },
  },
];
