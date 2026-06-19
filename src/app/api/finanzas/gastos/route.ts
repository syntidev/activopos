import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { readCachedBcvRate } from '@/lib/bcv'
import { parsePeriodFromParams } from '@/lib/finanzas'

const CATEGORIAS = [
  'alquiler', 'servicios', 'nomina',
  'materiales', 'transporte', 'impuestos',
  'mantenimiento', 'marketing', 'otro',
  // legacy — aceptar en POST para no romper datos existentes
  'proveedor',
] as const

const gastoSchema = z.object({
  concepto:            z.string().trim().min(3).max(200),
  category:            z.enum(CATEGORIAS).optional(),
  categoria:           z.enum(CATEGORIAS).optional(),
  expense_category_id: z.number().int().positive().optional(),
  amount_usd:          z.number().positive().optional(),
  monto_usd:           z.number().positive().optional(),
  date:                z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:               z.string().max(500).optional(),
  notas:               z.string().max(500).optional(),
}).refine(d => d.amount_usd ?? d.monto_usd, {
  message: 'amount_usd requerido',
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp               = req.nextUrl.searchParams
  const { year, month }  = parsePeriodFromParams(sp)
  const from             = new Date(year, month - 1, 1)
  const to               = new Date(year, month, 1)
  const fromPrev         = new Date(year, month - 2, 1)
  const toPrev           = from

  const categoryFilter = sp.get('category') ?? sp.get('categoria')
  const validCat = categoryFilter && CATEGORIAS.includes(categoryFilter as typeof CATEGORIAS[number])
    ? categoryFilter : undefined

  const [gastos, gastosAnteriores] = await Promise.all([
    prisma.gasto.findMany({
      where: {
        business_id: session.businessId,
        fecha:       { gte: from, lt: to },
        ...(validCat ? { categoria: validCat } : {}),
      },
      orderBy: { fecha: 'desc' },
    }),

    prisma.gasto.aggregate({
      where: {
        business_id: session.businessId,
        fecha:       { gte: fromPrev, lt: toPrev },
      },
      _sum: { monto_usd: true },
    }),

  ])

  const rate       = await readCachedBcvRate()
  const r2         = (x: number) => Math.round(x * 100) / 100
  const totalUsd   = r2(gastos.reduce((s, g) => s + Number(g.monto_usd), 0))
  const prevUsd    = Number(gastosAnteriores._sum.monto_usd ?? 0)

  // Agrupado por categoría
  const catMap = new Map<string, { total_usd: number; count: number }>()
  for (const g of gastos) {
    const cat = g.categoria ?? 'otro'
    const entry = catMap.get(cat)
    if (entry) {
      entry.total_usd += Number(g.monto_usd)
      entry.count++
    } else {
      catMap.set(cat, { total_usd: Number(g.monto_usd), count: 1 })
    }
  }

  const byCategory = Array.from(catMap.entries()).map(([category, v]) => ({
    category,
    total_usd:  r2(v.total_usd),
    count:      v.count,
    percentage: totalUsd > 0 ? r2((v.total_usd / totalUsd) * 100) : 0,
  })).sort((a, b) => b.total_usd - a.total_usd)

  // Variación vs mes anterior
  const variacionPct = prevUsd > 0 ? r2(((totalUsd - prevUsd) / prevUsd) * 100) : 0
  const tendencia: 'up' | 'down' | 'stable' =
    Math.abs(variacionPct) < 1 ? 'stable' : variacionPct > 0 ? 'up' : 'down'

  return NextResponse.json({
    ok:   true,
    gastos: gastos.map(g => ({
      id:                  g.id,
      concepto:            g.concepto,
      category:            g.categoria,
      expense_category_id: g.category_id,
      amount_usd:          Number(g.monto_usd),
      amount_bs:           r2(Number(g.monto_usd) * rate),
      date:                g.fecha,
      notes:               g.notas,
      is_paid:             g.is_paid,
      paid_at:             g.paid_at,
      created_at:          g.created_at,
      // backward compat
      categoria:           g.categoria,
      monto_usd:           Number(g.monto_usd),
      fecha:               g.fecha,
      notas:               g.notas,
    })),
    totals: {
      total_usd:   totalUsd,
      total_bs:    r2(totalUsd * rate),
      by_category: byCategory,
    },
    vs_mes_anterior: {
      mes_anterior_usd: r2(prevUsd),
      variacion_pct:    variacionPct,
      tendencia,
    },
    // backward compat
    total_usd: totalUsd,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') {
    return NextResponse.json({ error: 'Solo administradores pueden registrar gastos' }, { status: 403 })
  }

  try {
    const raw  = await req.json()
    const body = gastoSchema.parse(raw)

    const montoUsd  = body.amount_usd ?? body.monto_usd ?? 0
    const categoria = body.category ?? body.categoria ?? 'otro'
    const fechaStr  = body.date ?? body.fecha
    const fecha     = fechaStr ? new Date(fechaStr) : new Date()
    const notas     = body.notes ?? body.notas ?? null

    // Validate category belongs to this tenant (IDOR guard)
    let validatedCategoryId: number | null = null
    if (body.expense_category_id) {
      const cat = await prisma.expenseCategory.findFirst({
        where: { id: body.expense_category_id, business_id: session.businessId, active: true },
        select: { id: true },
      })
      if (!cat) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
      validatedCategoryId = cat.id
    }

    const gasto = await prisma.gasto.create({
      data: {
        business_id:  session.businessId,
        concepto:     body.concepto,
        monto_usd:    montoUsd,
        categoria,
        category_id:  validatedCategoryId,
        fecha,
        notas,
        is_paid:      true,
        paid_at:      fecha,
        created_by:   session.userId,
      },
    })

    return NextResponse.json(
      {
        ok:    true,
        gasto: {
          ...gasto,
          amount_usd:          Number(gasto.monto_usd),
          monto_usd:           Number(gasto.monto_usd),
          expense_category_id: gasto.category_id,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('finanzas/gastos POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
