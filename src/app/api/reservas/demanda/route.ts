import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  RESERVAS_LIST_LIMIT,
  componentesTallasSchema,
  extraSchema,
  handleReservaError,
  parseCollectionParam,
  requireReservasAccess,
  reservasByCollection,
} from '@/lib/reservas'
import type { DemandaExtra, DemandaItem, DemandaResponse } from '@/types/reservas'

const TALLA_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

/** XS < S < M < L < XL...; tallas fuera de la lista van después, alfabéticas; sin talla al final. */
function compareTalla(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  const ia = TALLA_ORDER.indexOf(a.toUpperCase())
  const ib = TALLA_ORDER.indexOf(b.toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b)
}

interface Bucket {
  kit_id:     number
  componente: string | null
  talla:      string | null
  unidades:   number
  reservas:   number
}

// GET /api/reservas/demanda?collection=200k-2027
// Cuenta UNIDADES (suma de `cantidad`) por kit (+ componente, si la reserva trae
// desglose) + talla: es el número real que se usa para la orden de fabricación
// (ej. "Maillot M: 47"). componentes_tallas es JSON -- no agrupable con SQL
// groupBy, se agrega en memoria. Una reserva con Maillot L + Franela S aporta
// a 2 buckets (hace falta 1 de cada pieza) pero cuenta 1 sola vez en
// total_unidades (eso sigue siendo "cuántos kits", no "cuántas piezas").
// Los ítems extra se agregan aparte (por nombre + talla) porque también hay
// que fabricarlos.
export async function GET(req: NextRequest) {
  try {
    const access = await requireReservasAccess()
    if (access instanceof NextResponse) return access
    const { session, db } = access

    const param = parseCollectionParam(req.nextUrl.searchParams.get('collection'))
    if (!param.ok) return NextResponse.json({ error: param.error }, { status: 400 })

    const where = reservasByCollection(param.slug, session.businessId)

    const rows = await db.reserva.findMany({
      where,
      select: { kit_id: true, talla: true, componentes_tallas: true, cantidad: true, extras: true },
      take:   RESERVAS_LIST_LIMIT,
    })

    const buckets = new Map<string, Bucket>()
    let totalUnidades = 0
    for (const row of rows) {
      totalUnidades += row.cantidad
      const parsedTallas = componentesTallasSchema.safeParse(row.componentes_tallas)
      const entries: [string | null, string | null][] =
        parsedTallas.success && Object.keys(parsedTallas.data).length > 0
          ? Object.entries(parsedTallas.data)
          : [[null, row.talla]]
      for (const [componente, talla] of entries) {
        const key = `${row.kit_id}|${componente ?? ''}|${talla ?? ''}`
        const prev = buckets.get(key)
        buckets.set(key, {
          kit_id:     row.kit_id,
          componente,
          talla,
          unidades:   (prev?.unidades ?? 0) + row.cantidad,
          reservas:   (prev?.reservas ?? 0) + 1,
        })
      }
    }

    const kits = await db.product.findMany({
      where:  { id: { in: Array.from(new Set(Array.from(buckets.values()).map(b => b.kit_id))) } },
      select: { id: true, name: true },
    })
    const kitName = new Map(kits.map(k => [k.id, k.name]))

    const items: DemandaItem[] = Array.from(buckets.values())
      .map(b => ({
        kit_id:     b.kit_id,
        kit_nombre: kitName.get(b.kit_id) ?? `Kit #${b.kit_id}`,
        componente: b.componente,
        talla:      b.talla,
        unidades:   b.unidades,
        reservas:   b.reservas,
      }))
      .sort((a, b) => a.kit_nombre.localeCompare(b.kit_nombre)
        || (a.componente ?? '').localeCompare(b.componente ?? '')
        || compareTalla(a.talla, b.talla))

    const extrasMap = new Map<string, DemandaExtra>()
    for (const row of rows) {
      const parsed = z.array(extraSchema).safeParse(row.extras)
      if (!parsed.success) continue
      for (const e of parsed.data) {
        const talla = e.talla ?? null
        const key = `${e.nombre.toLowerCase()}|${talla ?? ''}`
        const prev = extrasMap.get(key)
        extrasMap.set(key, { nombre: prev?.nombre ?? e.nombre, talla, unidades: (prev?.unidades ?? 0) + e.cantidad })
      }
    }
    const extras = Array.from(extrasMap.values())
      .sort((a, b) => a.nombre.localeCompare(b.nombre) || compareTalla(a.talla, b.talla))

    const body: DemandaResponse = {
      ok:             true,
      collection:     param.slug,
      total_unidades: totalUnidades,
      items,
      extras,
    }
    return NextResponse.json(body)
  } catch (err) {
    return handleReservaError(err, 'GET /api/reservas/demanda')
  }
}
