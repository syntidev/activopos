import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const ALLOWED_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#D97706', '#059669', '#DC2626'] as const

const PatchSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  theme_color: z.string().refine((v) => (ALLOWED_COLORS as readonly string[]).includes(v), {
    message: 'Color no permitido',
  }).optional(),
  segment: z.string().max(40).optional(),
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
    select: { id: true, theme: true, theme_color: true, segment: true },
  })

  return NextResponse.json({ ok: true, business: updated })
}
