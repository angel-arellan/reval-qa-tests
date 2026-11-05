// Cliente mínimo del servidor MCP de Reval (JSON-RPC sobre HTTP) para los tests del panel.
//
// Por qué así y no por la pantalla del admin: desde GitHub Actions el admin de Shopify pide
// login con verificación y Cloudflare frena a sus servidores, así que la pantalla nunca carga.
// El MCP de Reval expone los mismos datos que muestra el panel (Inicio, Suscripciones, Clientes,
// Pedidos, Planes, Cajas, Configuración) con una clave de SOLO LECTURA generada en
// Reval → API & MCP. Con la clave el test entra de verdad; sin ella, falla diciendo por qué.

const { expect } = require('@playwright/test');

const PROTOCOLO = '2025-06-18';

async function conectarReval(request, { url, clave, secreto }) {
  if (!clave) {
    throw new Error(
      `No se pudo entrar al panel de Reval: falta la clave de solo lectura (secret ${secreto} en GitHub). ` +
        'Generarla en Reval → API & MCP → Generar clave, tipo «Solo lectura».'
    );
  }
  let sesion = null;
  let id = 0;
  const headers = () => ({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${clave}`,
    'MCP-Protocol-Version': PROTOCOLO,
    ...(sesion ? { 'Mcp-Session-Id': sesion } : {}),
  });

  const llamar = async (method, params) => {
    const r = await request.post(url, { headers: headers(), data: { jsonrpc: '2.0', id: ++id, method, params }, timeout: 30000 });
    if (r.headers()['mcp-session-id']) sesion = r.headers()['mcp-session-id'];
    const texto = await r.text();
    if (r.status() === 401) {
      throw new Error(`No se pudo entrar al panel de Reval: la clave fue rechazada (401). Puede estar revocada, vencida o mal copiada en el secret ${secreto}.`);
    }
    if (!r.ok()) throw new Error(`Reval respondió HTTP ${r.status()} a ${method}: ${texto.slice(0, 200)}`);
    let json;
    if (/text\/event-stream/.test(r.headers()['content-type'] || '')) {
      const datos = texto.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean);
      json = JSON.parse(datos[datos.length - 1]);
    } else {
      json = JSON.parse(texto);
    }
    if (json.error) throw new Error(`Reval devolvió un error en ${method}: ${json.error.message}`);
    return json.result;
  };

  await llamar('initialize', { protocolVersion: PROTOCOLO, capabilities: {}, clientInfo: { name: 'reval-qa-tests', version: '1.0' } });
  await request.post(url, { headers: headers(), data: { jsonrpc: '2.0', method: 'notifications/initialized' }, timeout: 15000 }).catch(() => {});

  return {
    async herramientas() {
      return ((await llamar('tools/list', {})).tools || []).map((t) => t.name);
    },
    // Llama una herramienta y devuelve sus datos ya parseados. Falla si Reval marca error o si
    // la respuesta trae valores rotos (NaN / undefined), igual que se pedía en la pantalla.
    async usar(nombre, args = {}) {
      const res = await llamar('tools/call', { name: nombre, arguments: args });
      const texto = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      if (res.isError) throw new Error(`${nombre} devolvió un error: ${texto.slice(0, 300)}`);
      expect(texto, `${nombre}: la respuesta trae valores rotos (NaN)`).not.toMatch(/\bNaN\b/);
      expect(texto, `${nombre}: la respuesta trae valores rotos (undefined)`).not.toMatch(/\bundefined\b/);
      return res.structuredContent ?? JSON.parse(texto);
    },
  };
}

// Los mismos chequeos para staging y producción: cada uno es un módulo del panel.
function testsDelPanel(test, { prefijo, url, secreto, conDatos }) {
  let reval;
  const entrar = async (request) => {
    if (!reval) reval = await conectarReval(request, { url, clave: process.env[secreto], secreto });
    return reval;
  };
  const numero = (v, campo) => expect(Number.isFinite(v), `${campo} no es un número válido (${v})`).toBe(true);

  test(`${prefijo} - PANEL01: Acceso al panel (clave de solo lectura)`, async ({ request }) => {
    const r = await entrar(request);
    const tools = await r.herramientas();
    for (const t of ['get_dashboard_metrics', 'list_subscriptions', 'search_customers', 'list_orders', 'list_plans', 'list_boxes', 'get_store']) {
      expect(tools, `El panel no ofrece «${t}»`).toContain(t);
    }
  });

  test(`${prefijo} - PANEL02: Inicio (métricas del panel)`, async ({ request }) => {
    const m = await (await entrar(request)).usar('get_dashboard_metrics', { period: 'last_30_days' });
    for (const [k, v] of Object.entries(m.kpis || {})) numero(v.value, `Inicio → ${k}`);
    for (const [k, v] of Object.entries(m.subscriptionsByStatus || {})) numero(v, `Inicio → suscripciones ${k}`);
    numero(m.mrr, 'Inicio → MRR');
    expect(Array.isArray(m.daily), 'Inicio: falta la serie diaria del gráfico').toBe(true);
  });

  test(`${prefijo} - PANEL03: Suscripciones (listado y detalle)`, async ({ request }) => {
    const r = await entrar(request);
    const lista = await r.usar('list_subscriptions', { first: 5 });
    numero(lista.totalCount, 'Suscripciones → total');
    const filas = lista.subscriptions || lista.items || [];
    if (conDatos) expect(filas.length, 'Suscripciones: el listado vino vacío').toBeGreaterThan(0);
    if (filas[0]?.id) {
      const detalle = await r.usar('get_subscription', { id: filas[0].id });
      expect(JSON.stringify(detalle), 'Suscripciones: el detalle no corresponde al listado').toContain(filas[0].id);
    }
  });

  test(`${prefijo} - PANEL04: Clientes (búsqueda y ficha)`, async ({ request }) => {
    const r = await entrar(request);
    const lista = await r.usar('search_customers', { first: 5 });
    const filas = lista.customers || lista.items || [];
    if (conDatos) expect(filas.length, 'Clientes: el listado vino vacío').toBeGreaterThan(0);
    if (filas[0]?.email) {
      const ficha = await r.usar('get_customer', { email: filas[0].email });
      expect(JSON.stringify(ficha).toLowerCase(), 'Clientes: la ficha no corresponde al cliente buscado').toContain(filas[0].email.toLowerCase());
    }
  });

  test(`${prefijo} - PANEL05: Pedidos (listado y detalle)`, async ({ request }) => {
    const r = await entrar(request);
    const lista = await r.usar('list_orders', { first: 5 });
    const filas = lista.orders || lista.items || [];
    if (conDatos) expect(filas.length, 'Pedidos: el listado vino vacío').toBeGreaterThan(0);
    if (filas[0]?.id) await r.usar('get_order', { id: filas[0].id });
  });

  test(`${prefijo} - PANEL06: Planes y cajas`, async ({ request }) => {
    const r = await entrar(request);
    const planes = await r.usar('list_plans', { first: 10, status: 'all' });
    numero(planes.totalCount, 'Planes → total');
    for (const p of planes.plans || []) expect(p.frequency?.every, `El plan «${p.title}» no tiene frecuencia`).toBeTruthy();
    const cajas = await r.usar('list_boxes', { first: 10, status: 'all' });
    expect(Array.isArray(cajas.boxes || cajas.items), 'Cajas: la respuesta no trae el listado').toBe(true);
  });

  test(`${prefijo} - PANEL07: Configuración de la tienda`, async ({ request }) => {
    const s = await (await entrar(request)).usar('get_store');
    expect(Object.keys(s || {}).length, 'Configuración: la respuesta vino vacía').toBeGreaterThan(3);
  });
}

module.exports = { conectarReval, testsDelPanel };
