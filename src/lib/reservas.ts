import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { TenantError, getAuthenticatedTenant } from '@/lib/tenant'
import type { ReservaDTO } from '@/types/reservas'

/**
 * Reservas (preventa 200K) — lógica compartida por los endpoints.
 * NO es una venta: no pasa por Order/Sale/cobrar. Las 3 banderas
 * (armado / entregado / pagado) son independientes entre sí.
 */

const SLUG_RE = /^[a-z0-9-]+$/
const SEARCH_MAX_LEN = 60
const SEARCH_MAX_TOKENS = 5
const MIN_PHONE_DIGITS = 3
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/
const DEFAULT_TICKET_PREFIX = 'RES'
const MAX_TICKET_PREFIX_LEN = 10
export const TICKET_MAX_RETRIES = 5
/** Tope de filas por listado: el Kanban de un evento no pasa de unos cientos. */
export const RESERVAS_LIST_LIMIT = 1000
const MAX_PAGADO_USD = 99_999_999.99

/* ── Acceso ── */

export interface ReservasAccess {
  session: SessionPayload
  db: TenantPrisma
}

/**
 * Puerta ÚNICA de todos los endpoints de reservas. Exige, en orden:
 *  1. sesión válida (si no, lanza TenantError → 401)
 *  2. rol permitido: admin, super_admin u operador_reservas (el cajero no)
 *  3. módulo habilitado para el negocio de la sesión (Business.reservas_enabled)
 * Devuelve el acceso, o la respuesta de rechazo lista para retornar.
 */
export async function requireReservasAccess(): Promise<ReservasAccess | NextResponse> {
  const { session, db } = await getAuthenticatedTenant()
  if (session.role === 'cashier') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { reservas_enabled: true },
  })
  if (!business?.reservas_enabled) {
    return NextResponse.json({ error: 'El módulo de Reservas no está habilitado para este negocio' }, { status: 403 })
  }
  return { session, db }
}

/* ── Schemas ── */

export const extraSchema = z.object({
  nombre:   z.string().trim().min(1).max(80),
  cantidad: z.number().int().min(1).max(50),
  talla:    z.string().trim().max(20).nullable().optional(),
}).strict()

// { "maillot": "L", "franela": "S" } -- claves libres (nombre de componente
// tal como lo tipea el operador), sin validar contra ProductComponent real,
// mismo criterio que extraSchema.nombre. Tope de 20 pares, igual que extras.
export const componentesTallasSchema = z.record(
  z.string().trim().min(1).max(40),
  z.string().trim().min(1).max(20),
).refine(obj => Object.keys(obj).length <= 20, { message: 'Máximo 20 componentes' })

// V-12345678 / E-12345678 -- prefijo V o E, 6 a 9 dígitos (tolera cédulas cortas
// viejas y las más largas actuales). Se normaliza a mayúscula antes de guardar.
const CEDULA_RE = /^[VE]-\d{6,9}$/

export const createReservaSchema = z.object({
  cliente_nombre:     z.string().trim().min(1).max(120),
  cliente_telefono:   z.string().trim().max(30).nullable().optional(),
  cliente_cedula:     z.string().trim().toUpperCase().regex(CEDULA_RE, 'Cédula inválida (formato V-12345678 o E-12345678)'),
  cliente_correo:     z.string().trim().toLowerCase().email('Correo inválido').max(160),
  kit_id:             z.number().int().positive(),
  // Legacy: una sola talla para todo el kit. Sigue aceptado para kits sin
  // desglose por componente; si viene componentes_tallas, ese es el que
  // se muestra (ver serializeReserva / ReservaCard).
  talla:              z.string().trim().max(20).nullable().optional(),
  componentes_tallas: componentesTallasSchema.nullable().optional(),
  cantidad:           z.number().int().min(1).max(100).default(1),
  extras:             z.array(extraSchema).max(20).nullable().optional(),
}).strict() // business_id NUNCA del body: viene de la sesión

export const patchReservaSchema = z.object({
  armado:             z.boolean().optional(),
  entregado:          z.boolean().optional(),
  // OPCIONAL e independiente de `entregado`: se agrega antes, durante o después
  // de la entrega (o nunca). `null` la quita.
  entregado_foto:     z.string().trim().min(1).max(500).nullable().optional(),
  pagado:             z.boolean().optional(),
  pagado_monto:       z.number().positive().max(MAX_PAGADO_USD).optional(),
  pagado_metodo:      z.string().trim().min(1).max(30).optional(),
  // Corrección post-creación (ej. el cliente cambió de talla). Independiente
  // de las 3 banderas -- un PATCH con solo esto no las toca.
  componentes_tallas: componentesTallasSchema.nullable().optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: 'Sin cambios' })

