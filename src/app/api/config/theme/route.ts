import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { checkPlanLimit } from '@/lib/plan-guard'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

const PatchSchema = z.object({
  theme:       z.enum(['dark', 'light']),
  theme_color: z.string().regex(HEX_COLOR, 'Color inválido').optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // Config del negocio: solo admin/super_admin. El cashier ya recibe theme/theme_color
  // dentro de /api/config/business (que su POS/header sí consumen), así que bloquear este
  // endpoint no le quita nada operativo — solo cierra el acceso por API directa a la tab.
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { theme: true, theme_color: true },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  return NextResponse.json({ theme: business.theme, theme_color: business.theme_color })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const planCheck = await checkPlanLimit('access_theme')
  if (!planCheck.allowed) return NextResponse.json({ error: planCheck.reason }, { status: 403 })

  const body: unknown = await request.json()

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const updated = await prisma.business.update({
    where:  { id: session.businessId },
    data:   {
      theme: data.theme,
      ...(data.theme_color ? { theme_color: data.theme_color } : {}),
    },
    select: { id: true, theme: true, theme_color: true },
  })

  return NextResponse.json({ ok: true, business: updated })
}
