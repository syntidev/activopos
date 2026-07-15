import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const updateSchema = z.object({
  dia:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dia debe ser YYYY-MM-DD').optional(),
  tipo:            z.string().min(1).max(40).optional(),
  segmento:        z.string().min(1).max(80).optional(),
  objetivo:        z.string().min(1).max(120).optional(),
  titulo:          z.string().min(1).max(200).optional(),
  subtitulo:       z.string().max(500).nullable().optional(),
  caption:         z.string().nullable().optional(),
  hashtags:        z.string().max(500).nullable().optional(),
  estado:          z.string().max(30).optional(),
  content_engine:  z.string().min(1).max(40).optional(),
  buffer_post_id:  z.string().max(80).nullable().optional(),
  notas:           z.string().nullable().optional(),
  social_post_id:  z.number().int().positive().nullable().optional(),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw, 10)
  return isNaN(id) ? null : id
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let body: z.infer<typeof updateSchema>
  try {
    body = updateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const existing = await prisma.socialCalendarEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (body.social_post_id != null) {
    const post = await prisma.socialPost.findUnique({ where: { id: body.social_post_id }, select: { id: true } })
    if (!post) return NextResponse.json({ error: 'social_post_id no existe' }, { status: 400 })
  }

  const { dia, ...rest } = body
  const entry = await prisma.socialCalendarEntry.update({
    where: { id },
    data: {
      ...rest,
      ...(dia !== undefined ? { dia: new Date(dia) } : {}),
    },
  })

  return NextResponse.json({ ok: true, entry })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await prisma.socialCalendarEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.socialCalendarEntry.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