export type CreateReservaBody = z.infer<typeof createReservaSchema>
export type PatchReservaBody  = z.infer<typeof patchReservaSchema>

/* ── Query params ── */

/** `collection` opcional: slug de la colección del kit (ej. "200k-2027"). */
export function parseCollectionParam(
  raw: string | null,
): { ok: true; slug: string | null } | { ok: false; error: string } {
  if (raw === null || raw === '') return { ok: true, slug: null }
  const slug = raw.trim()
  if (slug.length > 60 || !SLUG_RE.test(slug)) {
    return { ok: false, error: 'collection inválida (solo minúsculas, números y guiones)' }
  }
  return { ok: true, slug }
}

/**
 * Búsqueda híbrida: un solo texto libre que se separa en palabras. El valor va
 * a Prisma como parámetro (no se concatena), por eso solo se acotan largo y
 * caracteres de control.
 */
export function parseSearchParam(
  raw: string | null,
): { ok: true; tokens: string[] } | { ok: false; error: string } {
  const q = (raw ?? '').trim()
  if (q.length === 0 || q.length > SEARCH_MAX_LEN || CONTROL_CHARS_RE.test(q)) {
    return { ok: false, error: `búsqueda inválida (1 a ${SEARCH_MAX_LEN} caracteres)` }
  }
  return { ok: true, tokens: q.split(/\s+/).slice(0, SEARCH_MAX_TOKENS) }
}

/**
 * Cada palabra debe aparecer en ALGUNO de: ticket_number, cliente_nombre o
 * cliente_telefono (AND entre palabras, OR entre campos). "juan 047" encuentra
 * al cliente Juan cuyo ticket es 200K-047. Si la palabra tiene ≥3 dígitos
 * también se busca solo por sus dígitos, para "0414-111" vs "0414111".
 */
export function reservasBySearch(tokens: readonly string[]): Prisma.ReservaWhereInput {
  return {
    AND: tokens.map(token => {
      const digits = token.replace(/\D/g, '')
      return {
        OR: [
          { ticket_number:    { contains: token } },
          { cliente_nombre:   { contains: token } },
          { cliente_telefono: { contains: token } },
          ...(digits.length >= MIN_PHONE_DIGITS && digits !== token
            ? [{ cliente_telefono: { contains: digits } }]
            : []),
        ],
      }
    }),
  }
}

/** Filtra reservas por la colección a la que pertenece su kit, dentro del tenant. */
export function reservasByCollection(
  slug: string | null,
  businessId: number,
): Prisma.ReservaWhereInput {
  if (!slug) return {}
  return {
    kit: { collections: { some: { collection: { slug, business_id: businessId } } } },
  }
}

/* ── Ticket correlativo ── */

