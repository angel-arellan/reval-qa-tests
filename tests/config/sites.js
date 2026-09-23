// Config centralizada de sitios Shopify para la suite genérica storefront-multisite.spec.js
//
// Para agregar un sitio nuevo: sumar una entrada aquí. El spec no necesita cambios salvo
// que el sitio tenga un patrón de header/carrito/variante totalmente nuevo (ver los "type"
// soportados en storefront-multisite.spec.js).
//
// Todos los selectores fueron verificados en vivo contra producción (no son adivinados):
// cada sitio Shopify usa un theme distinto, así que la navegación, el picker de variantes
// y el carrito difieren de sitio a sitio.
//
// - id: identificador corto en mayúsculas, se usa para el --grep del workflow de GitHub
//   Actions y para armar mensajes de Slack.
// - search.term: término que devuelve resultados reales en /search?q=...
// - header: cómo se abre el mega menú (si existe) y a qué subcategoría se navega para
//   validar que el menú funciona de punta a punta.
// - collection: página de categoría real a validar, y cómo se aplica un filtro si el
//   sitio los tiene (algunos sitios DTC no tienen colecciones filtrables reales).
// - pdp: página de producto a usar. Si `path` es null, se llega vía búsqueda + click en el
//   primer resultado (útil cuando no hay un producto "ancla" estable con variantes).
// - cart: tipo de carrito (drawer nativo del theme, drawer de una app tipo Rebuy, o página).
// - ecommerce: false (opcional, default true si se omite) — para sitios informativos/landing
//   sin carrito de compras real. Con esto alcanza: el spec salta automáticamente búsqueda,
//   catálogo, PDP+carrito+checkout, login y políticas (son paths de e-commerce que no existen
//   en un sitio sin tienda) y solo corre Home+Header y el chequeo responsive de mobile.
//   No hace falta completar `search`, `collection`, `pdp` ni `cart` en ese caso.

