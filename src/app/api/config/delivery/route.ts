import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const deliveryZoneSchema = z.object({
  nombre: z.string().min(1).max(80),
  precio: z.number().nonnegative(),
})

const patchSchema = z.object({
  delivery_enabled:      z.boolean(),
  delivery_fee_default:  z.number().nonnegative().default(0),
  delivery_zones:        z.array(deliveryZoneSchema).default([]),
})

/* ── GET /api/config/delivery ── */

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { settings: true },
  })

  const settings = (business?.settings ?? {}) as Record<string, unknown>
  const delivery = (settings.delivery ?? {}) as Record<string, unknown>

  return NextResponse.json({
    ok: true,
    delivery_enabled:     Boolean(delivery.delivery_enabled ?? false),
    delivery_fee_default: Number(delivery.delivery_fee_default ?? 0),
    delivery_zones:       (delivery.delivery_zones ?? []) as { nombre: string; precio: number }[],
  })
}

/* ── PATCH /api/config/delivery ── */

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const config = patchSchema.parse(body)

    const business = await prisma.business.findUnique({
      where:  { id: session.businessId },
      select: { settings: true },
    })

    const existingSettings = (business?.settings ?? {}) as Record<string, unknown>

    await prisma.business.update({
      where: { id: session.businessId },
      data:  {
        settings: {
          ...existingSettings,
          delivery: {
            delivery_enabled:     config.delivery_enabled,
            delivery_fee_default: config.delivery_fee_default,
            delivery_zones:       config.delivery_zones,
          },
        },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('config/delivery PATCH error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
