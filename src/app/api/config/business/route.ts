import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { storeManualRate, releaseManualRate } from '@/lib/bcv'

const RATE_MIN = 10
const RATE_MAX = 10_000

const PatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  // Columnas nullable en Business: TabEmpresa envía `campo.trim() || null` al
  // limpiar, así que deben aceptar null (antes daban 400 y rompían todo el PATCH).
  legal_name: z.string().max(255).nullable().optional(),
  rif: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  logo_path: z.string()
    .refine(v => v === null || v.startsWith('/uploads/') || v.startsWith('/storage/tenants/'), 'Path inválido')
    .nullable()
    .optional(),
  rate_source:      z.enum(['bcv', 'parallel', 'manual']).optional(),
  // rate / custom_rate: valor de tasa manual. NO es columna de Business — se
  // persiste en DollarRate vía storeManualRate(). custom_rate es alias de rate.
  rate:             z.number().positive().optional(),
  custom_rate:      z.number().min(RATE_MIN).max(RATE_MAX).nullable().optional(),
  segment:          z.string().max(50).optional(),
  max_discount_pct:             z.number().min(0).max(100).optional(),
  allow_cashier_price_override: z.boolean().optional(),
  quotation_footer: z.string().optional(),
  pos_mode: z.enum(['ticket', 'invoice']).optional(),
  catalog_active:    z.boolean().optional(),
  catalog_instagram: z.string().max(80).nullable().optional(),
  catalog_hours:     z.string().max(2000).nullable().optional(),
  // Prefijo/estructura validados aquí; el binding al tenant del caller se
  // verifica en el handler (session.businessId no está disponible en el refine).
  catalog_cover_path: z.string()
    .refine(v => v === null || (
      !v.includes('..') && !v.includes('\0') && v.startsWith('/storage/tenants/')
    ), 'Path inválido')
    .nullable()
    .optional(),
  // Slider de hasta 3 banners — mismo guard anti cross-tenant que catalog_cover_path.
  catalog_cover_path_2: z.string()
    .refine(v => v === null || (
      !v.includes('..') && !v.includes('\0') && v.startsWith('/storage/tenants/')
    ), 'Path inválido')
    .nullable()
    .optional(),
  catalog_cover_path_3: z.string()
    .refine(v => v === null || (
      !v.includes('..') && !v.includes('\0') && v.startsWith('/storage/tenants/')
    ), 'Path inválido')
    .nullable()
    .optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: {
      id: true,
      name: true,
      legal_name: true,
      rif: true,
      logo_path: true,
      address: true,
      city: true,
      state: true,
      phone: true,
      email: true,
      theme: true,
      theme_color: true,
      rate_source: true,
      segment: true,
      max_discount_pct: true,
      allow_cashier_price_override: true,
      created_at: true,
      catalog_active: true,
      quotation_footer: true,
      pos_mode: true,
      catalog_instagram: true,
      catalog_hours: true,
      catalog_cover_path: true,
      catalog_cover_path_2: true,
      catalog_cover_path_3: true,
    },
  })

  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const latestRate = await prisma.dollarRate.findFirst({
    orderBy: { created_at: 'desc' },
    select: { rate: true },
  })

  const current_rate = latestRate ? Number(latestRate.rate) : 36.50

  return NextResponse.json({ ok: true, business, current_rate })
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

  const { rate, custom_rate, ...businessFields } = data
  const manualRate = rate ?? custom_rate ?? null

  // Anti cross-tenant: la portada debe vivir bajo el directorio del PROPIO negocio.
  // El refine ya bloqueó '..'/'\0' y exigió /storage/tenants/; aquí se ata al caller.
  if (businessFields.catalog_cover_path != null &&
      !businessFields.catalog_cover_path.startsWith(`/storage/tenants/${session.businessId}/`)) {
    return NextResponse.json({ error: 'Ruta de portada inválida' }, { status: 400 })
  }
  if (businessFields.catalog_cover_path_2 != null &&
      !businessFields.catalog_cover_path_2.startsWith(`/storage/tenants/${session.businessId}/`)) {
    return NextResponse.json({ error: 'Ruta de portada inválida' }, { status: 400 })
  }
  if (businessFields.catalog_cover_path_3 != null &&
      !businessFields.catalog_cover_path_3.startsWith(`/storage/tenants/${session.businessId}/`)) {
    return NextResponse.json({ error: 'Ruta de portada inválida' }, { status: 400 })
  }

  // La tasa manual se persiste en DollarRate (fuente única de verdad, global),
  // NO como columna de Business. Antes esto devolvía 400 (SEC-002) porque no
  // había mecanismo seguro; ahora storeManualRate/releaseManualRate lo proveen.
  if (businessFields.rate_source === 'manual') {
    if (manualRate === null) {
      return NextResponse.json({ error: 'rate requerido para tasa manual' }, { status: 400 })
    }
    if (manualRate < RATE_MIN || manualRate > RATE_MAX) {
      return NextResponse.json({ error: `Tasa fuera de rango (${RATE_MIN} - ${RATE_MAX})` }, { status: 400 })
    }
    await storeManualRate(manualRate, session.businessId)
  } else if (businessFields.rate_source === 'bcv' || businessFields.rate_source === 'parallel') {
    // Cambiar a BCV/paralelo libera cualquier override manual activo del negocio.
    await releaseManualRate(session.businessId)
  }

  const updated = await prisma.business.update({
    where: { id: session.businessId },
    data: businessFields,
    select: {
      id: true,
      name: true,
      legal_name: true,
      rif: true,
      logo_path: true,
      address: true,
      city: true,
      state: true,
      phone: true,
      email: true,
      theme: true,
      theme_color: true,
      rate_source: true,
      segment: true,
      max_discount_pct: true,
      allow_cashier_price_override: true,
    },
  })

  return NextResponse.json({ ok: true, business: updated })
}
