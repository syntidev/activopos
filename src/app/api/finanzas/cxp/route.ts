import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CATEGORIAS = ['alquiler', 'nomina', 'servicios', 'proveedor', 'otro'] as const

const cxpSchema = z.object({
  concepto:    z.string().min(3).max(150),
  monto_usd:   z.number().positive(),
  categoria:   z.enum(CATEGORIAS).default('otro'),
  fecha:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  notas:       z.string().max(500).optional(),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  supplier:    z.string().max(150).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const sp  = req.nextUrl.searchParams
    const cat = sp.get('categoria')

    const gastos = await db.gasto.findMany({
      where: {
        // business_id inyectado por el tenant layer
        is_paid: false,
        status: { not: 'cancelled' }, // las CxP anuladas (soft delete) no aparecen en la UI
        ...(cat && CATEGORIAS.includes(cat as typeof CATEGORIAS[number])
          ? { categoria: cat }
          : {}),
      },
      include: { supplier_ref: { select: { id: true, name: true } } },
      orderBy: { fecha: 'asc' },
    })

    const total = Math.round(gastos.reduce((s, g) => s + Number(g.monto_usd), 0) * 100) / 100

    return NextResponse.json({
      ok:   true,
      cxp:  gastos.map(({ supplier_ref, ...g }) => ({
        ...g,
        fecha:     g.fecha    instanceof Date ? g.fecha.toISOString().slice(0, 10)    : String(g.fecha).slice(0, 10),
        due_date:  g.due_date instanceof Date ? g.due_date.toISOString().slice(0, 10) : (g.due_date ?? null),
        monto_usd: Number(g.monto_usd),
        supplier:  supplier_ref ? { id: supplier_ref.id, name: supplier_ref.name } : null,
      })),
      total_usd: total,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') {
    return NextResponse.json({ error: 'Solo administradores pueden registrar CxP' }, { status: 403 })
  }

  try {
    const body = cxpSchema.parse(await req.json())

    const gasto = await prisma.gasto.create({
      data: {
        business_id: session.businessId,
        concepto:    body.concepto,
        monto_usd:   body.monto_usd,
        categoria:   body.categoria,
        fecha:       new Date(body.fecha),
        notas:       body.notas ?? null,
        is_paid:     false,
        paid_at:     null,
        due_date:    body.due_date ? new Date(body.due_date) : null,
        supplier:    body.supplier ?? null,
        created_by:  session.userId,
      },
    })

    return NextResponse.json(
      { ok: true, gasto: { ...gasto, monto_usd: Number(gasto.monto_usd) } },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('finanzas/cxp POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
