import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { BusinessSettings } from '@/types'

const PatchSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/),
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

  const existing = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { settings: true },
  })

  const existingSettings = (existing?.settings ?? {}) as BusinessSettings
  const hashed = await bcrypt.hash(data.pin, 10)

  await prisma.business.update({
    where: { id: session.businessId },
    data: {
      settings: { ...existingSettings, pin: hashed },
    },
  })

  return NextResponse.json({ ok: true })
}
