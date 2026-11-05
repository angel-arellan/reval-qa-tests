// Registro del trabajo de QA manual (regresiones, tickets, releases, seguridad) para el informe
// semanal (.github/scripts/reporte-semanal.js). Cada entrada aparece en el PDF de su proyecto
// la semana de su fecha, en la sección "Trabajo de QA de la semana", y en el mail interno.
//
// Cómo sumar una: agregar un objeto al principio de la lista al terminar cada QA.
// - fecha: 'AAAA-MM-DD' (día en que se hizo).
// - proyectos: ids de tests/config/sites.js o de tests/config/reporte.js (REVAL_STG, TWP). Un
//   id que no tenga PDF (ej. HARD_CONDITIONS) solo aparece en el mail interno.
// - titulo, resumen, hallazgos y pendientes: en lenguaje simple, porque van al PDF del cliente.
// - resultado: 'Aprobado' | 'Aprobado con observaciones' | 'Con problemas' | 'Parcial'.
// - informe: link al informe completo. Va SOLO en el mail interno (los links de Claude son
//   privados de la cuenta y el cliente no los puede abrir).

module.exports = [
  {
    fecha: '2026-11-05',
    proyectos: ['REVAL_STG'],
    titulo: 'Cupones de descuento en el checkout de suscripciones (SUB-150)',
    resultado: 'Aprobado con observaciones',
    resumen:
      'Probamos los cupones de porcentaje, monto fijo y envío gratis, sus combinaciones, mínimos de compra, vencimientos, segmentos de clientes, cajas y compras mixtas, en escritorio y celular. Todo sin realizar pagos.',
    hallazgos: [
      'La nota «El cupón aplica al primer cobro…» se muestra aunque no haya ningún cupón aplicado.',
      'En «Cantidad de cobros», si se ingresa 150 se guarda 120 sin avisar (con valores bajos avisa bien).',
    ],
    pendientes: ['Probar el cobro real con cupón en Mercado Pago y cómo se ve después en el panel y el portal.'],
    informe: 'https://claude.ai/artifact/FkkiWQczen2WaNifnqHScN',
  },
  {
    fecha: '2026-11-04',
    proyectos: ['REVAL_STG'],
    titulo: 'Regresión general del producto (plan de 56 casos)',
    resultado: 'Parcial',
    resumen:
      'Recorrimos la tienda de prueba, el checkout de suscripciones, el panel y el portal del suscriptor, sin pagos ni envíos de mails. Quedaron 27 casos OK, 2 con falla, 1 a confirmar, 2 parciales, 1 que no aplica y 23 sin probar (la ronda se cortó a mitad).',
    hallazgos: [
      'Un doble clic en el botón de la ficha duplica el producto en el carrito de suscripciones.',
      'El checkout acepta letras en el DNI.',
      'El panel y el portal muestran un precio base viejo en algunos productos, aunque el checkout cobra el precio correcto.',
    ],
    pendientes: ['Completar los 23 casos sin probar.'],
    informe: 'https://claude.ai/artifact/V4hAToZnLZYrtpfxa5k1Wp',
  },
  {
    fecha: '2026-11-03',
    proyectos: ['REVAL_STG'],
    titulo: 'Panel de administración en celular (SUB-21)',
    resultado: 'Parcial',
    resumen:
      'Revisamos 17 pantallas del panel en cuatro anchos de celular (430, 402, 375 y 320 px): ninguna tiene desplazamiento lateral y la facturación muestra bien los importes. La ronda se frenó antes de la pasada en Android.',
    hallazgos: [
      'En Inicio, el detalle del gráfico «Crecimiento por día» se corta a la derecha y abajo.',
      'Algunos botones secundarios («Ver detalle», «Ver») y los links de pedido quedan más chicos que lo recomendado para tocar con el dedo.',
    ],
    pendientes: ['Pasada en Android y pruebas puntuales restantes.'],
  },
  {
    fecha: '2026-11-02',
    proyectos: ['REVAL_STG'],
    titulo: 'Reglas para renombrar métodos de envío por día y horario',
    resultado: 'Aprobado',
    resumen:
      'Validamos las 7 pruebas del desarrollador y 7 adicionales sobre las zonas de envío con días y horario «desde/hasta». Sin errores: lista para producción.',
    hallazgos: [],
    pendientes: [
      'Definir qué nombre ve el cliente en el pedido, el portal y la página de gracias.',
      'Publicar la guía de uso en la documentación.',
    ],
    informe: 'https://claude.ai/artifact/6vNEi3r18QyH69XujuoVKr',
  },
  {
    fecha: '2026-11-03',
    proyectos: ['TWP'],
    titulo: 'Re-test del carrito de suscripciones después de la corrección',
    resultado: 'Con problemas',
    resumen: 'Volvimos a probar el carrito y el checkout de suscripciones con la versión corregida del tema.',
    hallazgos: [
      'Corregido: el subtotal ahora incluye el producto adicional (upsell).',
      'Sigue pendiente: el costo de envío no es correcto cuando hay productos con dos frecuencias distintas.',
      'Nuevo: el carrito cuenta el producto adicional para el envío gratis desde $100.000 y el checkout no, así que no coinciden.',
      'El píxel de publicidad de OpenAI tenía un error de configuración; se corrigió y verificó el mismo día.',
    ],
    pendientes: ['Corregir el envío con dos frecuencias y unificar el cálculo del envío gratis.'],
    informe: 'https://claude.ai/artifact/X4jN8au8bpKpmDDJT3P8vG',
  },
  {
    fecha: '2026-10-30',
    proyectos: ['TWP'],
    titulo: 'Regresión del carrito y checkout de suscripciones en producción',
    resultado: 'Con problemas',
    resumen: 'Revisamos el recorrido completo de suscripción y compra única en la tienda publicada, sin realizar compras.',
    hallazgos: [
      'El costo de envío no es correcto cuando hay productos con dos frecuencias distintas.',
      'El subtotal del carrito no incluía el producto adicional (upsell).',
    ],
    pendientes: [],
    informe: 'https://claude.ai/artifact/4fjgAcu9pehZobygdCcthA',
  },
  {
    fecha: '2026-11-03',
    proyectos: ['SWISSGEAR_COM', 'SWISSGEAR_CA'],
    titulo: 'QA del nuevo tema antes de publicarlo (BFCM)',
    resultado: 'Aprobado con observaciones',
    resumen: 'Revisamos el tema nuevo de las dos tiendas antes y después de publicarlo. Quedó aprobado para publicar.',
    hallazgos: [
      'Tienda de EE. UU.: con el buscador abierto dentro del menú de celular, la tecla Esc deja la pantalla oscurecida.',
      'Tienda de EE. UU.: un aviso técnico menor en la vista de producto de dos columnas, que hoy no usa ningún producto.',
    ],
    pendientes: [],
    informe: 'https://claude.ai/artifact/YUgbUZ5CaPcLoJrUA3W48Q',
  },
  {
    fecha: '2026-11-03',
    proyectos: ['RBX_ACTIVE'],
    titulo: 'QA del lanzamiento «US Open» en el entorno de prueba',
    resultado: 'Aprobado con observaciones',
    resumen:
      'Probamos las novedades del lanzamiento antes de pasar a producción: 6 funcionaron bien y 3 no se pudieron verificar por falta de datos de ejemplo (preventa, Loop Shop Now y textos alternativos de imágenes). Sin bloqueantes.',
    hallazgos: [
      'La nueva página de «no encontrado» aparece solo en productos y colecciones.',
      'La categoría Sports Bras lleva a una página inexistente.',
      'El precio cambia según el país del visitante; falta confirmarlo desde EE. UU.',
    ],
    pendientes: ['Verificar el precio desde una conexión de EE. UU.'],
    informe: 'https://claude.ai/artifact/NWRKyrf2wMp1LdYwbrPFua',
  },
  {
    fecha: '2026-10-30',
    proyectos: ['HARD_CONDITIONS'],
    titulo: 'Revisión post lanzamiento de Hard Conditions',
    resultado: 'Con problemas',
    resumen: 'Crítico: el checkout dice que el envío no está disponible para ninguna dirección. Sigue el precio del Botín de Seguridad distinto por talle.',
    hallazgos: [],
    pendientes: [],
    informe: 'https://claude.ai/artifact/EAbTvmb2im3LyeUnkDXNwB',
  },
];
