import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { KitConfigSchema, EMPTY_KIT_CONFIG } from '@/lib/kit-config'

// Admin GET/PATCH de la config del microsite /kit-200k. business_id SIEMPRE
// de getSession() -- nunca de body/query (regla sellada CLAUDE.md).
// PATCH reemplaza el blob completo (no merge parcial): es un solo formulario
// de 7 campos, se guarda entero cada vez -- no hay subsecciones independientes
// como en cobro_data.

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { kit200k_config: true },
  })

  const stored = business?.kit200k_config
  const isValid = stored !== null && typeof stored === 'object' && !Array.isArray(stored) &&
    KitConfigSchema.safeParse(stored).success

  return NextResponse.json({ ok: true, config: isValid ? stored : EMPTY_KIT_CONFIG })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let data: z.infer<typeof KitConfigSchema>
  try {
    data = KitConfigSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const business = await prisma.business.update({
    where:  { id: session.businessId },
    data:   { kit200k_config: data },
    select: { kit200k_config: true },
  })

  return NextResponse.json({ ok: true, config: business.kit200k_config })
}
