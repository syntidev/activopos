import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { businessDateKey, businessDayStart, shiftDateKey } from '@/lib/business-day'
import type {
  PulsoContactoDia,
  PulsoCount,
  PulsoDia,
  PulsoDias,
  PulsoFunnelStep,
  PulsoMetodo,
  PulsoMetodoKey,
  PulsoPanelData,
  PulsoProducto,
  PulsoVentaOrigen,
} from '@/types/pulso-panel'

// Tope por sesión para el tiempo promedio (una pestaña olvidada no debe inflarlo).
const MAX_SESSION_SECONDS = 1800
// Venezuela = UTC-4 fijo (sin horario de verano). catalog_events.created_at está en UTC;
// se usa como literal en el SQL para agrupar por día local: DATE_SUB(created_at, INTERVAL 4 HOUR).
const LOCAL_DAY = Prisma.sql`DATE_FORMAT(DATE_SUB(created_at, INTERVAL 4 HOUR), '%Y-%m-%d')`

type Num = bigint | number | string | null
const num = (v: Num | undefined): number => (v === null || v === undefined ? 0 : Number(v))

interface CountRow { k: string | null; n: Num }
interface VentaRow { k: string | null; pedidos: Num; usd: Num; bs: Num }

const toCounts = (rows: CountRow[]): PulsoCount[] =>
  rows.map(r => ({ label: r.k ?? 'Sin dato', count: num(r.n) }))

const toVentas = (rows: VentaRow[]): PulsoVentaOrigen[] =>
  rows.map(r => ({ label: r.k ?? 'Sin dato', pedidos: num(r.pedidos), usd: num(r.usd), bs: num(r.bs) }))

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

const METODO_LABEL: Record<PulsoMetodoKey, string> = {
  cashea: 'Cashea',
  bs: 'BCV (Bs)',
  divisa: 'Divisa',
  sin_declarar: 'Sin declarar',
}
const METODO_ORDER: PulsoMetodoKey[] = ['cashea', 'bs', 'divisa', 'sin_declarar']

/** Lista de fechas 'YYYY-MM-DD' desde `desdeKey` durante `dias` días. */
function dayKeys(desdeKey: string, dias: number): string[] {
  return Array.from({ length: dias }, (_, i) => shiftDateKey(desdeKey, i))
}

