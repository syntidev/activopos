import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const PatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  legal_name: z.string().max(255).optional(),
  rif: z.string().max(20).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logo_path: z.string()
    .refine(v => v === null || v.startsWith('/uploads/'), 'Path inválido')
    .nullable()
    .optional(),
  rate_source:      z.enum(['bcv', 'manual']).optional(),
  rate:             z.number().positive().optional(),
  segment:          z.string().max(50).optional(),
  max_discount_pct: z.number().min(0).max(100).optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: {
      id: true,
      name: true,
      legal_name: true,
      rif: true,
      logo_path: true,
      address: true,
      city: true,
      state: true,
      phone: true,
      email: true,
      theme: true,
      theme_color: true,
      rate_source: true,
      segment: true,
      max_discount_pct: true,
    },
  })

  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const latestRate = await prisma.dollarRate.findFirst({
    orderBy: { created_at: 'desc' },
    select: { rate: true },
  })

  const current_rate = latestRate ? Number(latestRate.rate) : 36.50

  return NextResponse.json({ ok: true, business, current_rate })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body: unknown = await request.json()

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const { rate, ...businessFields } = data

  if (businessFields.rate_source === 'manual' && rate !== undefined) {
    // SEC-002: DollarRate no tiene business_id — crear tasas aquí afectaría todos los tenants.
    return NextResponse.json(
      { error: 'Use el endpoint /api/rates/bcv para actualizar la tasa' },
      { status: 400 },
    )
  }

  const updated = await prisma.business.update({
    where: { id: session.businessId },
    data: businessFields,
    select: {
      id: true,
      name: true,
      legal_name: true,
      rif: true,
      logo_path: true,
      address: true,
      city: true,
      state: true,
      phone: true,
      email: true,
      theme: true,
      theme_color: true,
      rate_source: true,
      segment: true,
      max_discount_pct: true,
    },
  })

  return NextResponse.json({ ok: true, business: updated })
}
