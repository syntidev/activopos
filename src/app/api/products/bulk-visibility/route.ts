import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const BulkSchema = z.object({
  product_ids:        z.array(z.number().int().positive()).min(1).max(50),
  catalog_visibility: z.enum(['visible', 'hidden', 'on_request']),
})

export async function PATCH(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = BulkSchema.parse(await req.json())

    // updateMany — el tenant layer inyecta business_id, garantizando que solo
    // se actualizan productos del propio negocio
    const result = await db.product.updateMany({
      where: { id: { in: body.product_ids } },
      data: { catalog_visibility: body.catalog_visibility },
    })

    return NextResponse.json({ ok: true, updated: result.count })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('bulk-visibility PATCH:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
