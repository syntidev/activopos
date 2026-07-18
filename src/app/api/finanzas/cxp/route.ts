import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit } from '@/lib/plan-guard'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CATEGORIAS = ['alquiler', 'nomina', 'servicios', 'proveedor', 'otro'] as const

const DAYS_VENCER = 7
const DAYS_LEGACY = 30 // fallback para CxP sin due_date — mismo patrón que cxc/route.ts

function classifyDebt(due_date: Date | null, fecha: Date, now: Date): 'vigente' | 'por_vencer' | 'vencido' {
  const vencer7  = new Date(now.getTime() + DAYS_VENCER * 86_400_000)
  const deadline = due_date ?? new Date(fecha.getTime() + DAYS_LEGACY * 86_400_000)
  if (deadline < now) return 'vencido'
  if (deadline <= vencer7) return 'por_vencer'
  return 'vigente'
}

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
    const planGate = await checkPlanLimit('access_finanzas')
    if (!planGate.allowed) return NextResponse.json({ error: planGate.reason }, { status: 403 })

    const sp     = req.nextUrl.searchParams
    const cat    = sp.get('categoria')
    const status = sp.get('status') // vigente | por_vencer | vencido

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

    const now = new Date()

    const classified = gastos.map(({ supplier_ref, ...g }) => {
      const bucket   = classifyDebt(g.due_date, g.fecha, now)
      const deadline = g.due_date ?? new Date(g.fecha.getTime() + DAYS_LEGACY * 86_400_000)
      const diasVencido = bucket === 'vencido'
        ? Math.floor((now.getTime() - deadline.getTime()) / 86_400_000)
        : 0

      return {
        ...g,
        fecha:        g.fecha instanceof Date ? g.fecha.toISOString().slice(0, 10) : String(g.fecha).slice(0, 10),
        due_date:     deadline.toISOString().slice(0, 10),
        monto_usd:    Number(g.monto_usd),
        supplier:     supplier_ref ? { id: supplier_ref.id, name: supplier_ref.name } : null,
        bucket,
        dias_vencido: diasVencido,
      }
    })

    const vencido_usd    = Math.round(classified.filter(c => c.bucket === 'vencido').reduce((s, c) => s + c.monto_usd, 0) * 100) / 100
    const por_vencer_usd = Math.round(classified.filter(c => c.bucket === 'por_vencer').reduce((s, c) => s + c.monto_usd, 0) * 100) / 100
    const vigente_usd    = Math.round(classified.filter(c => c.bucket === 'vigente').reduce((s, c) => s + c.monto_usd, 0) * 100) / 100

    const filtered = status ? classified.filter(c => c.bucket === status) : classified
    const total    = Math.round(filtered.reduce((s, c) => s + c.monto_usd, 0) * 100) / 100

    return NextResponse.json({
      ok:   true,
      cxp:  filtered,
      total_usd: total,
      vencido_usd,
      por_vencer_usd,
      vigente_usd,
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
  const planGate = await checkPlanLimit('access_finanzas')
  if (!planGate.allowed) return NextResponse.json({ error: planGate.reason }, { status: 403 })

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