/** "200k-2027" -> "200K". Sin slug usable cae a "RES". */
export function ticketPrefixFromSlug(slug: string | undefined): string {
  const segment = (slug ?? '').split('-')[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? ''
  return segment ? segment.slice(0, MAX_TICKET_PREFIX_LEN) : DEFAULT_TICKET_PREFIX
}

/**
 * Siguiente número para `prefix` dado los tickets existentes. Compara el número
 * como entero (no como string) para no ordenar "200K-1000" antes de "200K-999".
 * `prefix` solo contiene [A-Z0-9], por eso entra directo al RegExp.
 */
export function nextTicketNumber(prefix: string, existing: readonly string[]): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`)
  let max = 0
  for (const ticket of existing) {
    const match = re.exec(ticket)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

/* ── Banderas independientes ── */

/** La foto de entrega debe ser una subida de ESTE negocio (tipo "reservas"). */
export function isValidFotoPath(path: string, businessId: number): boolean {
  return new RegExp(
    `^/storage/tenants/${businessId}/reservas/[0-9a-f-]{36}(_thumb)?\\.webp$`,
  ).test(path)
}

export interface FlagUpdate {
  armado?:         boolean
  entregado?:      boolean
  entregado_foto?: string | null
  pagado?:         boolean
  pagado_monto?:   number | null
  pagado_metodo?:  string | null
}

export interface ExistingFlags {
  pagado_monto:   number | null
  pagado_metodo:  string | null
}

/**
 * Traduce el PATCH a un update. Cada bandera se procesa sola: marcar una nunca
 * toca las otras dos. Reglas:
 *  - entregado se marca/desmarca SIN condiciones. La foto es opcional y va aparte.
 *  - entregado_foto se agrega/cambia/quita (null) sin importar el estado de entregado.
 *  - pagado=true exige monto (en el body o ya guardado); método por defecto efectivo.
 */
export function buildFlagUpdate(
  existing: ExistingFlags,
  body: PatchReservaBody,
  businessId: number,
): { ok: true; data: FlagUpdate } | { ok: false; error: string } {
  const data: FlagUpdate = {}

  if (body.armado !== undefined) data.armado = body.armado

  // Nunca se bloquea el marcado de entrega por falta de foto.
  if (body.entregado !== undefined) data.entregado = body.entregado

  // Foto opcional: solo se valida que, si viene, sea una subida de ESTE negocio.
  if (body.entregado_foto !== undefined) {
    if (body.entregado_foto !== null && !isValidFotoPath(body.entregado_foto, businessId)) {
      return { ok: false, error: 'entregado_foto debe ser una foto subida de este negocio (tipo reservas)' }
    }
    data.entregado_foto = body.entregado_foto
  }

  if (body.pagado === true) {
    const monto = body.pagado_monto ?? existing.pagado_monto
    if (monto === null || monto === undefined) {
      return { ok: false, error: 'El monto es obligatorio para marcar Pagado' }
    }
    data.pagado = true
    data.pagado_monto = monto
    data.pagado_metodo = body.pagado_metodo ?? existing.pagado_metodo ?? 'efectivo'
  } else if (body.pagado === false) {
    if (body.pagado_monto !== undefined || body.pagado_metodo !== undefined) {
      return { ok: false, error: 'pagado_monto/pagado_metodo solo se envían junto con pagado=true' }
    }
    data.pagado = false
    data.pagado_monto = null
    data.pagado_metodo = null
  } else if (body.pagado_monto !== undefined || body.pagado_metodo !== undefined) {
    return { ok: false, error: 'pagado_monto/pagado_metodo solo se envían junto con pagado=true' }
  }

  return { ok: true, data }
}

/* ── Serialización ── */

export const RESERVA_INCLUDE = {
  kit: { select: { id: true, name: true } },
} as const satisfies Prisma.ReservaInclude

export type ReservaRow = Prisma.ReservaGetPayload<{ include: typeof RESERVA_INCLUDE }>

export function serializeReserva(row: ReservaRow): ReservaDTO {
  const parsedExtras = z.array(extraSchema).safeParse(row.extras)
  const parsedTallas = componentesTallasSchema.safeParse(row.componentes_tallas)
  return {
    id:                 row.id,
    ticket_number:      row.ticket_number,
    cliente_nombre:     row.cliente_nombre,
    cliente_telefono:   row.cliente_telefono,
    cliente_cedula:     row.cliente_cedula,
    cliente_correo:     row.cliente_correo,
    kit_id:             row.kit_id,
    kit_nombre:         row.kit.name,
    talla:              row.talla,
    componentes_tallas: parsedTallas.success ? parsedTallas.data : null,
    cantidad:           row.cantidad,
    extras: parsedExtras.success
      ? parsedExtras.data.map(e => ({ nombre: e.nombre, cantidad: e.cantidad, talla: e.talla ?? null }))
      : null,
    // Columna String libre en DB (mismo criterio que status/estado en el resto
    // del schema); la app solo escribe estos dos valores por ahora.
    fase: row.fase === 'cobranza' ? 'cobranza' : 'preventa_apartado',
    armado:           row.armado,
    entregado:        row.entregado,
    entregado_foto:   row.entregado_foto,
    pagado:           row.pagado,
    pagado_monto:     row.pagado_monto === null ? null : Number(row.pagado_monto),
    pagado_metodo:    row.pagado_metodo,
    created_at:       row.created_at.toISOString(),
    updated_at:       row.updated_at.toISOString(),
  }
}

/* ── Errores HTTP ── */

export function badRequest(err: z.ZodError): NextResponse {
  return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
}

export function handleReservaError(err: unknown, context: string): NextResponse {
  if (err instanceof TenantError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(`[reservas] ${context} falló:`, err)
  return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
}
