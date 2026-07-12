import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { signToken, setSessionCookie } from '@/lib/auth'
import { onboardingLimiter, getClientIp } from '@/lib/rate-limit'
import { sendRegistrationConfirmationEmail, sendNewBusinessAlertEmail } from '@/lib/mail'

// Ids reales del wizard — ver src/app/registro/data.ts (PAYMENT_METHOD_DEFS/SEEDED_PAYMENT_IDS)
const PAYMENT_TYPE_IDS = ['pago_movil', 'zelle', 'efectivo_usd', 'efectivo_bs', 'binance', 'transferencia'] as const

const PaymentMethodSchema = z.object({
  type:        z.enum(PAYMENT_TYPE_IDS),
  bankCode:    z.string().optional(),
  bankName:    z.string().optional(),
  phoneNumber: z.string().optional(),
  email:       z.string().email().optional().or(z.literal('')),
  detail:      z.string().optional(),
})

const SEGMENT_MAX_LEN = 40 // Business.segment @db.VarChar(40)

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
  // Extendido Sprint Día 2 — ver notas de persistencia junto al $transaction
  subSegment:     z.string().max(SEGMENT_MAX_LEN).optional(),
  // Sin columna propia: comparte Business.segment con subSegment (una sola VarChar(40)), así que
  // el macro-bucket (productos/servicios/comida/mixto) NO se persiste — requiere columna nueva, fuera de este sprint.
  segment:        z.string().optional(),
  categories:     z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  paymentMethods: z.array(PaymentMethodSchema).max(10).optional(),
  schedule:       z.enum(['always', 'custom']).optional(),      // sin columna — no se persiste
  scheduleConfig: z.record(z.string(), z.unknown()).optional(),  // sin columna — no se persiste
})

interface PmMeta {
  name:   string
  dbType: Prisma.PaymentMethodCreateManyInput['type']
  seeded: boolean // ya lo crea el seed PAYMENT_METHODS de abajo — no duplicar
}

// Map (no object literal) — evita que claves como '__proto__'/'constructor' resuelvan a miembros heredados
const PM_META = new Map<string, PmMeta>([
  ['pago_movil',    { name: 'Pago Móvil',              dbType: 'transfer', seeded: true }],
  ['zelle',         { name: 'Zelle',                    dbType: 'zelle',    seeded: true }],
  ['efectivo_usd',  { name: 'Efectivo USD',             dbType: 'cash',     seeded: true }],
  ['efectivo_bs',   { name: 'Efectivo Bs',              dbType: 'cash',     seeded: true }],
  ['binance',       { name: 'Binance Pay / USDT',       dbType: 'binance',  seeded: false }],
  ['transferencia', { name: 'Transferencia Bancaria',   dbType: 'transfer', seeded: false }],
])

