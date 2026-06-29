import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * TENANT LAYER — aislamiento automático por business_id.
 *
 * Equivalente en Prisma 7 a HasTenant + Global Scope de Eloquent.
 * getTenantPrisma(businessId) devuelve un PrismaClient extendido donde TODAS
 * las queries a modelos con columna `business_id` quedan filtradas/inyectadas
 * automáticamente. Un endpoint que use este cliente no puede ver ni tocar datos
 * de otro negocio aunque olvide el WHERE manual.
 *
 * REGLA: un leak aquí filtra datos entre negocios y mata el producto.
 *
 * ── Cómo se decide qué modelo es tenant ──────────────────────────────────
 * NO se mantiene una lista a mano (footgun: agregar un modelo y olvidar la
 * lista = leak silencioso). El set se deriva del DMMF de Prisma en tiempo de
 * carga: un modelo es tenant si tiene un campo escalar `business_id`. Agregar
 * un modelo nuevo al schema lo incluye solo — sin tocar este archivo.
 *
 * ── Exclusiones ──────────────────────────────────────────────────────────
 * DollarRate tiene `business_id Int?` (nullable): la tasa BCV global se guarda
 * con business_id = null y es COMPARTIDA entre todos los negocios. Auto-filtrar
 * por business_id ocultaría las tasas globales, así que queda fuera del scope
 * automático y debe manejarse explícitamente donde se consulte.
 *
 * ── Límites conocidos (no cubiertos por esta capa) ───────────────────────
 *  - Raw queries ($queryRaw / $executeRaw) NO pasan por el extension. Cualquier
 *    SQL crudo debe filtrar business_id a mano.
 *  - Writes anidados (create con relation { create: [...] }) no recursan; las
 *    tablas hijas del schema (SaleItem, OrderItem, etc.) no tienen business_id
 *    y se aíslan transitivamente vía su FK al padre.
 */

// Modelos que NO deben recibir scope automático aunque tengan la columna.
const EXCLUDED_MODELS = new Set<string>([
  'DollarRate', // business_id nullable — tasa global compartida
])

/**
 * Set de modelos con scope de tenant, derivado del schema en runtime.
 * Exportado para inspección/auditoría (lo usa el reporte de gaps y los tests).
 */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter(
      (m) =>
        !EXCLUDED_MODELS.has(m.name) &&
        m.fields.some((f) => f.name === 'business_id'),
    )
    .map((m) => m.name),
)

// Fail-closed: si el DMMF no resolvió ningún modelo, algo está roto a nivel de
// build. Mejor reventar al cargar que correr TODAS las queries sin scope.
if (TENANT_SCOPED_MODELS.size === 0) {
  throw new Error(
    '[TenantLayer] No se resolvió ningún modelo con business_id desde Prisma.dmmf. ' +
      'El tenant layer correría SIN aislamiento — abortando para evitar un leak.',
  )
}

function isTenantModel(model: string): boolean {
  return TENANT_SCOPED_MODELS.has(model)
}

/**
 * Crea un PrismaClient con scope de tenant fijo a `businessId`.
 * Stateless: barato de crear por request.
 */
export function getTenantPrisma(businessId: number) {
  return prisma.$extends({
    query: {
      $allModels: {
        // ── Reads ────────────────────────────────────────────────────────
        async findMany({ model, args, query }) {
          if (isTenantModel(model)) {
            args = args ?? {}
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        async findFirst({ model, args, query }) {
          if (isTenantModel(model)) {
            args = args ?? {}
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        async findFirstOrThrow({ model, args, query }) {
          if (isTenantModel(model)) {
            args = args ?? {}
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        // findUnique/OrThrow: inyectamos business_id en el WHERE aprovechando
        // extendedWhereUnique (Prisma 5+). Es más correcto que validar después
        // de la query: un check post-query con `select` que omite business_id
        // leería undefined y devolvería null incluso para el dueño.
        async findUnique({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        async findUniqueOrThrow({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },

        // ── Aggregations ─────────────────────────────────────────────────
        async count({ model, args, query }) {
          if (isTenantModel(model)) {
            args = args ?? {}
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        async aggregate({ model, args, query }) {
          if (isTenantModel(model)) {
            args = args ?? {}
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        async groupBy({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },

        // ── Writes ───────────────────────────────────────────────────────
        // En create/upsert se inyecta business_id en `data`/`create`. El tipo
        // estático de CreateInput distingue variante-relación de variante-escalar,
        // así que se asigna vía un cast acotado (Record, nunca `any`).
        async create({ model, args, query }) {
          if (isTenantModel(model)) {
            ;(args as { data: Record<string, unknown> }).data = {
              ...(args.data as Record<string, unknown>),
              business_id: businessId,
            }
          }
          return query(args)
        },
        async createMany({ model, args, query }) {
          if (isTenantModel(model)) {
            const incoming = args.data as Record<string, unknown> | Record<string, unknown>[]
            ;(args as { data: unknown }).data = Array.isArray(incoming)
              ? incoming.map((d) => ({ ...d, business_id: businessId }))
              : { ...incoming, business_id: businessId }
          }
          return query(args)
        },
        async update({ model, args, query }) {
          // extendedWhereUnique: where lleva el id único + business_id como
          // filtro extra. Si el row es de otro negocio → P2025 (fail-closed).
          if (isTenantModel(model)) {
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        async updateMany({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        async upsert({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, business_id: businessId }
            ;(args as { create: Record<string, unknown> }).create = {
              ...(args.create as Record<string, unknown>),
              business_id: businessId,
            }
          }
          return query(args)
        },
        async delete({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
        async deleteMany({ model, args, query }) {
          if (isTenantModel(model)) {
            args = args ?? {}
            args.where = { ...args.where, business_id: businessId }
          }
          return query(args)
        },
      },
    },
  })
}

export type TenantPrisma = ReturnType<typeof getTenantPrisma>
