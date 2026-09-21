import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  RESERVAS_LIST_LIMIT,
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

// GET /api/reservas/demanda?collection=200k-2027
// Cuenta UNIDADES (suma de `cantidad`) por kit + talla: es el número real que se
// usa para la orden de fabricación (ej. "Maillot M: 47"). Los ítems extra se
// agregan aparte (por nombre + talla) porque también hay que fabricarlos.
export async function GET(req: NextRequest) {
  try {
    const access = await requireReservasAccess()
    if (access instanceof NextResponse) return access
    const { session, db } = access

    const param = parseCollectionParam(req.nextUrl.searchParams.get('collection'))
    if (!param.ok) return NextResponse.json({ error: param.error }, { status: 400 })

    const where = reservasByCollection(param.slug, session.businessId)

    const [groups, withExtras] = await Promise.all([
      db.reserva.groupBy({
        by:     ['kit_id', 'talla'],
        where,
        _sum:   { cantidad: true },
        _count: { _all: true },
      }),
      db.reserva.findMany({
        where,
        select: { extras: true },
        take:   RESERVAS_LIST_LIMIT,
      }),
    ])

    const kits = await db.product.findMany({
      where:  { id: { in: Array.from(new Set(groups.map(g => g.kit_id))) } },
      select: { id: true, name: true },
    })
    const kitName = new Map(kits.map(k => [k.id, k.name]))

    const items: DemandaItem[] = groups
      .map(g => ({
        kit_id:     g.kit_id,
        kit_nombre: kitName.get(g.kit_id) ?? `Kit #${g.kit_id}`,
        talla:      g.talla,
        unidades:   g._sum.cantidad ?? 0,
        reservas:   g._count._all,
      }))
      .sort((a, b) => a.kit_nombre.localeCompare(b.kit_nombre) || compareTalla(a.talla, b.talla))

    const extrasMap = new Map<string, DemandaExtra>()
    for (const row of withExtras) {
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
      total_unidades: items.reduce((sum, i) => sum + i.unidades, 0),
      items,
      extras,
    }
    return NextResponse.json(body)
  } catch (err) {
    return handleReservaError(err, 'GET /api/reservas/demanda')
  }
}
