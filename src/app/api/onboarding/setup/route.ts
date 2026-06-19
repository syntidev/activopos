import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken, setSessionCookie } from '@/lib/auth'
import { onboardingLimiter, getClientIp } from '@/lib/rate-limit'

const OnboardingSchema = z.object({
  owner_name:     z.string().trim().min(2).max(100),
  business_name:  z.string().trim().min(2).max(100),
  business_slug:  z.string().regex(/^[a-z0-9-]+$/).min(3).max(50),
  email:          z.string().email(),
  password:       z.string().min(8),
  business_type:  z.string().min(1),
  sells_products: z.boolean().default(true),
  sells_services: z.boolean().default(false),
  sells_food:     z.boolean().default(false),
  city:           z.string().trim().max(80).optional(),
  description:    z.string().trim().max(500).optional(),
})

const EXPENSE_CATEGORIES = [
  { name: 'Alquiler',           color: '#6366f1', is_system: true },
  { name: 'Servicios públicos', color: '#0ea5e9', is_system: true },
  { name: 'Nómina',             color: '#f59e0b', is_system: true },
  { name: 'Insumos',            color: '#10b981', is_system: true },
  { name: 'Marketing',          color: '#ec4899', is_system: true },
  { name: 'Otros',              color: '#94a3b8', is_system: true },
]

const PAYMENT_METHODS = [
  { name: 'Efectivo Bs',  type: 'cash'     as const, sort_order: 1 },
  { name: 'Efectivo USD', type: 'cash'     as const, sort_order: 2 },
  { name: 'Pago Móvil',  type: 'transfer' as const, sort_order: 3 },
  { name: 'Zelle',        type: 'zelle'    as const, sort_order: 4 },
]

function getSampleProduct(businessType: string): { name: string; price_per_unit_usd: number } {
  const map: Record<string, { name: string; price_per_unit_usd: number }> = {
    bodega:      { name: 'Refresco 1L',          price_per_unit_usd: 1.50 },
    cafeteria:   { name: 'Café con Leche',        price_per_unit_usd: 2.00 },
    restaurante: { name: 'Plato del Día',         price_per_unit_usd: 8.00 },
    boutique:    { name: 'Artículo de Muestra',   price_per_unit_usd: 25.00 },
    farmacia:    { name: 'Medicamento Ejemplo',   price_per_unit_usd: 5.00 },
    licorera:    { name: 'Bebida de Muestra',     price_per_unit_usd: 4.00 },
  }
  return map[businessType] ?? { name: 'Producto de Ejemplo', price_per_unit_usd: 5.00 }
}

export async function POST(req: NextRequest) {
  try {
    await onboardingLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  let data: z.infer<typeof OnboardingSchema>
  try {
    data = OnboardingSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    throw err
  }

  // Slug and email uniqueness (outside transaction — fail-fast)
  const [slugTaken, emailTaken] = await Promise.all([
    prisma.business.findFirst({ where: { catalog_slug: data.business_slug }, select: { id: true } }),
    prisma.user.findFirst({ where: { email: data.email }, select: { id: true } }),
  ])

  if (slugTaken) {
    return NextResponse.json({ error: 'El slug ya está en uso', field: 'business_slug' }, { status: 409 })
  }
  if (emailTaken) {
    return NextResponse.json({ error: 'El email ya está registrado', field: 'email' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(data.password, 10)

  const { business, user } = await prisma.$transaction(async (tx) => {
    const biz = await tx.business.create({
      data: {
        name:                 data.business_name,
        catalog_slug:         data.business_slug,
        catalog_active:       false,
        catalog_title:        data.business_name,
        city:                 data.city,
        catalog_desc:         data.description,
        onboarding_completed: true,
      },
    })

    const usr = await tx.user.create({
      data: {
        business_id: biz.id,
        name:        data.owner_name,
        email:       data.email,
        password:    hashed,
        role:        'admin',
      },
    })

    // Seed expense categories
    await tx.expenseCategory.createMany({
      data: EXPENSE_CATEGORIES.map(c => ({ ...c, business_id: biz.id })),
    })

    // Seed payment methods
    await tx.paymentMethod.createMany({
      data: PAYMENT_METHODS.map(pm => ({ ...pm, business_id: biz.id })),
    })

    // Seed sample product
    const sample = getSampleProduct(data.business_type)
    await tx.product.create({
      data: {
        business_id:        biz.id,
        name:               sample.name,
        price_per_unit_usd: sample.price_per_unit_usd,
        available_in_pos:   true,
        active:             true,
      },
    })

    return { business: biz, user: usr }
  })

  const token = await signToken({
    userId:               user.id,
    businessId:           business.id,
    role:                 'admin',
    name:                 user.name,
    onboardingCompleted:  true,
  })

  setSessionCookie(token)

  return NextResponse.json(
    { ok: true, business_id: business.id, user_id: user.id },
    { status: 201 }
  )
}
