import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const createSchema = z.object({
  business_id:  z.number().int().positive(),
  name:         z.string().min(1).max(120),
  design_rules: z.string().min(1).max(5000),
  example_html: z.string().max(20000).optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const presets = await prisma.socialStylePreset.findMany({
    orderBy: { created_at: 'desc' },
    select: {
      id: true, name: true, business_id: true, created_at: true,
      business: { select: { name: true } },
    },
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

  const business = await prisma.business.findUnique({ where: { id: body.business_id }, select: { id: true } })
  if (!business) return NextResponse.json({ error: 'Negocio no existe' }, { status: 400 })

  const preset = await prisma.socialStylePreset.create({
    data: {
      business_id:  body.business_id,
      name:         body.name,
      design_rules: body.design_rules,
      example_html: body.example_html ?? null,
    },
  })

  return NextResponse.json({ ok: true, preset }, { status: 201 })
}
