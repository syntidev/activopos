import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { advanceItem, kdsActionSchema, requireKdsAccess, serveItem } from '@/lib/restaurante-kds'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

const serveSchema = z.object({ action: z.literal('servido'), order_id: z.number().int().positive() })

// PATCH /api/restaurante/kds/items/[id]
//  cocina:  { action: iniciar|listo|deshacer|visto, scope?: item|comanda }
//  sala:    { action: 'servido', order_id }  (mesonero, cajero o admin)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const itemId = Number(params.id)
    if (!Number.isInteger(itemId) || itemId <= 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const raw = await readJson(req)

    const serve = serveSchema.safeParse(raw)
    if (serve.success) {
      const access = await requireRestauranteAccess()
      if (access instanceof NextResponse) return access
      await serveItem(access.db, access.session.businessId, serve.data.order_id, itemId)
      return NextResponse.json({ ok: true })
    }

    const access = await requireKdsAccess()
    if (access instanceof NextResponse) return access
    const parsed = kdsActionSchema.safeParse(raw)
    if (!parsed.success) return badRequest(parsed.error)
    const result = await advanceItem(access.db, access.session.businessId, access, itemId, parsed.data.action, parsed.data.scope ?? 'item')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return handleRestauranteError(err, 'PATCH /api/restaurante/kds/items/[id]')
  }
}
