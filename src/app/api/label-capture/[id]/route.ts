import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { evaluateCapture, requireLabelCapture, toDTO, withAutoNote } from '@/lib/label-capture'
import { EAN_RE, normalizeSize } from '@/lib/label-capture-shared'

const patchSchema = z.object({
  add_unit:     z.literal(true).optional(),
  units:        z.number().int().min(1).max(9999).optional(),
  ean:          z.string().regex(EAN_RE).optional(),
  ref:          z.string().trim().max(10).transform(s => s.toUpperCase()).optional(),
  model_name:   z.string().trim().max(120).optional(),
  label_color:  z.string().trim().max(40).optional(),
  size:         z.string().trim().max(20).optional(),
  color_actual: z.string().trim().max(60).nullable().optional(),
  notes:        z.string().trim().max(500).nullable().optional(),
}).strict()

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await requireLabelCapture()
  if (session instanceof NextResponse) return session

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const body = parsed.data

  const current = await prisma.labelCapture.findFirst({ where: { id, business_id: session.businessId } })
  if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const ean = body.ean ?? current.ean
  const ref = body.ref ?? current.ref
  const size = body.size !== undefined ? normalizeSize(body.size) : current.size
  const ev = await evaluateCapture(session.businessId, { ean, ref, size })

  try {
    const row = await prisma.labelCapture.update({
      where: { id: current.id },
      data: {
        ean,
        ref,
        size,
        model_name: body.model_name ?? current.model_name,
        label_color: body.label_color ?? current.label_color,
        color_actual: body.color_actual !== undefined ? body.color_actual || null : current.color_actual,
        units: body.add_unit ? { increment: 1 } : body.units ?? current.units,
        garment: ev.garment,
        gender: ev.gender,
        status: ev.status,
        notes: withAutoNote(body.notes !== undefined ? body.notes : current.notes, ev.auto),
      },
    })
    return NextResponse.json({ item: toDTO(row) })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ese EAN ya está registrado', code: 'duplicate' }, { status: 409 })
    }
    console.error('label-capture update error:', err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
