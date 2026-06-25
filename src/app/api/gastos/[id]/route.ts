import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  // IDOR: verificar ownership antes de cualquier operación
  const existing = await prisma.gasto.findFirst({
    where:  { id, business_id: session.businessId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  // IDOR guard en categoría FK
  let validatedCategoryId: number | null | undefined = undefined
  if (body.category_id !== undefined) {
    if (body.category_id === null) {
      validatedCategoryId = null
    } else {
      const cat = await prisma.expenseCategory.findFirst({
        where:  { id: body.category_id, business_id: session.businessId, active: true },
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

  const gasto = await prisma.gasto.update({
    where: { id },
    data:  updateData,
  })

  return NextResponse.json({ ok: true, gasto: { ...gasto, monto_usd: Number(gasto.monto_usd) } })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  // IDOR: verificar ownership antes de eliminar
  const existing = await prisma.gasto.findFirst({
    where:  { id, business_id: session.businessId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.gasto.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
