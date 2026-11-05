import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/safe-log'
import { buildTenantSettings, createTenant } from '@/lib/tenant-create'
import { publicPath, SLUG_RE, TEMPLATES, AVAILABLE_CARTA_PRESETS, CARTA_STYLES } from '@/lib/plantillas'
import { COLLECT_IN } from '@/lib/cobro-precios'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [businesses, salesCounts] = await Promise.all([
    prisma.business.findMany({
      select: {
        id:                      true,
        name:                    true,
        catalog_plan:            true,
        active:                  true,
        subscription_active:     true,
        subscription_expires_at: true,
        created_at:              true,
        users:                   { where: { role: 'admin' }, select: { email: true }, take: 1 },
        _count:                  { select: { products: true, users: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.sale.groupBy({
      by:     ['business_id'],
      where:  { status: 'paid', sold_at: { gte: monthStart } },
      _count: { _all: true },
    }),
  ])

  const salesMap = new Map(salesCounts.map(s => [s.business_id, s._count._all]))

  const tenants = businesses.map(b => ({
    id:                    b.id,
    name:                  b.name,
    adminEmail:            b.users[0]?.email ?? null,
    plan:                  b.catalog_plan ?? 'gratis',
    active:                b.active,
    subscriptionActive:    b.subscription_active,
    subscriptionExpiresAt: b.subscription_expires_at,
    createdAt:             b.created_at,
    productCount:          b._count.products,
    userCount:             b._count.users,
    salesThisMonth:        salesMap.get(b.id) ?? 0,
  }))

  return NextResponse.json({ ok: true, tenants })
}

/** Asistente "Nuevo negocio" del superadmin. Estricto: ningún campo fuera de esta lista. */
const createSchema = z.strictObject({
  business_name:  z.string().trim().min(2).max(100),
  slug:           z.string().regex(SLUG_RE, 'Slug: 3 a 50 caracteres, solo minúsculas, números y guiones'),
  rubro:          z.string().trim().min(1).max(40),
  template:       z.enum(TEMPLATES),
  carta_preset:   z.enum(AVAILABLE_CARTA_PRESETS).optional(),
  carta_style:    z.enum(CARTA_STYLES).optional(),
  // Precios siempre en $; esto es cómo cobra el negocio.
  collect_in:     z.enum(COLLECT_IN).default('both'),
  cashea:         z.boolean().default(false),
  divisa:         z.boolean().default(true),
  plan:           z.enum(['gratis', 'negocio_activo']).default('negocio_activo'),
  admin_name:     z.string().trim().min(2).max(100),
  admin_email:    z.string().email(),
  // Si no se indica, se genera una y se muestra UNA sola vez.
  admin_password: z.string().min(8).max(72).optional(), // bcrypt ignora lo que pase de 72 bytes
}).refine(d => d.template === 'carta' || (d.carta_preset === undefined && d.carta_style === undefined), {
  message: 'carta_preset y carta_style solo aplican a la plantilla carta',
  path:    ['template'],
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const d = createSchema.parse(await req.json())
    const password = d.admin_password ?? randomBytes(9).toString('base64url')

    const settings = buildTenantSettings({ template: d.template, carta_preset: d.carta_preset, carta_style: d.carta_style, collect_in: d.collect_in, cashea: d.cashea, divisa: d.divisa })

    const created = await createTenant({
      ownerName:    d.admin_name,
      businessName: d.business_name,
      slug:         d.slug,
      email:        d.admin_email,
      password,
      businessType: d.rubro,
      options:      { template: d.template, settings, catalogActive: true, catalogPlan: d.plan, withSampleProduct: false },
    })
    if (!created.ok) {
      return NextResponse.json({ error: created.error, ...(created.field ? { field: created.field } : {}) }, { status: created.status })
    }

    // Si el log falla, el negocio YA existe: se responde igual (la contraseña solo se puede mostrar en esta respuesta).
    try {
      await prisma.activityLog.create({
        data: {
          business_id: created.business.id,
          user_id:     session.userId,
          action:      'tenant_created_by_admin',
          model_type:  'Business',
          model_id:    created.business.id,
          // La contraseña NUNCA se registra.
          new_values:  { slug: d.slug, template: d.template, plan: d.plan, collect_in: d.collect_in, cashea: d.cashea, divisa: d.divisa, admin_email: created.user.email },
        },
      })
    } catch (logErr) {
      logError('POST /api/admin/tenants (auditoría)', logErr)
    }

    // Credenciales: solo en esta respuesta, nunca cacheada.
    return NextResponse.json(
      { ok: true, business_id: created.business.id, slug: d.slug, public_url: publicPath(d.slug), admin_email: created.user.email, admin_password: password },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    logError('POST /api/admin/tenants', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
