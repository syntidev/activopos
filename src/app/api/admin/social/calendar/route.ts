import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const LIMIT = 200

const createSchema = z.object({
  dia:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dia debe ser YYYY-MM-DD'),
  tipo:            z.string().min(1).max(40),
  segmento:        z.string().min(1).max(80),
  objetivo:        z.string().min(1).max(120),
  titulo:          z.string().min(1).max(200),
  subtitulo:       z.string().max(500).nullable().optional(),
  caption:         z.string().nullable().optional(),
  hashtags:        z.string().max(500).nullable().optional(),
  estado:          z.string().max(30).optional(),
  content_engine:  z.string().min(1).max(40),
  buffer_post_id:  z.string().max(80).nullable().optional(),
  notas:           z.string().nullable().optional(),
  social_post_id:  z.number().int().positive().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp       = req.nextUrl.searchParams
  const diaDesde = sp.get('dia_desde')
  const diaHasta = sp.get('dia_hasta')

  // Contenido de marca ActivoPOS, sin tenant: se listan TODAS las entradas.
  const entries = await prisma.socialCalendarEntry.findMany({
    where: (diaDesde || diaHasta) ? {
      dia: {
        ...(diaDesde ? { gte: new Date(diaDesde) } : {}),
        ...(diaHasta ? { lte: new Date(diaHasta) } : {}),
      },
    } : {},
    orderBy: { dia: 'asc' },
    take:    LIMIT,
  })

  return NextResponse.json({ ok: true, entries })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (body.social_post_id != null) {
    const post = await prisma.socialPost.findUnique({ where: { id: body.social_post_id }, select: { id: true } })
    if (!post) return NextResponse.json({ error: 'social_post_id no existe' }, { status: 400 })
  }

  const entry = await prisma.socialCalendarEntry.create({
    data: {
      dia:            new Date(body.dia),
      tipo:           body.tipo,
      segmento:       body.segmento,
      objetivo:       body.objetivo,
      titulo:         body.titulo,
      subtitulo:      body.subtitulo ?? null,
      caption:        body.caption ?? null,
      hashtags:       body.hashtags ?? null,
      estado:         body.estado ?? 'pendiente',
      content_engine: body.content_engine,
      buffer_post_id: body.buffer_post_id ?? null,
      notas:          body.notas ?? null,
      social_post_id: body.social_post_id ?? null,
    },
  })

  return NextResponse.json({ ok: true, entry }, { status: 201 })
}
