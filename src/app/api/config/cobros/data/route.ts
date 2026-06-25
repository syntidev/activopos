import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Mismo formato flat que payment-methods/route.ts — coexistencia sin colisión.
// PATCH hace merge (Object.assign) en vez de reemplazar, protegiendo keys del otro endpoint.
const CobroDataSchema = z.object({
  pago_movil_banco:    z.string().max(80).optional(),
  pago_movil_telefono: z.string().max(20).optional(),
  pago_movil_titular:  z.string().max(80).optional(),
  pago_movil_cedula:   z.string().max(15).optional(),
  zelle_contacto:      z.string().max(80).optional(),
  zelle_titular:       z.string().max(80).optional(),
  binance_id:          z.string().max(80).optional(),
  zinli_correo:        z.string().max(80).optional(),
  paypal_correo:       z.string().max(80).optional(),
  usdt_address:        z.string().max(100).optional(),
}).strict()

type CobroDataShape = z.infer<typeof CobroDataSchema>

const EMPTY_COBRO: CobroDataShape = {
  pago_movil_banco: '', pago_movil_telefono: '', pago_movil_titular: '', pago_movil_cedula: '',
  zelle_contacto: '', zelle_titular: '', binance_id: '', zinli_correo: '',
  paypal_correo: '', usdt_address: '',
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { cobro_data: true },
  })

  return NextResponse.json({
    ok:         true,
    cobro_data: business?.cobro_data ?? EMPTY_COBRO,
  })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let incoming: CobroDataShape
  try {
    incoming = CobroDataSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  // Merge para no destruir keys escritas por payment-methods PATCH
  const current = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { cobro_data: true },
  })

  const merged = Object.assign({}, current?.cobro_data ?? {}, incoming)

  const updated = await prisma.business.update({
    where:  { id: session.businessId },
    data:   { cobro_data: merged },
    select: { cobro_data: true },
  })

  return NextResponse.json({ ok: true, cobro_data: updated.cobro_data })
}