export async function getPulso(businessId: number, dias: PulsoDias): Promise<PulsoPanelData> {
  const bid = businessId
  const hoyKey = businessDateKey()
  const desdeKey = shiftDateKey(hoyKey, -(dias - 1))
  const desde = businessDayStart(desdeKey)
  const hoyInicio = businessDayStart(hoyKey)
  const hasta = businessDayStart(shiftDateKey(hoyKey, 1))

  // Filtro común: SIEMPRE business_id + rango (usa los índices (business_id, created_at) y (business_id, type, created_at)).
  const scope = Prisma.sql`business_id = ${bid} AND created_at >= ${desde} AND created_at < ${hasta}`
  const scopeE = Prisma.sql`e.business_id = ${bid} AND e.created_at >= ${desde} AND e.created_at < ${hasta}`
  // Una fila por sesión con sus atributos (los eventos de una sesión comparten dispositivo/origen).
  const sess = Prisma.sql`(
    SELECT session_id, MAX(device) AS device, MAX(country) AS country, MAX(city) AS city,
           MAX(utm_source) AS utm_source, MAX(referrer_host) AS referrer_host, MAX(utm_campaign) AS utm_campaign
    FROM catalog_events WHERE ${scope} GROUP BY session_id
  ) s`
  const sessSource = Prisma.sql`COALESCE(NULLIF(s.utm_source, ''), NULLIF(s.referrer_host, ''), 'Directo')`

  const [
    visitRows, serieRows, tiempoRows, equipoRows, paisRows, ciudadRows,
    fuenteRows, campanaRows,
    productoRows, marcaRows, deporteRows, sinResRows, topSearchRows,
    funnelRows, pagadoRows,
    ventaFuenteRows, ventaCampanaRows, ventaMetodoRows,
    contactoRows,
  ] = await Promise.all([
    // 1. Tráfico
    prisma.$queryRaw<{ total: Num; hoy: Num }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT session_id) AS total,
             COUNT(DISTINCT CASE WHEN created_at >= ${hoyInicio} THEN session_id END) AS hoy
      FROM catalog_events WHERE ${scope} AND type = 'page_view'`),
    prisma.$queryRaw<{ d: string; n: Num }[]>(Prisma.sql`
      SELECT ${LOCAL_DAY} AS d, COUNT(DISTINCT session_id) AS n
      FROM catalog_events WHERE ${scope} AND type = 'page_view' GROUP BY d`),
    prisma.$queryRaw<{ avg_s: Num }[]>(Prisma.sql`
      SELECT AVG(LEAST(t.dur, ${MAX_SESSION_SECONDS})) AS avg_s FROM (
        SELECT TIMESTAMPDIFF(SECOND, MIN(created_at), MAX(created_at)) AS dur
        FROM catalog_events WHERE ${scope} GROUP BY session_id HAVING COUNT(*) >= 2
      ) t`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COALESCE(s.device, 'desconocido') AS k, COUNT(*) AS n FROM ${sess} GROUP BY k ORDER BY n DESC`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT s.country AS k, COUNT(*) AS n FROM ${sess} WHERE s.country IS NOT NULL GROUP BY k ORDER BY n DESC LIMIT 8`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT s.city AS k, COUNT(*) AS n FROM ${sess} WHERE s.city IS NOT NULL GROUP BY k ORDER BY n DESC LIMIT 8`),
    // 2. Origen
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT ${sessSource} AS k, COUNT(*) AS n FROM ${sess} GROUP BY k ORDER BY n DESC LIMIT 8`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT s.utm_campaign AS k, COUNT(*) AS n FROM ${sess}
      WHERE s.utm_campaign IS NOT NULL AND s.utm_campaign <> '' GROUP BY k ORDER BY n DESC LIMIT 8`),
    // 3. Interés (todo cruce a products/brands lleva business_id)
    prisma.$queryRaw<{ id: Num; name: string; n: Num }[]>(Prisma.sql`
      SELECT e.product_id AS id, p.name AS name, COUNT(*) AS n
      FROM catalog_events e JOIN products p ON p.id = e.product_id AND p.business_id = ${bid}
      WHERE ${scopeE} AND e.type = 'product_view'
      GROUP BY e.product_id, p.name ORDER BY n DESC LIMIT 10`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT b.name AS k, COUNT(*) AS n
      FROM catalog_events e JOIN brands b ON b.id = e.brand_id AND b.business_id = ${bid}
      WHERE ${scopeE} AND e.type IN ('product_view', 'page_view') AND e.brand_id IS NOT NULL
      GROUP BY e.brand_id, b.name ORDER BY n DESC LIMIT 8`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT deporte AS k, COUNT(*) AS n FROM catalog_events
      WHERE ${scope} AND type = 'deporte_select' AND deporte IS NOT NULL
      GROUP BY deporte ORDER BY n DESC LIMIT 8`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT LOWER(TRIM(query)) AS k, COUNT(*) AS n FROM catalog_events
      WHERE ${scope} AND type = 'search' AND results_count = 0 AND TRIM(query) <> ''
      GROUP BY k ORDER BY n DESC LIMIT 10`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT LOWER(TRIM(query)) AS k, COUNT(*) AS n FROM catalog_events
      WHERE ${scope} AND type = 'search' AND TRIM(query) <> ''
      GROUP BY k ORDER BY n DESC LIMIT 10`),
    // 4. Embudo
    prisma.$queryRaw<{ visita: Num; ficha: Num; carrito: Num; pedido: Num }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT CASE WHEN type = 'page_view' THEN session_id END) AS visita,
             COUNT(DISTINCT CASE WHEN type = 'product_view' THEN session_id END) AS ficha,
             COUNT(DISTINCT CASE WHEN type = 'add_to_cart' THEN session_id END) AS carrito,
             COUNT(DISTINCT CASE WHEN type = 'order_created' THEN session_id END) AS pedido
      FROM catalog_events WHERE ${scope} AND type IN ('page_view', 'product_view', 'add_to_cart', 'order_created')`),
    prisma.$queryRaw<{ n: Num }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT e.session_id) AS n
      FROM catalog_events e
      JOIN orders o ON o.id = e.order_id AND o.business_id = ${bid}
      JOIN sales s ON s.id = o.sale_id AND s.business_id = ${bid}
      WHERE ${scopeE} AND e.type = 'order_created' AND s.status IN ('paid', 'partial_return')`),
    // 5. Ventas por origen (Bs = orders.total_bs, snapshot del pedido)
    prisma.$queryRaw<VentaRow[]>(Prisma.sql`
      SELECT COALESCE(NULLIF(e.utm_source, ''), NULLIF(e.referrer_host, ''), 'Directo') AS k,
             COUNT(*) AS pedidos, SUM(e.value_usd) AS usd, SUM(o.total_bs) AS bs
      FROM catalog_events e LEFT JOIN orders o ON o.id = e.order_id AND o.business_id = ${bid}
      WHERE ${scopeE} AND e.type = 'order_created' GROUP BY k ORDER BY usd DESC LIMIT 8`),
    prisma.$queryRaw<VentaRow[]>(Prisma.sql`
      SELECT e.utm_campaign AS k, COUNT(*) AS pedidos, SUM(e.value_usd) AS usd, SUM(o.total_bs) AS bs
      FROM catalog_events e LEFT JOIN orders o ON o.id = e.order_id AND o.business_id = ${bid}
      WHERE ${scopeE} AND e.type = 'order_created' AND e.utm_campaign IS NOT NULL AND e.utm_campaign <> ''
      GROUP BY k ORDER BY usd DESC LIMIT 8`),
    prisma.$queryRaw<VentaRow[]>(Prisma.sql`
      SELECT CASE WHEN o.payment_kind IN ('cashea', 'bs', 'divisa') THEN o.payment_kind ELSE 'sin_declarar' END AS k,
             COUNT(*) AS pedidos, SUM(e.value_usd) AS usd, SUM(o.total_bs) AS bs
      FROM catalog_events e LEFT JOIN orders o ON o.id = e.order_id AND o.business_id = ${bid}
      WHERE ${scopeE} AND e.type = 'order_created' GROUP BY k`),
    // 6. Contacto
    prisma.$queryRaw<{ type: string; d: string; n: Num }[]>(Prisma.sql`
      SELECT type, ${LOCAL_DAY} AS d, COUNT(*) AS n FROM catalog_events
      WHERE ${scope} AND type IN ('whatsapp_click', 'call_click') GROUP BY type, d`),
  ])

  const keys = dayKeys(desdeKey, dias)

  const serieMap = new Map(serieRows.map(r => [r.d, num(r.n)]))
  const serieDiaria: PulsoDia[] = keys.map(fecha => ({ fecha, visitantes: serieMap.get(fecha) ?? 0 }))

  const contactoMap = new Map<string, PulsoContactoDia>(
    keys.map(fecha => [fecha, { fecha, whatsapp: 0, llamadas: 0 }]),
  )
  let whatsapp = 0
  let llamadas = 0
  for (const r of contactoRows) {
    const row = contactoMap.get(r.d)
    const n = num(r.n)
    if (r.type === 'whatsapp_click') { whatsapp += n; if (row) row.whatsapp = n }
    else { llamadas += n; if (row) row.llamadas = n }
  }

  const f = funnelRows[0]
  const raw: Array<[PulsoFunnelStep['key'], string, number]> = [
    ['visita', 'Visitas', num(f?.visita)],
    ['ficha', 'Vieron un producto', num(f?.ficha)],
    ['carrito', 'Agregaron al carrito', num(f?.carrito)],
    ['pedido', 'Hicieron el pedido', num(f?.pedido)],
    ['pagado', 'Pedido pagado', num(pagadoRows[0]?.n)],
  ]
  const embudo: PulsoFunnelStep[] = raw.map(([key, label, sessions], i) => ({
    key,
    label,
    sessions,
    pctVisitas: pct(sessions, raw[0][2]),
    // El embudo cuenta sesiones por etapa sin anidarlas (decisión 16): un paso puede superar al anterior; se muestra tope 100%.
    pctPaso: i === 0 ? null : Math.min(100, pct(sessions, raw[i - 1][2])),
  }))

  const metodoMap = new Map(toVentas(ventaMetodoRows).map(v => [v.label, v]))
  const porMetodo: PulsoMetodo[] = METODO_ORDER.map(key => {
    const v = metodoMap.get(key)
    return { key, label: METODO_LABEL[key], pedidos: v?.pedidos ?? 0, usd: v?.usd ?? 0, bs: v?.bs ?? 0 }
  })

  const avg = tiempoRows[0]?.avg_s
  const productos: PulsoProducto[] = productoRows.map(r => ({ id: num(r.id), name: r.name, count: num(r.n) }))

  return {
    dias,
    generadoEn: new Date().toISOString(),
    desdeKey,
    hoyKey,
    trafico: {
      visitantesHoy: num(visitRows[0]?.hoy),
      visitantesRango: num(visitRows[0]?.total),
      tiempoPromedioSeg: avg === null || avg === undefined ? null : Math.round(Number(avg)),
      serieDiaria,
      equipos: toCounts(equipoRows),
      paises: toCounts(paisRows),
      ciudades: toCounts(ciudadRows),
    },
    origen: { fuentes: toCounts(fuenteRows), campanas: toCounts(campanaRows) },
    interes: {
      productos,
      marcas: toCounts(marcaRows),
      deportes: toCounts(deporteRows),
      busquedasSinResultado: toCounts(sinResRows),
      busquedasTop: toCounts(topSearchRows),
    },
    embudo,
    ventas: {
      pedidos: porMetodo.reduce((a, m) => a + m.pedidos, 0),
      usd: porMetodo.reduce((a, m) => a + m.usd, 0),
      bs: porMetodo.reduce((a, m) => a + m.bs, 0),
      porFuente: toVentas(ventaFuenteRows),
      porCampana: toVentas(ventaCampanaRows),
      porMetodo,
    },
    contacto: { whatsapp, llamadas, porDia: Array.from(contactoMap.values()) },
  }
}
