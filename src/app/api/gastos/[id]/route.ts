import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const CATEGORIAS = [
  'alquiler', 'servicios', 'nomina', 'materiales', 'transporte',
  'impuestos', 'mantenimiento', 'marketing', 'otro', 'proveedor',
] as const

const PatchSchema = z.object({
  concepto:    z.string().trim().min(3).max(200).optional(),
  monto_usd:   z.number().positive().optional(),
  categoria:   z.enum(CATEGORIAS).optional(),
  category_id: z.number().int().positive().nullish(),
  fecha:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notas:       z.string().max(500).nullish(),
  is_paid:     z.boolean().optional(),
  paid_at:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  supplier:    z.string().max(150).nullish(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    // IDOR: ownership verificado por el tenant layer (business_id inyectado)
    const existing = await db.gasto.findFirst({
      where:  { id },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const body = PatchSchema.parse(await req.json())

    // IDOR guard en categoría FK
    let validatedCategoryId: number | null | undefined = undefined
    if (body.category_id !== undefined) {
      if (body.category_id === null) {
        validatedCategoryId = null
      } else {
        const cat = await db.expenseCategory.findFirst({
          where:  { id: body.category_id, active: true }, // business_id inyectado
          select: { id: true },
        })
        if (!cat) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
        validatedCategoryId = cat.id
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.concepto  !== undefined) updateData.concepto  = body.concepto
    if (body.monto_usd !== undefined) updateData.monto_usd = body.monto_usd
    if (body.categoria !== undefined) updateData.categoria = body.categoria
    if (validatedCategoryId !== undefined) updateData.category_id = validatedCategoryId
    if (body.fecha     !== undefined) updateData.fecha    = new Date(body.fecha)
    if (body.notas     !== undefined) updateData.notas    = body.notas ?? null
    if (body.is_paid   !== undefined) updateData.is_paid  = body.is_paid
    if (body.paid_at   !== undefined) updateData.paid_at  = body.paid_at ? new Date(body.paid_at) : null
    if (body.due_date  !== undefined) updateData.due_date = body.due_date ? new Date(body.due_date) : null
    if (body.supplier  !== undefined) updateData.supplier = body.supplier ?? null

    const gasto = await db.gasto.update({
      where: { id }, // business_id inyectado por el tenant layer
      data:  updateData,
    })

    return NextResponse.json({ ok: true, gasto: { ...gasto, monto_usd: Number(gasto.monto_usd) } })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // IDOR: ownership verificado por el tenant layer (business_id inyectado)
    const existing = await db.gasto.findFirst({
      where:  { id },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    await db.gasto.delete({ where: { id } }) // business_id inyectado por el tenant layer

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
