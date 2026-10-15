import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { parsePrintSettings } from '@/lib/print-settings'

// Ajustes de impresión térmica del NEGOCIO (business.settings.print). Solo admin:
// el cajero imprime, no configura. business_id siempre de la sesión.
const PatchSchema = z.object({
  header:          z.string().max(120).optional(),
  auto_print:      z.boolean().optional(),
  open_drawer:     z.boolean().optional(),
  codepage:        z.enum(['cp858', 'cp850']).optional(),
  show_logo:       z.boolean().optional(),
  show_catalog_qr: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'Nada que guardar' })

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  }
  return { session }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const business = await prisma.business.findUnique({
    where:  { id: auth.session.businessId },
    select: { settings: true },
  })
  return NextResponse.json({ ok: true, print: parsePrintSettings(business?.settings) })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where:  { id: auth.session.businessId },
    select: { settings: true },
  })
  const existing = (business?.settings ?? {}) as Record<string, unknown>
  const next = { ...parsePrintSettings(existing), ...parsed.data }

  await prisma.business.update({
    where: { id: auth.session.businessId },
    data:  { settings: { ...existing, print: next } },
  })
  return NextResponse.json({ ok: true, print: next })
}
