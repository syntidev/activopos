import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const DEVICE_TYPES = ['punto_venta', 'datafono', 'tpv', 'caja', 'otro'] as const

const PostSchema = z.object({
  type:              z.enum(DEVICE_TYPES),
  bank_name:         z.string().min(1).max(80),
  serial:            z.string().max(60).optional(),
  commercial_number: z.string().max(40).optional(),
  is_active:         z.boolean().optional(),
}).strict()

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const devices = await prisma.businessDevice.findMany({
    where:   { business_id: session.businessId },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json({ ok: true, devices })
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
      type:              body.type,
      bank_name:         body.bank_name,
      serial:            body.serial            ?? null,
      commercial_number: body.commercial_number ?? null,
      is_active:         body.is_active         ?? true,
    },
  })

  return NextResponse.json({ ok: true, device }, { status: 201 })
}
