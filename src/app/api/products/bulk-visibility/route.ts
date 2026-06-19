import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BulkSchema = z.object({
  product_ids:        z.array(z.number().int().positive()).min(1).max(50),
  catalog_visibility: z.enum(['visible', 'hidden', 'on_request']),
})

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = BulkSchema.parse(await req.json())

    // updateMany con business_id garantiza que solo se actualizan productos del tenant
    const result = await prisma.product.updateMany({
      where: {
        id:          { in: body.product_ids },
        business_id: session.businessId,
      },
      data: { catalog_visibility: body.catalog_visibility },
    })

    return NextResponse.json({ ok: true, updated: result.count })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('bulk-visibility PATCH:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
