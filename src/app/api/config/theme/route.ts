import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const SEGMENTS = ['retail', 'restaurante', 'servicios', 'salud', 'ferreteria', 'carniceria', 'tecnologia'] as const

const PatchSchema = z.object({
  theme: z.enum(['dark', 'light']),
  segment: z.enum(SEGMENTS).optional(),
})

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body: unknown = await request.json()

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const updated = await prisma.business.update({
    where: { id: session.businessId },
    data,
    select: { id: true, theme: true, segment: true },
  })

  return NextResponse.json({ ok: true, business: updated })
}
