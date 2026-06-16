import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CATEGORIAS = ['alquiler', 'nomina', 'servicios', 'proveedor', 'otro'] as const

const gastoSchema = z.object({
  concepto:  z.string().min(3).max(150),
  monto_usd: z.number().positive(),
  categoria: z.enum(CATEGORIAS).default('otro'),
  fecha:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  notas:     z.string().max(500).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const monthParam = sp.get('month') ?? ''
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthParam)

  const now = new Date()
  const year  = monthMatch ? parseInt(monthMatch[1], 10) : now.getFullYear()
  const month = monthMatch ? parseInt(monthMatch[2], 10) - 1 : now.getMonth()
  const from  = new Date(year, month, 1)
  const to    = new Date(year, month + 1, 1)

  const gastos = await prisma.gasto.findMany({
    where: {
      business_id: session.businessId,
      fecha: { gte: from, lt: to },
    },
    orderBy: { fecha: 'desc' },
  })

  const total = gastos.reduce((s, g) => s + Number(g.monto_usd), 0)

  return NextResponse.json({
    ok: true,
    gastos: gastos.map(g => ({ ...g, monto_usd: Number(g.monto_usd) })),
    total_usd: Math.round(total * 100) / 100,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') {
    return NextResponse.json({ error: 'Solo administradores pueden registrar gastos' }, { status: 403 })
  }

  try {
    const body = gastoSchema.parse(await req.json())

    const gasto = await prisma.gasto.create({
      data: {
        business_id: session.businessId,
        concepto:    body.concepto,
        monto_usd:   body.monto_usd,
        categoria:   body.categoria,
        fecha:       new Date(body.fecha),
        notas:       body.notas ?? null,
        is_paid:     true,
        paid_at:     new Date(body.fecha),
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
    console.error('finanzas/gastos POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