module.exports = [
  {
    id: 'SWISSGEAR_COM',
    name: 'SwissGear US',
    baseUrl: 'https://www.swissgear.com',
    search: { term: 'backpacks' },
    // Bug real de producción confirmado: al aumentar la cantidad en el carrito, el HTML del
    // botón "+" trae un error de Liquid incrustado (snippets/cart line 295: comparison of
    // Integer with String failed) y el request a /cart/change devuelve 422 — la cantidad
    // nunca cambia. No es un problema del test. Deshabilitado hasta que se corrija en el sitio.
    knownProductionBug: 'Bug real de producción en swissgear.com: /cart/change devuelve 422 por un error de Liquid en el snippet del carrito (línea 295), la cantidad nunca cambia.',
    header: {
      hasMegaMenu: true,
      hoverSelector: '#MegaMenu-new-arrivals a.mega-menu__title',
      submenuSelector: '#MegaMenu-new-arrivals .mega-menu',
      subcategoryLinkSelector: '#MegaMenu-new-arrivals .mega-menu a[href="/collections/new-arrival-backpacks"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/backpacks',
      filters: {
        enabled: true,
        toggleSelector: 'button[aria-controls="color-collection-filter-sidebar"]',
        labelSelector: 'label[for="CollectionFilter-color-1-sidebar"]',
      },
    },
    pdp: {
      path: '/products/energie-3-piece-spinner-set',
      variantType: 'radio-label',
      variantInputSelector: 'form[action="/cart/add"] input.product__swatch-input[type="radio"]',
      quantitySelector: null,
      addToCartSelector: 'button[js-add-to-cart]',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#CartDrawer',
      itemSelector: '[js-cart-item]',
      quantityIncreaseSelector: 'button[name="plus"]',
      quantityDecreaseSelector: 'button[name="minus"]',
      quantityDisplay: { type: 'input', selector: 'input.quantity__input[name="updates[]"]' },
      checkoutButtonSelector: '#CartDrawer-Checkout, button[name="checkout"]',
    },
  },
  {
    id: 'SWISSGEAR_CA',
    name: 'SwissGear CA',
    baseUrl: 'https://www.swissgear.ca',
    search: { term: 'backpacks' },
    cookieBannerAcceptSelector: 'button:has-text("Accept")',
    header: {
      hasMegaMenu: true,
      hoverSelector: '#MegaMenu-backpacks',
      submenuSelector: '.mega-menu[aria-labelledby="MegaMenu-backpacks"]',
      subcategoryLinkSelector: '.mega-menu[aria-labelledby="MegaMenu-backpacks"] a.nav__link',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/backpacks',
      filters: {
        enabled: true,
        toggleSelector: '[data-scope="sidebar"] .collection-filters__section-header:has-text("Color")',
        labelSelector: 'label[for="CollectionFilter-color-9-sidebar"]',
      },
    },
    pdp: {
      path: null, // no hay un handle multi-variante confirmado; se llega vía búsqueda
      variantType: 'radio-label',
      variantInputSelector: 'form[action="/cart/add"] input.product__swatch-input[type="radio"]',
      quantitySelector: null,
      addToCartSelector: 'button[js-main-add-to-cart], button[js-add-to-cart]',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#CartDrawer',
      itemSelector: '[js-cart-item]',
      quantityIncreaseSelector: 'button[name="plus"]',
      quantityDecreaseSelector: 'button[name="minus"]',
      quantityDisplay: { type: 'input', selector: 'input.quantity__input[name="updates[]"]' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
  {
    id: 'STARS_HONEY',
    name: 'Stars + Honey',
    baseUrl: 'https://www.starsandhoney.com',
    search: { term: 'chocolate' },
    // El cambio de cantidad en /cart es genuinamente flaky en automation (headless): hay una
    // condición de carrera real entre las llamadas AJAX que el propio sitio dispara al
    // cambiar cantidad (confirmado con logging de red: múltiples POST a /cart/update.js
    // pisándose). No es un bug de producción — reintentar la interacción no lo resuelve de
    // forma determinística. Se valida best-effort en vez de bloquear el test por esto.
    quantityCheckSoft: true,
    header: {
      hasMegaMenu: true,
      hoverSelector: 'nav a:has-text("Shop All")',
      submenuSelector: '#mega',
      subcategoryLinkSelector: '#mega a[href^="/products/"]',
      visibilityCheck: 'boundingBox', // este theme mantiene opacity:1 siempre, isVisible() da falso positivo
    },
    collection: {
      path: '/collections/all',
      filters: { enabled: false }, // sitio DTC de producto único por página, sin grilla filtrable real
    },
    pdp: {
      path: '/products/dark-chocolate-coconut',
      variantType: 'aria-radio-button',
      variantInputSelector: 'div[role="radiogroup"][aria-label="Pack quantity"] button[role="radio"]',
      quantitySelector: null, // la cantidad viene fusionada con el selector de pack
      addToCartSelector: 'button:has-text("ADD TO BAG")',
    },
    cart: {
      // El drawer de la app (.cartContents) no abre de forma confiable en automation aunque
      // el add-to-cart sí funciona a nivel backend (confirmado vía /cart/add.js + /cart.json).
      // Se usa la página clásica /cart (tema legacy) del propio sitio, mucho más estable.
      type: 'page',
      itemSelector: '[data-cart-item]',
      quantityIncreaseSelector: 'button:has-text("+")',
      quantityDecreaseSelector: 'button:has-text("−")',
      quantityDisplay: { type: 'input', selector: 'input.quantity__input[name="updates[]"]' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
  {
    id: 'LUSSOCLOUD',
    name: 'Lusso Cloud',
    baseUrl: 'https://www.lussocloud.com',
    search: { term: 'slide' },
    cookieBannerAcceptSelector: 'button:has-text("Accept")',
    // Bug real de producción confirmado: hay un error de JS en vendor.js ("Cannot read
    // properties of null (reading 'dataset')") que a veces rompe la interactividad del
    // sitio. Se manifiesta de forma consistente en #AddToCart, que queda con rect 0x0 tras
    // elegir talla y no se puede clickear. No es un problema del test. Deshabilitado hasta
    // que se corrija en el sitio.
    knownProductionBug: 'Bug real de producción en lussocloud.com: error de JS en vendor.js deja el botón Add to Cart inclickeable (rect 0x0) tras elegir variante.',
    header: {
      hasMegaMenu: true,
      openMethod: 'click', // este menú es un disclosure accesible (aria-expanded), no usa CSS :hover
      hoverSelector: 'a[aria-controls="desktop-menu-7"]',
      submenuSelector: '#desktop-menu-7',
      subcategoryLinkSelector: '#desktop-menu-7 a',
      visibilityCheck: 'isVisible',
      // "Comfy Collabs" no abre de forma confiable con clicks/hover sintéticos en Chromium
      // headless (verificado manualmente: la página funciona bien, no es un bug real del
      // sitio). Se valida best-effort para no generar alertas falsas por esto en cada corrida.
      softCheck: true,
    },
    collection: {
      path: '/collections/womens',
      filters: {
        enabled: true,
        toggleSelector: 'button[aria-controls="facet-filter-filter.p.m.custom.category_filter"]',
        labelSelector: 'label[for="filter.p.m.custom.category_filter-1"]',
      },
    },
    pdp: {
      path: '/products/rosa-slide-pb-malt',
      variantType: 'radio-label',
      variantInputSelector: 'label.block-swatch__item:not([aria-disabled="true"])',
      variantIsLabel: true, // acá el propio selector ya apunta al <label>, no a un <input> a resolver
      quantitySelector: null,
      // Bug conocido en producción: tras elegir talla, #AddToCart queda con rect 0x0 por un
      // error real de JS del sitio (vendor.js). Se prueba con click normal a propósito para
      // que el test lo siga marcando como falla mientras el bug exista.
      addToCartSelector: '#AddToCart',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#rebuy-cart .rebuy-cart__flyout',
      itemSelector: '.rebuy-cart__flyout-item',
      quantityIncreaseSelector: '#rebuy-cart [aria-label*="Increase quantity"]',
      quantityDecreaseSelector: '#rebuy-cart [aria-label*="Decrease quantity"]',
      quantityDisplay: { type: 'text', selector: '.rebuy-cart__flyout-item-quantity-widget-label' },
      checkoutButtonSelector: '#rebuy-cart .rebuy-cart__checkout-button',
    },
  },
  {
    id: 'MARMOT_AR',
    name: 'Marmot Argentina',
    baseUrl: 'https://marmot.com.ar',
    search: { term: 'campera' },
    header: {
      hasMegaMenu: true,
      hoverSelector: 'summary.hdt-header__menu-item[data-url="/collections/hombre"]',
      submenuSelector: 'details:has(summary[data-url="/collections/hombre"]) .hdt-mega-menu__content',
      subcategoryLinkSelector: 'details:has(summary[data-url="/collections/hombre"]) a[href="/collections/hombre/Camperas"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/hombre/Camperas',
      filters: {
        enabled: true,
        toggleSelector: 'button.hdt-facets__open',
        labelSelector: 'label[for="Filter--filter.v.option.talle-2"]',
      },
    },
    pdp: {
      path: '/products/buzo-rocklin-repreve-marmot-hombre',
      variantType: 'radio-label',
      variantInputSelector: '.hdt-product-form__values input[type="radio"]',
      quantitySelector: null,
      addToCartSelector: 'button[name="add"]',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#CartDrawer',
      itemSelector: '.hdt-cart-item',
      quantityIncreaseSelector: 'button.hdt-quantity__button[name="plus"]',
      quantityDecreaseSelector: 'button.hdt-quantity__button[name="minus"]',
      quantityDisplay: { type: 'input', selector: 'input.hdt-quantity__input' },
      checkoutButtonSelector: '#CartDrawer-Checkout, button[name="checkout"]',
    },
  },
  {
    id: 'ANSILTA_COM',
    name: 'Ansilta',
    baseUrl: 'https://ansilta.com',
    search: { term: 'campera' },
    header: {
      hasMegaMenu: true,
      hoverSelector: 'summary[data-link="/collections/hombre"]',
      submenuSelector: 'details:has(summary[data-link="/collections/hombre"]) .mega-menu',
      subcategoryLinkSelector: '.mega-menu a[href="/collections/hombre/Camperas"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/hombre',
      filters: {
        enabled: true,
        toggleSelector: 'details[data-index="vertical-filter.v.option.size"] summary',
        labelSelector: 'label[for="vertical-filter.v.option.size-1"]',
      },
    },
    pdp: {
      path: '/products/campera-aconcagua-4-hombre',
      variantType: 'radio-label',
      variantInputSelector: 'fieldset.product-form__input--button input[type="radio"]',
      quantitySelector: null,
      addToCartSelector: 'button.product-form__submit[name="add"]',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#CartDrawer',
      itemSelector: '.cart-item',
      quantityIncreaseSelector: 'button[name="plus"]',
      quantityDecreaseSelector: 'button[name="minus"]',
      quantityDisplay: { type: 'input', selector: 'input.quantity__input[name="updates[]"]' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
  {
    id: 'ENASPORT',
    name: 'Ena Sport',
    baseUrl: 'https://enasport.com',
    search: { term: 'proteina' },
    header: {
      hasMegaMenu: true,
      openMethod: 'click',
      hoverSelector: 'summary[data-url="/collections/todos-los-productos"]',
      submenuSelector: '#mega-menu-mega_menu_4Hhege',
      // Confirmado con scripts de Playwright aislados, código idéntico al del spec: el
      // trigger a veces resuelve con boundingBox real y a veces con null en requests
      // consecutivos sin ningún cambio de nuestro lado (ni popups, ni UA, ni timing) —
      // es una condición de carrera del propio JS del tema al hidratar el <details> del
      // mega menú, no un problema de selectores ni de contención de esta máquina. Se valida
      // best-effort para no generar alertas falsas de Slack por esto en cada corrida.
      softCheck: true,
      subcategoryLinkSelector: '#mega-menu-mega_menu_4Hhege a[href="/collections/proteinas"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/proteinas',
      filters: {
        enabled: true,
        toggleSelector: '#accordion-filter-v-option-sabor:visible summary',
        // El sitio duplica el mismo id de sección (drawer mobile + sidebar desktop) y el
        // sufijo numérico de sección cambia con el tiempo, así que en vez de un id exacto se
        // matchea por el final del atributo `for` (evita el falso positivo de "chocolate-mousse").
        labelSelector: 'label[for$="filter-v-option-sabor-chocolate"]',
        // Confirmado en vivo con scripts aislados, código idéntico, corridos varias veces
        // seguidas sin ningún cambio de nuestro lado: el click a veces dispara el listener de
        // "change" del widget de filtro y a veces no — condición de carrera del propio JS del
        // sitio, no un problema de selectores (mismo patrón que header.softCheck arriba).
        softCheck: true,
      },
    },
    pdp: {
      path: '/products/100-whey-protein',
      variantType: 'radio-label',
      variantInputSelector: 'label.thumbnail-swatch',
      variantIsLabel: true,
      quantitySelector: null,
      addToCartSelector: 'buy-buttons button[type="submit"]',
    },
    cart: {
      type: 'page',
      itemSelector: 'tr:has(line-item)',
      quantityIncreaseSelector: null,
      quantityDecreaseSelector: null,
      quantityChangeMethod: 'fill',
      quantityDisplay: { type: 'input', selector: 'td.sm\\:table-cell input.quantity-input' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
  {
    id: 'ADEPAC',
    name: 'Adepac',
    baseUrl: 'https://tienda.adepac.cl',
    search: { term: 'cinta' },
    // Bug real de producción confirmado: el botón "Comprar" de CADA PDP probada (4/4) tiene un
    // onclick con window.open() hacia un listado de MercadoLibre del vendedor + "return false",
    // que cancela el submit real del form a /cart/add. El carrito de Shopify existe pero no es
    // alcanzable desde la UI real del sitio. No es un problema del test.
    knownProductionBug: 'Bug real de producción en tienda.adepac.cl: el botón "Comprar" de la PDP tiene un onclick con window.open() hacia un listado de MercadoLibre + return false, que cancela el submit del form a /cart/add. Confirmado en 4 productos distintos.',
    header: {
      hasMegaMenu: true,
      hoverSelector: 'a.header__menu-item[href="/collections/adhesivos"]',
      submenuSelector: 'li:has(a.header__menu-item[href="/collections/adhesivos"]) ul.header__submenu',
      subcategoryLinkSelector: 'li:has(a.header__menu-item[href="/collections/adhesivos"]) ul.header__submenu a[href="/collections/la-gotita%C2%AE"]',
      visibilityCheck: 'isVisible',
    },
    collection: {
      path: '/collections/promociones',
      filters: {
        enabled: true,
        toggleSelector: 'summary[aria-controls="Facet-1-template--19597944651836__product-grid"]',
        labelSelector: 'label[for="Filter-filter.v.availability-1"]',
      },
    },
    pdp: {
      path: '/products/python%C2%AE-cinta-multiuso-negra-48mm-x-9mts',
      variantType: 'none',
      variantInputSelector: null,
      quantitySelector: null,
      addToCartSelector: 'button[name="add"]',
    },
    cart: {
      type: 'page',
      itemSelector: '.cart-item',
      quantityIncreaseSelector: 'button.quantity__button[name="plus"]',
      quantityDecreaseSelector: 'button.quantity__button[name="minus"]',
      quantityDisplay: { type: 'input', selector: 'input.quantity__input[name="updates[]"]' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
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
      // El panel de filtros vive dentro de un <details><summary> colapsado no soportado por
      // el flujo genérico, y la URL resultante usa ?size=M (no contiene "filter").
      filters: { enabled: false },
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
      // Drawer partido en 2 paneles hermanos (Hydrogen/Outsmartly).
      containerSelector: '.cartContents, #cart-checkout-content',
      // El wrapper real del drawer es <div role="dialog" aria-modal="true">: coincide con el
      // selector anti-popup genérico del spec y quedaba oculto con display:none antes de que
      // Playwright pudiera verlo abierto. Ver popupSelectorParaSitio() en storefront-multisite.spec.js.
      drawerCollidesWithPopupSelector: true,
      itemSelector: 'ul[aria-label="Cart items"] li',
      quantityIncreaseSelector: 'button[aria-label="Increase quantity"]',
      quantityDecreaseSelector: 'button[aria-label="Decrease quantity"]',
      quantityDisplay: { type: 'text', selector: '[role="spinbutton"]' },
      checkoutButtonSelector: 'button:has-text("Checkout")',
    },
  },
  {
    id: 'AILUYANDI',
    name: 'Ailu y Andi',
    baseUrl: 'https://ailuyandi.com',
    search: { term: 'curso' },
    header: { hasMegaMenu: false },
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
      // El custom element <buy-buttons> a veces no termina de hidratar su listener de submit
      // para cuando Playwright hace el primer click (confirmado con logging de red: 0
      // requests a /cart/add en la ventana de 10s). Ver el reintento gateado por este campo
      // en agregarProductoAlCarrito() del spec.
      retryAddToCartClick: true,
    },
    cart: {
      type: 'drawer',
      containerSelector: '#cart-drawer',
      // El propio contenedor real (<cart-drawer id="cart-drawer" role="dialog"
      // aria-modal="true">) coincide con el selector anti-popup genérico del spec y quedaba
      // oculto con display:none antes de que Playwright pudiera verlo abierto. Ver
      // popupSelectorParaSitio() en storefront-multisite.spec.js.
      drawerCollidesWithPopupSelector: true,
      itemSelector: 'line-item',
      quantityIncreaseSelector: 'a.quantity-selector__button:has(svg.icon-quantity-plus)',
      quantityDecreaseSelector: 'a.quantity-selector__button:has(svg.icon-quantity-minus)',
      quantityDisplay: { type: 'input', selector: 'input.quantity-selector__input' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
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
        labelSelector: 'label[for="Filter-color-1"]',
        // El tema exige un click extra en "Aplicar" tras tildar el checkbox del filtro; no
        // navega solo al instante. Ver soporte de este campo en el test 03 del spec.
        applyButtonSelector: 'button.mobile-filters-apply',
      },
    },
    pdp: {
      path: '/products/remera-cheers-gris',
      variantType: 'radio-label',
      variantInputSelector: 'fieldset.product-form__input input[type="radio"][name="Size"]',
      quantitySelector: null,
      // El selector original del recon ('button.tdt-add-to-cart') apuntaba a un botón decoy
      // SIEMPRE fuera del viewport (visibility:hidden), no al control real "AGREGAR AL
      // CARRITO" — confirmado con document.elementFromPoint() sobre la posición visual real.
      addToCartSelector: 'button#AddToCart.single-add-to-cart-button',
    },
    cart: {
      type: 'drawer',
      containerSelector: '#Cart-Drawer',
      itemSelector: '.product-cart-item',
      quantityIncreaseSelector: 'quantity-selector button.plus',
      quantityDecreaseSelector: 'quantity-selector button.minus',
      quantityDisplay: { type: 'input', selector: 'input.qty[name="updates[]"]' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
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
        // Existe un panel de filtros (facetas por color/tipo) detrás de un toggle tipo
        // checkbox+label, pero confirmado en vivo que un click (incluso forzado) sobre el
        // label de una faceta de color no marca el checkbox ni cambia la cantidad de
        // productos ni la URL — el panel no queda realmente interactuable con un click
        // sintético en headless. No es un bug de producción (el panel existe y se ve), pero
        // el flujo genérico de filtros no aplica acá. Deshabilitado a propósito, igual que en
        // THREEBIRDNEST.
        enabled: false,
      },
    },
    pdp: {
      path: '/products/minimalist-hoodie',
      variantType: 'radio-label',
      // Storefront headless custom (constructor "Bite"): el swatch de color es un <span>
      // (no un <button>) envuelto por un <label for="..."> que a su vez envuelve un
      // <input type="radio"> oculto. Apuntar al radio y dejar que el spec resuelva
      // label[for=id] selecciona la variante correctamente.
      variantInputSelector: 'input[type="radio"][id*="-Color-"]',
      quantitySelector: null,
      addToCartSelector: 'button[class*="addButton"]',
    },
    cart: {
      type: 'drawer',
      // El drawer real es '.cartContents' (clase estable, sin hash, a diferencia del resto
      // del theme). El botón de Checkout y el resumen de precios viven en un contenedor
      // HERMANO ('#cart-checkout-content'), no dentro de '.cartContents' — de ahí el selector
      // combinado (mismo patrón que THREEBIRDNEST). El wrapper exterior '#drawers-cart-closed'
      // contiene todo pero tiene bounding box 0x0 (sus hijos se posicionan fuera de él), por
      // lo que toBeVisible() sobre ese selector falla siempre aunque el carrito haya abierto.
      containerSelector: '.cartContents, #cart-checkout-content',
      // Line item accesible: <ul aria-label="Cart items"><li aria-label="Producto, ...">
      itemSelector: 'ul[aria-label="Cart items"] li',
      quantityIncreaseSelector: 'button[aria-label="Increase quantity"]',
      quantityDecreaseSelector: 'button[aria-label="Decrease quantity"]',
      // La cantidad se muestra en un <div role="spinbutton" aria-valuenow="1">, no en un
      // <input>; +/- funcionan sin recargar la página (el form submit real es interceptado).
      quantityDisplay: { type: 'text', selector: '[role="spinbutton"]' },
      checkoutButtonSelector: 'button:has-text("Checkout")',
    },
  },
  {
    id: 'RBX_ACTIVE',
    name: 'RBX Active',
    baseUrl: 'https://www.rbxactive.com',
    search: { term: 'leggings' },
    cookieBannerAcceptSelector: 'button:has-text("Accept")',
    // El tema hidrata sus "features" (header, carrito, etc.) de forma asíncrona con React
    // bastante después del primer render visual. Confirmado en vivo: un click real en +/- del
    // carrito a veces no dispara ningún request a /cart/change.js porque el listener de React
    // todavía no se había reatado tras el re-render anterior — no es un bug de producción (un
    // usuario real que no clickea a la velocidad de un test no lo nota), es el mismo tipo de
    // condición de carrera ya documentada en STARS_HONEY. Se valida best-effort en vez de
    // bloquear el test por esto.
    quantityCheckSoft: true,
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
        // La sección "Size" del panel arranca colapsada (max-height: 0) — hay que expandirla
        // clickeando su header antes de que el checkbox/label de talla sea clickeable de verdad.
        sectionToggleSelector: 'h3:has-text("Size")',
        labelSelector: 'label[for="M"]',
        // El checkbox por sí solo NO cambia la URL: hace falta un click explícito en "Apply"
        // (queda deshabilitado hasta que se elige al menos una opción).
        applyButtonSelector: 'button:has-text("Apply")',
        // Filtro custom del sitio (no es Shopify Search & Discovery nativo): la URL queda
        // "?sizes=M", sin la palabra "filter" que asume el check genérico del spec.
        urlChangePattern: /sizes=/i,
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
      // El wrapper #slide-in-cart-feature-default queda con height:0 en su propio box (sus
      // hijos son position:fixed, así que no aportan altura al padre) — Playwright lo ve
      // "hidden" aunque el drawer esté perfectamente visible. El panel real (con los items,
      // +/- y Checkout) es su ÚLTIMO hijo directo; no tiene ningún atributo estable (ni role,
      // ni aria-label, ni data-*), así que se referencia por posición estructural en vez de
      // por su clase CSS-module hasheada (cambia entre builds).
      containerSelector: '#slide-in-cart-feature-default > div:last-child',
      itemSelector: '.bwWhQE2u',
      quantityIncreaseSelector: '.qEaCUxxL span:has-text("+")',
      quantityDecreaseSelector: '.qEaCUxxL span:has-text("-")',
      quantityDisplay: { type: 'text', selector: '.qEaCUxxL p' },
      // Relativo al containerSelector de arriba (el spec hace cartRoot.locator(...)): con el
      // prefijo viejo "#slide-in-cart-feature-default a:has-text(...)" el spec buscaba un
      // segundo elemento con ese mismo id ANIDADO dentro del panel, que no existe.
      checkoutButtonSelector: 'a:has-text("Checkout")',
    },
  },
];
