import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const DEVICE_TYPES = ['punto_venta', 'datafono', 'tpv', 'caja', 'otro'] as const

const PatchSchema = z.object({
  type:              z.enum(DEVICE_TYPES).optional(),
  bank_name:         z.string().min(1).max(80).optional(),
  serial:            z.string().max(60).nullish(),
  commercial_number: z.string().max(40).nullish(),
  is_active:         z.boolean().optional(),
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

  // IDOR: verificar ownership antes de cualquier operación
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
    data:  body,
  })

  return NextResponse.json({ ok: true, device })
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

  // IDOR: verificar ownership antes de eliminar
  const existing = await prisma.businessDevice.findFirst({
    where:  { id, business_id: session.businessId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.businessDevice.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
