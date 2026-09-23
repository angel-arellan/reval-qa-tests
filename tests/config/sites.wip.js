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
  // AILUYANDI — ya sumado a sites.js. La intermitencia real de AILUYANDI-04 no era el
  // drawer tardando en poblarse: eran dos bugs distintos de la infraestructura compartida
  // colisionando con este theme (el propio contenedor #cart-drawer con role="dialog" que
  // POPUP_SELECTOR ocultaba, y el custom element <buy-buttons> a veces sin terminar de
  // hidratar su listener en el primer click). Ambos resueltos en storefront-multisite.spec.js
  // (drawerCollidesWithPopupSelector y retryAddToCartClick). También se encontró y arregló
  // AILUYANDI-01 (footer fantasma oculto matcheado por .first()). Confirmado con 13+
  // corridas consecutivas sin fallas.
  // ─────────────────────────────────────────────────────────────────────────────────────
  // COMFRT — ya sumado a sites.js. El carrito real chocaba con dos bugs de infraestructura
  // compartida: el drawer real (role="dialog" aria-label="Shopping cart") era eliminado por
  // la limpieza anti-popup, y la app "Recart" (SMS marketing) tapaba el botón de Checkout
  // tras cambiar la cantidad. Ambos resueltos en storefront-multisite.spec.js (exclusión de
  // aria-label="Shopping cart" en POPUP_SELECTOR, [id*="recart"], y bloqueo de red a
  // attn.tv para el popup "Mystery Offer" de Attentive). El filtro de color no queda
  // interactuable con un click sintético (panel real, no un bug de producción) — deshabilitado
  // a propósito, igual que en THREEBIRDNEST. Confirmado con 8 corridas del carrito (6/8
  // limpias; las 2 restantes fallaron ya DESPUÉS de completar el checkout, en el paso de
  // volver al home, probablemente por rate-limiting del sitio tras generar varios checkouts
  // reales seguidos en pruebas — revisar si se repite en el primer run real de producción,
  // que corre 1x/hora en vez de en ráfaga).
  // ─────────────────────────────────────────────────────────────────────────────────────
  // GYMKHANA FINE FOODS — 1/7 tests pasan (solo Login). NO es un bloqueo anti-bot del sitio
  // (descartado con evidencia: curl limpio con 200 en todas las páginas, sin headers ni
  // contenido de challenge de Cloudflare/WAF; Playwright headless aislado carga el home
  // completo en <2s con contenido real). La causa más probable es contención de recursos en
  // esta laptop compartida: al reproducir el timeout con la suite completa había 30-40
  // procesos chrome-headless-shell corriendo a la vez (load average >10), incluyendo otra
  // sesión de Claude Code corriendo Playwright en paralelo sobre este mismo repo — sumado a
  // que este sitio es inusualmente pesado (5+ videos HLS con autoplay, SPA router + Alpine.js,
  // ~10 scripts de marketing/analytics) y a que el spec intercepta cada request con
  // page.route('**/*') más un MutationObserver con barrido del DOM cada 1s. El workflow real
  // de GitHub Actions corre en runners dedicados (no esta laptop), así que este timeout local
  // no predice de forma confiable qué pasaría ahí. Antes de sumarlo o descartarlo: reintentar
  // en un entorno sin contención (laptop sin otras sesiones de Playwright corriendo, o un
  // workflow_dispatch manual acotado a este sitio). Si en un entorno limpio también da
  // timeout, investigar el costo real de hidratación del theme (subir el timeout específico
  // de este sitio, o cambiar validarSinErrores para no depender de innerText() del body
  // completo en páginas tan pesadas). Los selectores de abajo siguen sin confirmar.
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
  // THREE BIRD NEST — ya sumado a sites.js. La causa real de THREEBIRDNEST-04 no era timing
  // con el banner de cookies: el wrapper real del drawer es <div role="dialog"
  // aria-modal="true">, el mismo patrón de marcado que POPUP_SELECTOR usa para eliminar
  // popups ilegítimos, así que la limpieza anti-popup genérica lo ocultaba antes de que
  // Playwright pudiera verlo abierto. Se agregó el flag opt-in por sitio
  // `cart.drawerCollidesWithPopupSelector` en storefront-multisite.spec.js para excluir de esa
  // limpieza cualquier elemento que contenga el containerSelector real del sitio, sin afectar
  // a ningún otro sitio. Confirmado con 5 corridas consecutivas sin fallas.
  // ─────────────────────────────────────────────────────────────────────────────────────
  // RBX ACTIVE — ya sumado a sites.js. Tres causas independientes: (1) un bug real en la
  // infraestructura compartida — en sitios con hidratación asíncrona pesada (React)
  // document.documentElement podía ser null en el instante en que corre el addInitScript
  // anti-popup, abortando esa defensa en silencio para TODA la carga; ahora tiene guarda con
  // reintento. (2) el panel de filtros agrupa "Size" en un acordeón colapsado y exige un
  // click en "Apply" aparte, con una URL custom "?sizes=M" (soportado con los nuevos campos
  // sectionToggleSelector/applyButtonSelector/urlChangePattern). (3) el contenedor real del
  // carrito tiene bounding box 0 (hijos position:fixed) y el selector de checkout tenía un
  // id duplicado de más. Confirmado con 3 corridas completas consecutivas.
  // ─────────────────────────────────────────────────────────────────────────────────────
  // SOFÍA SARKANY — ya sumado a sites.js. No eran bugs de producción ni de accesibilidad:
  // el filtro chocaba con la limpieza anti-popup (el panel de Shopify Search & Discovery usa
  // role="dialog", igual que un popup ilegítimo) y además requiere un click extra en un botón
  // "Aplicar"; el selector de "Comprar" del recon apuntaba a un botón decoy siempre fuera del
  // viewport, no al control real. Todo resuelto en storefront-multisite.spec.js (exclusión de
  // "facet" en POPUP_SELECTOR y el campo filters.applyButtonSelector) y en la config (selector
  // real button#AddToCart.single-add-to-cart-button). Confirmado con 3 corridas completas.
];
