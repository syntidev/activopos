import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { PmType } from '@prisma/client'

const PostSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.nativeEnum(PmType).default('other'),
})

const CobroSchema = z.object({
  pago_movil_banco:    z.string().max(80).optional(),
  pago_movil_telefono: z.string().max(20).optional(),
  pago_movil_titular:  z.string().max(80).optional(),
  pago_movil_cedula:   z.string().max(15).optional(),
  zelle_contacto:      z.string().max(80).optional(),
  zelle_titular:       z.string().max(80).optional(),
  binance_id:          z.string().max(80).optional(),
  zinli_correo:        z.string().max(80).optional(),
})

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const methods = await db.paymentMethod.findMany({
      // business_id inyectado por el tenant layer
      orderBy: { sort_order: 'asc' },
    })

    return NextResponse.json({ ok: true, methods })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(request: Request) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const data = PostSchema.parse(await request.json())

    const maxOrder = await db.paymentMethod.aggregate({
      // business_id inyectado por el tenant layer
      _max: { sort_order: true },
    })

    const sort_order = (maxOrder._max.sort_order ?? 0) + 1

    const method = await db.paymentMethod.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        name: data.name,
        type: data.type,
        sort_order,
      },
    })

    return NextResponse.json({ ok: true, method }, { status: 201 })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }
}

export async function PATCH(request: Request) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const data = CobroSchema.parse(await request.json())

    // Business es la raíz del tenant (no tiene business_id) → no se filtra.
    const updated = await db.business.update({
      where:  { id: session.businessId },
      data:   { cobro_data: data },
      select: { id: true, cobro_data: true },
    })

    return NextResponse.json({ ok: true, cobro_data: updated.cobro_data })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }
}
