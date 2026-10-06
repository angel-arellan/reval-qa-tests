// Resuelve qué PDP usar en los tests: el producto fijo configurado en sites.js si tiene
// stock, o si no el primer producto con stock de la colección configurada. Evita falsas
// alarmas cuando el cliente agota el producto de prueba (visto en Three Bird Nest: talles
// agotados → sin botón "Add to Cart" → timeout del test, sin que la tienda esté rota).
// Ante cualquier error de red devuelve el path configurado, igual que antes.
async function pathPdpDisponible(request, site) {
  const base = site.baseUrl;
  const fijo = site.pdp?.path;
  const disponible = async (path) => {
    const r = await request.get(new URL(`${path.split('?')[0]}.js`, base).href, { timeout: 15000 });
    if (!r.ok()) return false;
    return (await r.json()).available === true;
  };
  try {
    if (fijo && (await disponible(fijo))) return fijo;
    for (const col of [site.collection?.path, '/collections/all']) {
      if (!col) continue;
      const r = await request.get(new URL(`${col}/products.json?limit=50`, base).href, { timeout: 15000 });
      if (!r.ok()) continue;
      const { products = [] } = await r.json();
      const p = products.find((x) => x.variants?.some((v) => v.available));
      if (p) return `/products/${p.handle}`;
    }
  } catch (e) {}
  return fijo;
}

module.exports = { pathPdpDisponible };
