import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const DEVICE_TYPES_UI = ['debit', 'credit', 'biopago'] as const

const PatchSchema = z.object({
  tipo:         z.enum(DEVICE_TYPES_UI).optional(),
  banco:        z.string().min(1).max(80).optional(),
  serial:       z.string().max(60).nullish(),
  nro_comercio: z.string().max(40).nullish(),
  is_active:    z.boolean().optional(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await prisma.businessDevice.findFirst({
    where:  { id, business_id: session.businessId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const device = await prisma.businessDevice.update({
    where: { id },
    data: {
      ...(body.tipo         !== undefined && { type:              body.tipo }),
      ...(body.banco        !== undefined && { bank_name:         body.banco }),
      ...(body.serial       !== undefined && { serial:            body.serial }),
      ...(body.nro_comercio !== undefined && { commercial_number: body.nro_comercio }),
      ...(body.is_active    !== undefined && { is_active:         body.is_active }),
    },
  })

  return NextResponse.json({
    ok: true,
    device: {
      id:           device.id,
      business_id:  device.business_id,
      tipo:         device.type,
      banco:        device.bank_name,
      serial:       device.serial,
      nro_comercio: device.commercial_number,
      is_active:    device.is_active,
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await prisma.businessDevice.findFirst({
    where:  { id, business_id: session.businessId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.businessDevice.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
