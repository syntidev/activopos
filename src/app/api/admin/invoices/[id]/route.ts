import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { type PlanTier } from '@/lib/plan-limits'

type RouteContext = { params: { id: string } }

// Meses por ciclo — se suman a "ahora" para el vencimiento del plan al aprobar.
const CYCLE_MONTHS: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }

const PatchSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    notes:  z.string().max(1000).optional(),
    // Al aprobar, el admin elige plan y ciclo en el modal — el Invoice no los guarda.
    plan:   z.enum(['gratis', 'negocio_activo']).optional(),
    ciclo:  z.enum(['mensual', 'trimestral', 'semestral', 'anual']).optional(),
  })
  .refine(b => b.action !== 'approve' || !!b.plan, { message: 'Al aprobar se requiere plan', path: ['plan'] })
  .refine(b => b.action !== 'approve' || b.plan !== 'negocio_activo' || !!b.ciclo, {
    message: 'negocio_activo requiere ciclo', path: ['ciclo'],
  })

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const inv = await prisma.invoice.findUnique({
    where:   { id },
    include: { business: { select: { name: true, email: true, phone: true } } },
  })
  if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  // reviewed_by es el id del admin; la UI muestra el nombre.
  let reviewerName: string | null = null
  if (inv.reviewed_by) {
    const reviewer = await prisma.user.findUnique({ where: { id: inv.reviewed_by }, select: { name: true } })
    reviewerName = reviewer?.name ?? null
  }

  return NextResponse.json({
    ok: true,
    invoice: {
      id:             inv.id,
      invoice_number: inv.invoice_number,
      status:         inv.status,
      business:       { name: inv.business.name, email: inv.business.email, phone: inv.business.phone },
      channel:        inv.channel,
      reference:      inv.reference,
      amount_usd:     Number(inv.amount_usd),
      created_at:     inv.created_at,
      period:         inv.period,
      review:         inv.reviewed_at
        ? { notes: inv.admin_notes, reviewed_by: reviewerName, reviewed_at: inv.reviewed_at }
        : null,
    },
  })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const inv = await prisma.invoice.findUnique({ where: { id }, select: { id: true, business_id: true } })
  if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

  const reviewFields = {
    admin_notes: data.notes?.trim() || null,
    reviewed_by: session.userId,
    reviewed_at: new Date(),
  }

  if (data.action === 'reject') {
    await prisma.invoice.update({ where: { id }, data: { status: 'rejected', ...reviewFields } })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  // approve: marca la factura pagada Y activa el plan del tenant en una transacción.
  // gratis nunca vence; negocio_activo vence a los N meses del ciclo elegido.
  const plan = data.plan as PlanTier
  const expiresAt =
    plan === 'negocio_activo' && data.ciclo
      ? (() => {
          const d = new Date()
          d.setMonth(d.getMonth() + CYCLE_MONTHS[data.ciclo])
          return d
        })()
      : null

  await prisma.$transaction([
    prisma.invoice.update({ where: { id }, data: { status: 'paid', ...reviewFields } }),
    prisma.business.update({
      where: { id: inv.business_id },
      data: {
        catalog_plan:            plan,
        subscription_active:     true,
        subscription_expires_at: expiresAt,
      },
    }),
  ])

  return NextResponse.json({ ok: true, status: 'paid', plan, expires_at: expiresAt })
}
