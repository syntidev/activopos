import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const createSchema = z.object({
  name:      z.string().min(1).max(120),
  personaje: z.string().max(200).optional(),
  escena:    z.string().max(200).optional(),
  accion:    z.string().max(200).optional(),
}).refine(
  b => !!b.personaje?.trim() || !!b.escena?.trim() || !!b.accion?.trim(),
  { message: 'Al menos uno de personaje/escena/accion es requerido', path: ['personaje'] },
)

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const presets = await prisma.socialScenePreset.findMany({
    orderBy: { created_at: 'desc' },
  })
  return NextResponse.json({ presets })
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

  const preset = await prisma.socialScenePreset.create({
    data: {
      name:      body.name,
      personaje: body.personaje?.trim() || null,
      escena:    body.escena?.trim() || null,
      accion:    body.accion?.trim() || null,
    },
  })

  return NextResponse.json({ ok: true, preset }, { status: 201 })
}
