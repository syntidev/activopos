import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

// Nombres que envía la UI — se mapean a los campos del modelo BusinessDevice al persistir
const DEVICE_TYPES_UI = ['debit', 'credit', 'biopago'] as const

const PostSchema = z.object({
  tipo:         z.enum(DEVICE_TYPES_UI),
  banco:        z.string().min(1).max(80),
  serial:       z.string().max(60).nullish(),
  nro_comercio: z.string().max(40).nullish(),
  is_active:    z.boolean().optional(),
}).strict()

type DBDevice = {
  id: number; business_id: number; type: string; bank_name: string
  serial: string | null; commercial_number: string | null; is_active: boolean
}

function toUI(d: DBDevice) {
  return {
    id:           d.id,
    business_id:  d.business_id,
    tipo:         d.type,
    banco:        d.bank_name,
    serial:       d.serial,
    nro_comercio: d.commercial_number,
    is_active:    d.is_active,
  }
}

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const devices = await db.businessDevice.findMany({
      // business_id inyectado por el tenant layer
      orderBy: { created_at: 'asc' },
    })

    return NextResponse.json({ ok: true, devices: devices.map(toUI) })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: Request) {
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

  const device = await prisma.businessDevice.create({
    data: {
      business_id:       session.businessId,
      type:              body.tipo,
      bank_name:         body.banco,
      serial:            body.serial       ?? null,
      commercial_number: body.nro_comercio ?? null,
      is_active:         body.is_active    ?? true,
    },
  })

  return NextResponse.json({ ok: true, device: toUI(device) }, { status: 201 })
}
