import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { applyPlantillaToSettings, type CartaPresetKey, type CartaStyleKey, type PlantillaKey } from '@/lib/plantillas'
import { CASHEA_PRESET } from '@/lib/financing'
import type { CollectIn } from '@/lib/cobro-precios'

/**
 * ÚNICA vía para crear un negocio (tenant) con su usuario admin y el seed inicial. La usan el registro público
 * (/api/onboarding/setup), el asistente "Nuevo negocio" del superadmin (POST /api/admin/tenants) y scripts/seed-demos.ts.
 * Un cambio en cómo nace un negocio se hace aquí y vale para los tres.
 */

// Ids reales del wizard — ver src/app/registro/data.ts (PAYMENT_METHOD_DEFS/SEEDED_PAYMENT_IDS)
export const PAYMENT_TYPE_IDS = ['pago_movil', 'zelle', 'efectivo_usd', 'efectivo_bs', 'binance', 'transferencia'] as const
export type PaymentTypeId = (typeof PAYMENT_TYPE_IDS)[number]

export const SEGMENT_MAX_LEN = 40 // Business.segment @db.VarChar(40)

export interface TenantPaymentInput {
  type:         PaymentTypeId
  bankCode?:    string
  bankName?:    string
  phoneNumber?: string
  email?:       string
  detail?:      string
}

export interface CreateTenantInput {
  ownerName:     string
  businessName:  string
  slug:          string
  email:         string
  /** Contraseña en claro: se hashea aquí. */
  password:      string
  businessType:  string
  subSegment?:   string
  city?:         string
  description?:  string
  categories?:   string[]
  paymentMethods?: TenantPaymentInput[]
  /** Extras del superadmin. Por defecto: lo que siempre hizo el registro público. */
  options?: {
    template?:          PlantillaKey
    settings?:          Prisma.InputJsonObject
    catalogActive?:     boolean
    catalogPlan?:       string
    withSampleProduct?: boolean
  }
}

export type CreateTenantResult =
  | { ok: true;  business: { id: number; slug: string; catalog_plan: string | null }; user: { id: number; name: string; email: string } }
  | { ok: false; status: 400 | 409; error: string; field?: 'business_slug' | 'email' }

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
function buildCobroData(paymentMethods: TenantPaymentInput[]): Record<string, string> {
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

export interface TenantSettingsInput {
  template:     PlantillaKey
  carta_preset?: CartaPresetKey
  carta_style?:  CartaStyleKey
  /** Precios siempre en $; esto es cómo cobra el negocio. */
  collect_in:   CollectIn
  cashea:       boolean
  divisa:       boolean
}

/**
 * `settings` inicial de un negocio creado por el superadmin: mismas claves que usan el panel "Cobro y precios"
 * (cobro_precios + financing) y la plantilla Carta (carta_*). Única fuente: la usan POST /api/admin/tenants y scripts/seed-demos.ts.
 */
export function buildTenantSettings(i: TenantSettingsInput): Prisma.InputJsonObject {
  const base: Record<string, unknown> = {
    cobro_precios: { collect_in: i.collect_in, divisa_enabled: i.divisa, cashea_enabled: i.cashea },
    financing: { enabled: i.cashea, mode: 'cashea', provider_name: CASHEA_PRESET.provider_name, phrase: CASHEA_PRESET.phrase, logo_url: CASHEA_PRESET.logo_url },
    catalog_financing_badge: i.cashea ? 'cashea' : null,
  }
  return applyPlantillaToSettings(base, { template: i.template, carta_preset: i.carta_preset, carta_style: i.carta_style }) as Prisma.InputJsonObject
}

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  // Normalizado — el email es @@unique global, mayúsculas/espacios no deben crear cuentas duplicadas
  const email = input.email.toLowerCase().trim()
  const opts = input.options ?? {}

  // Slug and email uniqueness (outside transaction — fail-fast)
  const [slugTaken, emailTaken] = await Promise.all([
    prisma.business.findFirst({ where: { catalog_slug: input.slug }, select: { id: true } }),
    prisma.user.findFirst({ where: { email }, select: { id: true } }),
  ])
  if (slugTaken) return { ok: false, status: 409, error: 'El slug ya está en uso', field: 'business_slug' }
  if (emailTaken) return { ok: false, status: 409, error: 'El email ya está registrado', field: 'email' }

  const hashed = await bcrypt.hash(input.password, 10)

  // Cómputo puro, sin DB — se resuelve antes de abrir la transacción para no alargar la conexión reservada
  // subSegment puede llegar como '' (texto libre "¿Otro?" vaciado) — || también cae a businessType en ese caso, a diferencia de ??
  const effectiveSegment = (input.subSegment || input.businessType).slice(0, SEGMENT_MAX_LEN)
  const sample = getSampleProduct(effectiveSegment)

  // Dedup por type: último gana si el wizard envía el mismo método repetido
  const dedupedMethods = Array.from(new Map((input.paymentMethods ?? []).map(pm => [pm.type, pm])).values())
  const extraMethods = dedupedMethods.filter(pm => !PM_META.get(pm.type)?.seeded)
  const cobroData = buildCobroData(dedupedMethods)
  const dedupedCategories = Array.from(new Set(input.categories ?? []))

  try {
    const result = await prisma.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          name:                 input.businessName,
          // Mismo email normalizado que el usuario admin — antes quedaba NULL
          // en businesses y el negocio no tenía contacto propio.
          email,
          catalog_slug:         input.slug,
          catalog_active:       opts.catalogActive ?? false,
          catalog_title:        input.businessName,
          city:                 input.city,
          catalog_desc:         input.description,
          onboarding_completed: true,
          segment:              effectiveSegment,
          ...(opts.template ? { catalog_template: opts.template } : {}),
          ...(opts.catalogPlan ? { catalog_plan: opts.catalogPlan } : {}),
          ...(opts.settings ? { settings: opts.settings } : {}),
          ...(Object.keys(cobroData).length > 0 ? { cobro_data: cobroData } : {}),
        },
      })

      const usr = await tx.user.create({
        data: {
          business_id: biz.id,
          name:        input.ownerName,
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

      if (opts.withSampleProduct ?? true) {
        await tx.product.create({
          data: {
            business_id:        biz.id,
            name:               sample.name,
            price_per_unit_usd: sample.price_per_unit_usd,
            available_in_pos:   true,
            active:             true,
          },
        })
      }

      return { business: biz, user: usr }
    })
    return {
      ok: true,
      business: { id: result.business.id, slug: input.slug, catalog_plan: result.business.catalog_plan },
      user:     { id: result.user.id, name: result.user.name, email },
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // Slug/email duplicados en race condition (TOCTOU entre check y insert)
      const target = (e.meta?.target as string[] | undefined) ?? []
      if (target.includes('catalog_slug')) return { ok: false, status: 409, error: 'El slug ya está en uso', field: 'business_slug' }
      if (target.includes('email')) return { ok: false, status: 409, error: 'Ya tienes una cuenta con ese correo. Inicia sesión.', field: 'email' }
    }
    // Cualquier otro error de Prisma (valor fuera de rango, tipo inválido, etc.) → 400 genérico, nunca 500 sin manejar
    if (e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Prisma.PrismaClientValidationError) {
      return { ok: false, status: 400, error: 'No se pudo completar el registro. Verifica los datos e intenta de nuevo.' }
    }
    throw e
  }
}