// Detalle bancario sin columnas propias en PaymentMethod — se guarda en Business.cobro_data (mismo patrón que PATCH /api/config/payment-methods)
function buildCobroData(paymentMethods: z.infer<typeof PaymentMethodSchema>[]): Record<string, string> {
  const cobro: Record<string, string> = {}
  for (const pm of paymentMethods) {
    if (pm.type === 'pago_movil') {
      const banco = pm.bankName || pm.bankCode
      if (banco) cobro.pago_movil_banco = banco
      if (pm.phoneNumber) cobro.pago_movil_telefono = pm.phoneNumber
    }
    if (pm.type === 'zelle') {
      const contacto = pm.email || pm.detail
      if (contacto) cobro.zelle_contacto = contacto
    }
    if (pm.type === 'binance' && pm.detail) {
      cobro.binance_id = pm.detail
    }
    if (pm.type === 'transferencia') {
      const banco = pm.bankName || pm.bankCode
      if (banco) cobro.transferencia_banco = banco
      if (pm.phoneNumber) cobro.transferencia_telefono = pm.phoneNumber
    }
  }
  return cobro
}

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

  // Normalizado — el email es ahora @@unique global, mayúsculas/espacios no deben crear cuentas duplicadas
  const email = data.email.toLowerCase().trim()

  // Slug and email uniqueness (outside transaction — fail-fast)
  const [slugTaken, emailTaken] = await Promise.all([
    prisma.business.findFirst({ where: { catalog_slug: data.business_slug }, select: { id: true } }),
    prisma.user.findFirst({ where: { email }, select: { id: true } }),
  ])

  if (slugTaken) {
    return NextResponse.json({ error: 'El slug ya está en uso', field: 'business_slug' }, { status: 409 })
  }
  if (emailTaken) {
    return NextResponse.json({ error: 'El email ya está registrado', field: 'email' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(data.password, 10)

  // Cómputo puro, sin DB — se resuelve antes de abrir la transacción para no alargar la conexión reservada
  // subSegment puede llegar como '' (texto libre "¿Otro?" vaciado) — || también cae a business_type en ese caso, a diferencia de ??
  const effectiveSegment = (data.subSegment || data.business_type).slice(0, SEGMENT_MAX_LEN)
  const sample = getSampleProduct(effectiveSegment)

  // Dedup por type: último gana si el wizard envía el mismo método repetido
  const dedupedMethods = Array.from(new Map((data.paymentMethods ?? []).map(pm => [pm.type, pm])).values())
  const extraMethods = dedupedMethods.filter(pm => !PM_META.get(pm.type)?.seeded)
  const cobroData = buildCobroData(dedupedMethods)
  const dedupedCategories = Array.from(new Set(data.categories ?? []))

  let business!: { id: number; catalog_plan: string | null }
  let user!: { id: number; name: string }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          name:                 data.business_name,
          catalog_slug:         data.business_slug,
          catalog_active:       false,
          catalog_title:        data.business_name,
          city:                 data.city,
          catalog_desc:         data.description,
          onboarding_completed: true,
          segment:              effectiveSegment,
          ...(Object.keys(cobroData).length > 0 ? { cobro_data: cobroData } : {}),
        },
      })

      const usr = await tx.user.create({
        data: {
          business_id: biz.id,
          name:        data.owner_name,
          email,
          password:    hashed,
          role:        'admin',
        },
      })

      // Seed expense categories
      await tx.expenseCategory.createMany({
        data: EXPENSE_CATEGORIES.map(c => ({ ...c, business_id: biz.id })),
      })

      // Métodos de pago: seed por defecto + extras del wizard (binance/transferencia) en una sola llamada
      await tx.paymentMethod.createMany({
        data: [
          ...PAYMENT_METHODS.map(pm => ({ ...pm, business_id: biz.id })),
          ...extraMethods.map((pm, i) => {
            const meta = PM_META.get(pm.type)
            return {
              business_id: biz.id,
              name:        meta?.name ?? pm.type,
              type:        meta?.dbType ?? 'other',
              sort_order:  PAYMENT_METHODS.length + i + 1,
            }
          }),
        ],
      })

      // Categorías creadas desde el wizard
      if (dedupedCategories.length > 0) {
        await tx.category.createMany({
          data: dedupedCategories.map((name, i) => ({
            name,
            business_id: biz.id,
            sort_order:  i,
          })),
          skipDuplicates: true,
        })
      }

      // data.schedule / data.scheduleConfig: sin columna en Business — no se persiste este sprint (gap documentado)

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
    business = result.business
    user = result.user
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // Slug/email duplicados en race condition (TOCTOU entre check y insert)
      const target = (e.meta?.target as string[] | undefined) ?? []
      if (target.includes('catalog_slug')) {
        return NextResponse.json({ error: 'El slug ya está en uso', field: 'business_slug' }, { status: 409 })
      }
      if (target.includes('email')) {
        return NextResponse.json({ error: 'Ya tienes una cuenta con ese correo. Inicia sesión.', field: 'email' }, { status: 409 })
      }
    }
    // Cualquier otro error de Prisma (valor fuera de rango, tipo inválido, etc.) → 400 genérico, nunca 500 sin manejar
    if (e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json({ error: 'No se pudo completar el registro. Verifica los datos e intenta de nuevo.' }, { status: 400 })
    }
    throw e
  }

  const token = await signToken({
    userId:               user.id,
    businessId:           business.id,
    role:                 'admin',
    name:                 user.name,
    onboardingCompleted:  true,
  })

  setSessionCookie(token)

  // Correos best-effort — un fallo de SMTP nunca debe tumbar un registro ya persistido
  const createdAt = new Date()
  Promise.all([
    sendRegistrationConfirmationEmail(email, data.owner_name, data.business_name),
    sendNewBusinessAlertEmail(data.business_name, business.catalog_plan ?? 'trial', createdAt),
  ]).catch(err => {
    console.error('[onboarding/setup] fallo envío de correo (no bloqueante):', err)
  })

  return NextResponse.json(
    { ok: true, business_id: business.id, user_id: user.id },
    { status: 201 }
  )
}
