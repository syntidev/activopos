import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { readCachedBcvRate } from '@/lib/bcv'
import { parsePeriodFromParams } from '@/lib/finanzas'

const CATEGORIAS = [
  'alquiler', 'servicios', 'nomina', 'materiales', 'transporte',
  'impuestos', 'mantenimiento', 'marketing', 'otro', 'proveedor',
] as const

const PostSchema = z.object({
  concepto:    z.string().trim().min(3).max(200),
  monto_usd:   z.number().positive(),
  categoria:   z.enum(CATEGORIAS).optional(),
  category_id: z.number().int().positive().optional(),
  fecha:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notas:       z.string().max(500).nullish(),
  is_paid:     z.boolean().optional(),
  paid_at:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  supplier:    z.string().max(150).nullish(),
})

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const sp              = req.nextUrl.searchParams
    const { year, month } = parsePeriodFromParams(sp)
    const from            = new Date(year, month - 1, 1)
    const to              = new Date(year, month, 1)
    const tipo            = sp.get('tipo') // 'fijo' | 'variable'

    const [gastos, rate] = await Promise.all([
      db.gasto.findMany({
        where: {
          // business_id inyectado por el tenant layer
          fecha: { gte: from, lt: to },
          // 'fijo' = gasto recurrente con fecha de vencimiento; 'variable' = sin vencimiento
          ...(tipo === 'fijo'     ? { due_date: { not: null } } : {}),
          ...(tipo === 'variable' ? { due_date: null }          : {}),
        },
        orderBy: { fecha: 'desc' },
      }),
      readCachedBcvRate(),
    ])

    const r2 = (x: number) => Math.round(x * 100) / 100

    return NextResponse.json({
      ok: true,
      rate,
      gastos: gastos.map(g => ({
        id:          g.id,
        concepto:    g.concepto,
        monto_usd:   Number(g.monto_usd),
        monto_bs:    r2(Number(g.monto_usd) * rate),
        categoria:   g.categoria,
        category_id: g.category_id,
        fecha:       g.fecha instanceof Date ? g.fecha.toISOString().slice(0, 10) : String(g.fecha).slice(0, 10),
        notas:       g.notas,
        is_paid:     g.is_paid,
        paid_at:     g.paid_at,
        due_date:    g.due_date instanceof Date ? g.due_date.toISOString().slice(0, 10) : (g.due_date ?? null),
        supplier:    g.supplier,
        created_at:  g.created_at,
      })),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: z.infer<typeof PostSchema>
  try {
    body = PostSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  let validatedCategoryId: number | null = null
  if (body.category_id) {
    const cat = await prisma.expenseCategory.findFirst({
      where:  { id: body.category_id, business_id: session.businessId, active: true },
      select: { id: true },
    })
    if (!cat) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
    validatedCategoryId = cat.id
  }

  const fecha   = body.fecha   ? new Date(body.fecha)   : new Date()
  const is_paid = body.is_paid ?? true
  const paid_at = body.paid_at ? new Date(body.paid_at) : (is_paid ? fecha : null)
  const due_date = body.due_date ? new Date(body.due_date) : null

  const gasto = await prisma.gasto.create({
    data: {
      business_id:  session.businessId,
      concepto:     body.concepto,
      monto_usd:    body.monto_usd,
      categoria:    body.categoria ?? 'otro',
      category_id:  validatedCategoryId,
      fecha,
      notas:        body.notas ?? null,
      is_paid,
      paid_at,
      due_date,
      supplier:     body.supplier ?? null,
      created_by:   session.userId,
    },
  })

  return NextResponse.json(
    { ok: true, gasto: { ...gasto, monto_usd: Number(gasto.monto_usd) } },
    { status: 201 },
  )
}
