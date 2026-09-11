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

module.exports = [
  {
    id: 'SWISSGEAR_COM',
    name: 'SwissGear US',
    baseUrl: 'https://www.swissgear.com',
    search: { term: 'backpacks' },
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
      quantityDisplay: { type: 'input', selector: 'input.quantity__input[name="updates[]"]' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
  {
    id: 'STARS_HONEY',
    name: 'Stars + Honey',
    baseUrl: 'https://www.starsandhoney.com',
    search: { term: 'chocolate' },
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
      quantityDisplay: { type: 'input', selector: 'input.quantity__input[name="updates[]"]' },
      checkoutButtonSelector: 'button[name="checkout"]',
    },
  },
  {
    id: 'LUSSOCLOUD',
    name: 'Lusso Cloud',
    baseUrl: 'https://www.lussocloud.com',
    search: { term: 'slide' },
    header: {
      hasMegaMenu: true,
      openMethod: 'click', // este menú es un disclosure accesible (aria-expanded), no usa CSS :hover
      hoverSelector: 'a[aria-controls="desktop-menu-7"]',
      submenuSelector: '#desktop-menu-7',
      subcategoryLinkSelector: '#desktop-menu-7 a',
      visibilityCheck: 'isVisible',
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
      quantityDisplay: { type: 'text', selector: '.rebuy-cart__flyout-item-quantity-widget-label' },
      checkoutButtonSelector: '#rebuy-cart .rebuy-cart__checkout-button',
    },
  },
];
