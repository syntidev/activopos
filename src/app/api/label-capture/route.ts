import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { evaluateCapture, requireLabelCapture, toDTO, withAutoNote } from '@/lib/label-capture'
import { EAN_RE, normalizeSize } from '@/lib/label-capture-shared'
import { OnProfileConflictError, saveOnCapture } from '@/lib/label-capture-on'
import { DEFAULT_PROFILE, isProfileId } from '@/lib/label-profiles'
import type { LabelCaptureDuplicate, LabelCaptureList } from '@/types/label-capture'

const createSchema = z.object({
  ean:        z.string().regex(EAN_RE),
  ref:        z.string().trim().max(10).default('').transform(s => s.toUpperCase()),
  model_name: z.string().trim().max(120).default(''),
  size:       z.string().trim().max(20).default(''),
  notes:      z.string().trim().max(500).nullish(),
}).strict()

const createOnSchema = z.object({
  profile:    z.literal('on'),
  ean:        z.string().regex(EAN_RE),
  style:      z.string().trim().max(40).default(''),
  model_name: z.string().trim().max(120).default(''),
  colorway:   z.string().trim().max(40).default(''),
  gender:     z.string().trim().max(10).default(''),
  us:         z.string().trim().max(12).default(''),
  eu:         z.string().trim().max(12).default(''),
  uk:         z.string().trim().max(12).default(''),
  jp:         z.string().trim().max(12).default(''),
}).strict()

/** Perfil On: 201 = variante nueva, 200 + added = el EAN ya existía y se sumó 1 unidad. */
async function createOn(businessId: number, json: unknown): Promise<NextResponse> {
  const parsed = createOnSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  try {
    const result = await saveOnCapture(businessId, parsed.data)
    return NextResponse.json(result, { status: result.added ? 200 : 201 })
  } catch (err) {
    if (err instanceof OnProfileConflictError) return NextResponse.json({ error: err.message, code: 'duplicate' }, { status: 409 })
    console.error('label-capture on create error:', err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const session = await requireLabelCapture()
  if (session instanceof NextResponse) return session

  // Sin ?profile = Safetti (lista original); cada perfil ve solo sus capturas.
  const profile = new URL(req.url).searchParams.get('profile') ?? DEFAULT_PROFILE
  if (!isProfileId(profile)) return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })

  const rows = await prisma.labelCapture.findMany({
    where: { business_id: session.businessId, profile },
    orderBy: { id: 'asc' },
  })
  const items = rows.map(toDTO)
  const body: LabelCaptureList = {
    items,
    totals: { variants: items.length, units: items.reduce((sum, i) => sum + i.units, 0) },
  }
  return NextResponse.json(body)
}

export async function POST(req: Request): Promise<NextResponse> {
  const session = await requireLabelCapture()
  if (session instanceof NextResponse) return session

  const json: unknown = await req.json().catch(() => null)
  if ((json as { profile?: unknown } | null)?.profile === 'on') return createOn(session.businessId, json)

  const parsed = createSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const input = parsed.data
  const businessId = session.businessId
  const byEan = { business_id_ean: { business_id: businessId, ean: input.ean } }

  const duplicate = async (): Promise<NextResponse> => {
    const found = await prisma.labelCapture.findUnique({ where: byEan, select: { id: true, units: true } })
    const body: LabelCaptureDuplicate = { error: 'EAN ya registrado', code: 'duplicate', id: found?.id ?? 0, units: found?.units ?? 0 }
    return NextResponse.json(body, { status: 409 })
  }

  if (await prisma.labelCapture.findUnique({ where: byEan, select: { id: true } })) return duplicate()

  const size = normalizeSize(input.size)
  const ev = await evaluateCapture(businessId, { ean: input.ean, ref: input.ref, size })
  try {
    const row = await prisma.labelCapture.create({
      data: {
        business_id: businessId,
        ean: input.ean,
        ref: input.ref,
        model_name: input.model_name,
        label_color: '',
        garment: ev.garment,
        size,
        gender: ev.gender,
        status: ev.status,
        notes: withAutoNote(input.notes, ev.auto),
      },
    })
    return NextResponse.json({ item: toDTO(row) }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return duplicate()
    console.error('label-capture create error:', err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
