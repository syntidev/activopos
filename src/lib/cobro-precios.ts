import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { readFinancingConfig } from '@/lib/financing'
import { readDivisaMethodIds, splitPayMethods } from '@/lib/catalog-divisa'

/**
 * Configuración → "Cobro y precios": un solo lugar para lo que el negocio decide sobre moneda, precio Divisa, Cashea,
 * métodos Divisa y plantilla. Sin cambio de esquema: reutiliza lo que ya existe y agrega solo 3 claves opcionales en
 * business.settings.cobro_precios. REGLA: una clave ausente significa "el comportamiento de siempre" (un negocio sin
 * configurar se ve exactamente igual que antes de existir este panel).
 *
 *   Existente, reutilizado:  settings.financing.enabled (+ catalog_financing_badge sincronizado), settings.catalog_divisa_methods,
 *                            businesses.catalog_template, product.wholesale_price_usd (= precio Divisa), sales.price_mode.
 *   Nuevo (opcional):        settings.cobro_precios = { collect_in, divisa_enabled, cashea_enabled }.
 */

export const COLLECT_IN = ['both', 'bs', 'usd'] as const
export type CollectIn = (typeof COLLECT_IN)[number]

export const SELECTABLE_TEMPLATES = ['generic', 'premium', 'carta'] as const
export type CatalogTemplate = (typeof SELECTABLE_TEMPLATES)[number]
/** La plantilla Carta ya existe (/catalogo-carta): la pantalla la ofrece como tercera opción. */
export const CARTA_AVAILABLE = true

export interface CobroPrecios {
  /** "Precios en": hoy siempre USD (regla sellada: el catálogo muestra USD y Bs a la vez). */
  price_currency: 'usd'
  collect_in: CollectIn
  /** Interruptor del admin: precio Divisa. Ausente = encendido. */
  divisa_enabled: boolean
  /** Interruptor del admin: Cashea/financiamiento. Ausente = lo que diga settings.financing. */
  cashea_enabled: boolean
  divisa_method_ids: number[]
  template: CatalogTemplate
}

/** Lo que de verdad se aplica (suma el interruptor y "Cobras en"). */
export interface CobroEffective {
  /** Hay selector Divisa/Bs, precio Divisa en catálogo y modo Divisa en el POS. */
  divisaActive: boolean
  /** Hay logo, chip, línea y opción Cashea (catálogo, ficha, carrito y POS). */
  casheaActive: boolean
  /** "Solo $": no se ofrecen formas de pago en Bs. */
  hideBsMethods: boolean
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

interface BusinessLike { settings: unknown; catalog_template?: string | null }

function storedOf(settings: unknown): Record<string, unknown> {
  const raw = isRecord(settings) ? settings.cobro_precios : null
  return isRecord(raw) ? raw : {}
}

function collectOf(s: Record<string, unknown>): CollectIn {
  return (COLLECT_IN as readonly string[]).includes(s.collect_in as string) ? (s.collect_in as CollectIn) : 'both'
}

/** Lo que se APLICA: clave ausente = comportamiento de siempre (encendido). */
export function readCobroEffective(settings: unknown): CobroEffective {
  const s = storedOf(settings)
  const collect = collectOf(s)
  return {
    divisaActive:  s.divisa_enabled !== false && collect !== 'bs',
    casheaActive:  s.cashea_enabled !== false && collect !== 'usd',
    hideBsMethods: collect === 'usd',
  }
}

/** Estado que muestra la pantalla (lo guardado; si falta, lo existente). */
export function readCobroPrecios(business: BusinessLike, businessId?: number): CobroPrecios {
  const s = storedOf(business.settings)
  const financing = readFinancingConfig(business.settings, businessId)
  return {
    price_currency: 'usd',
    collect_in:     collectOf(s),
    divisa_enabled: s.divisa_enabled !== false,
    cashea_enabled: typeof s.cashea_enabled === 'boolean' ? s.cashea_enabled : financing.enabled,
    divisa_method_ids: readDivisaMethodIds(business.settings),
    template:       business.catalog_template === 'premium' || business.catalog_template === 'carta' ? business.catalog_template : 'generic',
  }
}

export const cobroPatchSchema = z.strictObject({
  collect_in:        z.enum(COLLECT_IN).optional(),
  divisa_enabled:    z.boolean().optional(),
  cashea_enabled:    z.boolean().optional(),
  divisa_method_ids: z.array(z.number().int().positive()).max(50).optional(),
  template:          z.enum(SELECTABLE_TEMPLATES).optional(),
}).refine(d => Object.values(d).some(v => v !== undefined), { message: 'Nada que guardar' })
export type CobroPatch = z.infer<typeof cobroPatchSchema>

/** Formas de pago para los chips "Paga con" del catálogo, ya filtradas por lo que el negocio apagó. */
export function chipMethods<T extends { id: number; type: string; is_financing: boolean }>(
  methods: readonly T[], settings: unknown,
): { divisa: T[]; bs: T[] } {
  const eff = readCobroEffective(settings)
  const all = splitPayMethods(methods, readDivisaMethodIds(settings))
  return {
    divisa: eff.divisaActive ? all.divisa : [],
    bs:     eff.hideBsMethods ? [] : all.bs.filter(m => !m.is_financing || eff.casheaActive),
  }
}

export class DivisaDisabledError extends Error {
  readonly status = 409
  constructor() { super('El precio Divisa está desactivado en Configuración › Cobro y precios.') }
}

/** El modo Divisa del POS/pedidos solo existe si el negocio lo tiene activo (el servidor manda, no la UI). */
export async function assertDivisaAllowed(tx: Prisma.TransactionClient, businessId: number): Promise<void> {
  const b = await tx.business.findUnique({ where: { id: businessId }, select: { settings: true } })
  if (!readCobroEffective(b?.settings).divisaActive) throw new DivisaDisabledError()
}
