import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { BusinessSettings } from '@/types'

const PatchSchema = z.object({
  ticket_prefix: z.string().max(10).optional(),
  ticket_footer: z.string().nullable().optional(),
  ticket_format: z.enum(['carta', '80mm', '58mm']).optional(),
  ticket_currency: z.enum(['both', 'usd', 'bs']).optional(),
  hide_rate: z.boolean().optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // Config de impresión: solo admin/super_admin. Consumido solo por la tab de Impresión,
  // bloqueada al cashier por middleware; este guard cierra el acceso por API directa.
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { ticket_prefix: true, ticket_footer: true, settings: true },
  })

  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const settings = (business.settings ?? {}) as BusinessSettings

  return NextResponse.json({
    ok: true,
    ticket: {
      ticket_prefix: business.ticket_prefix,
      ticket_footer: business.ticket_footer,
      ticket_format: settings.ticket_format ?? '80mm',
      ticket_currency: settings.ticket_currency ?? 'both',
      hide_rate: settings.hide_rate ?? false,
    },
  })
}

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

  const { ticket_prefix, ticket_footer, ticket_format, ticket_currency, hide_rate } = data

  const existing = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { settings: true },
  })

  const existingSettings = (existing?.settings ?? {}) as BusinessSettings

  const mergedSettings: BusinessSettings = {
    ...existingSettings,
    ...(ticket_format !== undefined && { ticket_format }),
    ...(ticket_currency !== undefined && { ticket_currency }),
    ...(hide_rate !== undefined && { hide_rate }),
  }

  const updated = await prisma.business.update({
    where: { id: session.businessId },
    data: {
      ...(ticket_prefix !== undefined && { ticket_prefix: ticket_prefix.toUpperCase() }),
      ...(ticket_footer !== undefined && { ticket_footer }),
      settings: mergedSettings as Record<string, string | number | boolean | null>,
    },
    select: { ticket_prefix: true, ticket_footer: true, settings: true },
  })

  const updatedSettings = (updated.settings ?? {}) as BusinessSettings

  return NextResponse.json({
    ok: true,
    ticket: {
      ticket_prefix: updated.ticket_prefix,
      ticket_footer: updated.ticket_footer,
      ticket_format: updatedSettings.ticket_format ?? '80mm',
      ticket_currency: updatedSettings.ticket_currency ?? 'both',
      hide_rate: updatedSettings.hide_rate ?? false,
    },
  })
}
