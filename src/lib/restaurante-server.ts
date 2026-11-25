import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { TenantError, getAuthenticatedTenant } from '@/lib/tenant'
import { parseSearchParam } from '@/lib/reservas'
import { GRID_MAX, renderedSize, tableStatus, type Box } from '@/lib/restaurante'
import type {
  DiningTableDTO, FloorElementDTO, FloorKind, SalonSnapshot, ServiceAreaDTO, TableRotation, TableShape,
} from '@/types/restaurante'

/**
 * Módulo Restaurante — lógica de SERVIDOR (R1: áreas, mesas, plano).
 * La parte pura (estado derivado, búsqueda, geometría) vive en restaurante.ts.
 */

/* ── Acceso ── */

export interface RestauranteAccess {
  session: SessionPayload
  db: TenantPrisma
  isAdmin: boolean
}

/**
 * Puerta ÚNICA de todos los endpoints del módulo. En orden:
 *  1. sesión válida (si no, TenantError → 401)
 *  2. flag Business.restaurante_enabled (si no, 404: sin flag el módulo no existe)
 *  3. rol: admin y super_admin todo; cashier y waiter leen y marcan; kitchen nada en R1.
 *     level 'admin' exige admin/super_admin (estructura del plano).
 */
export async function requireRestauranteAccess(level: 'read' | 'admin' = 'read'): Promise<RestauranteAccess | NextResponse> {
  const { session, db } = await getAuthenticatedTenant()
  if (!(await isRestauranteEnabled(session.businessId))) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  const isAdmin = session.role === 'admin' || session.role === 'super_admin'
  const canRead = isAdmin || session.role === 'cashier' || session.role === 'waiter'
  if (!canRead || (level === 'admin' && !isAdmin)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  return { session, db, isAdmin }
}

/** Compartido con los layout.tsx de servidor (notFound) y la ruta de módulos del Sidebar. */
export async function isRestauranteEnabled(businessId: number): Promise<boolean> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { restaurante_enabled: true } })
  return business?.restaurante_enabled === true
}

/* ── Esquemas (Zod 4) ── */

const SPAN_MAX = 20
export const BATCH_MAX = 100

const gridPos = z.number().int().min(0).max(GRID_MAX)
const span = z.number().int().min(1).max(SPAN_MAX)
const rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
const tableShape = z.enum(['rect', 'round', 'stool'])
const floorKind = z.enum(['wall', 'door', 'bar', 'pass'])
const tableLabel = z.string().trim().min(1).max(20)
const capacity = z.number().int().min(1).max(30)
const phone = z.string().trim().max(30).transform(s => s.replace(/[^\d+]/g, ''))

export const areaCreateSchema = z.object({
  name:       z.string().trim().min(1).max(60),
  sort_order: z.number().int().min(0).max(999).optional(),
})
export const areaPatchSchema = z.object({
  name:       z.string().trim().min(1).max(60).optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
  active:     z.boolean().optional(),
}).refine(o => Object.keys(o).length > 0, { message: 'Nada que actualizar' })

const tableSingleSchema = z.object({
  area_id:  z.number().int().positive(),
  label:    tableLabel,
  capacity: capacity.optional(),
  shape:    tableShape.optional(),
  pos_x:    gridPos.optional(),
  pos_y:    gridPos.optional(),
  width:    span.optional(),
  height:   span.optional(),
  rotation: rotation.optional(),
})
/** "Crear mesas en lote": del 13 al 16 → mesas "13".."16", colocadas en filas libres del plano. */
const tableBatchSchema = z.object({
  area_id:  z.number().int().positive(),
  from:     z.number().int().min(1).max(9999),
  to:       z.number().int().min(1).max(9999),
  capacity: capacity.optional(),
  shape:    tableShape.optional(),
}).refine(o => o.to >= o.from && o.to - o.from < BATCH_MAX, { message: `Rango inválido (máx. ${BATCH_MAX} mesas)` })
export const tableCreateSchema = z.union([tableBatchSchema, tableSingleSchema])

/** Campos que cambian el plano o el catálogo de mesas: solo admin. El resto son marcas operativas. */
export const TABLE_STRUCTURAL_KEYS = ['area_id', 'label', 'capacity', 'shape', 'pos_x', 'pos_y', 'width', 'height', 'rotation', 'active'] as const
export const tablePatchSchema = z.object({
  area_id:  z.number().int().positive().optional(),
  label:    tableLabel.optional(),
  capacity: capacity.optional(),
  shape:    tableShape.optional(),
  pos_x:    gridPos.optional(),
  pos_y:    gridPos.optional(),
  width:    span.optional(),
  height:   span.optional(),
  rotation: rotation.optional(),
  active:   z.boolean().optional(),
  cleaning_pending: z.boolean().optional(),
  reserved_for:     z.string().trim().min(1).max(80).nullable().optional(),
  reserved_phone:   phone.nullable().optional(),
  reserved_at:      z.string().datetime({ offset: true }).nullable().optional(),
}).refine(o => Object.keys(o).length > 0, { message: 'Nada que actualizar' })

export const elementCreateSchema = z.object({
  area_id:  z.number().int().positive(),
  kind:     floorKind,
  label:    z.string().trim().max(40).nullable().optional(),
  pos_x:    gridPos,
  pos_y:    gridPos,
  width:    span,
  height:   span,
  rotation: rotation.optional(),
})
export const elementPatchSchema = z.object({
  label:    z.string().trim().max(40).nullable().optional(),
  pos_x:    gridPos.optional(),
  pos_y:    gridPos.optional(),
  width:    span.optional(),
  height:   span.optional(),
  rotation: rotation.optional(),
}).refine(o => Object.keys(o).length > 0, { message: 'Nada que actualizar' })

/* ── Serialización ── */

export const TABLE_INCLUDE = { area: { select: { name: true } } } satisfies Prisma.DiningTableInclude
type TableRow = Prisma.DiningTableGetPayload<{ include: typeof TABLE_INCLUDE }>

export function serializeTable(row: TableRow): DiningTableDTO {
  return {
    id: row.id, area_id: row.area_id, area_name: row.area.name, label: row.label, capacity: row.capacity,
    shape: row.shape as TableShape, pos_x: row.pos_x, pos_y: row.pos_y, width: row.width, height: row.height,
    rotation: row.rotation as TableRotation, active: row.active,
    cleaning_pending: row.cleaning_pending, reserved_for: row.reserved_for, reserved_phone: row.reserved_phone,
    reserved_at: row.reserved_at ? row.reserved_at.toISOString() : null,
    status: tableStatus(row), // R2: aquí entra la cuenta abierta de la mesa
  }
}

export function serializeElement(row: Prisma.FloorElementGetPayload<object>): FloorElementDTO {
  return {
    id: row.id, area_id: row.area_id, kind: row.kind as FloorKind, label: row.label,
    pos_x: row.pos_x, pos_y: row.pos_y, width: row.width, height: row.height, rotation: row.rotation as TableRotation,
  }
}

export function serializeArea(row: Prisma.ServiceAreaGetPayload<object>, tableCount: number): ServiceAreaDTO {
  return { id: row.id, name: row.name, sort_order: row.sort_order, active: row.active, table_count: tableCount }
}

/** Todo el salón de un negocio, listo para la página del plano y la configuración. */
export async function loadSalon(db: TenantPrisma): Promise<SalonSnapshot> {
  const [areas, tables, elements] = await Promise.all([
    db.serviceArea.findMany({ orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] }),
    db.diningTable.findMany({ include: TABLE_INCLUDE, orderBy: [{ area_id: 'asc' }, { id: 'asc' }] }),
    db.floorElement.findMany({ orderBy: { id: 'asc' } }),
  ])
  const counts = new Map<number, number>()
  for (const t of tables) if (t.active) counts.set(t.area_id, (counts.get(t.area_id) ?? 0) + 1)
  return {
    areas:    areas.map(a => serializeArea(a, counts.get(a.id) ?? 0)),
    tables:   tables.map(serializeTable),
    elements: elements.map(serializeElement),
  }
}

/* ── Búsqueda (siempre como parámetro de Prisma) ── */

/** AND entre palabras, OR entre campos: label, nombre del área o a nombre de quién está reservada. */
export function tablesBySearch(tokens: readonly string[]): Prisma.DiningTableWhereInput {
  return {
    AND: tokens.map(token => ({
      OR: [
        { label:        { contains: token } },
        { area:         { name: { contains: token } } },
        { reserved_for: { contains: token } },
      ],
    })),
  }
}

export { parseSearchParam }

/* ── Colocación automática (freeSpot vive en restaurante.ts, compartido con el editor) ── */

/** Cajas ya ocupadas de un área (mesas activas y mobiliario), para freeSpot. */
export async function takenBoxes(db: TenantPrisma, areaId: number): Promise<Box[]> {
  const [tables, elements] = await Promise.all([
    db.diningTable.findMany({ where: { area_id: areaId, active: true } }),
    db.floorElement.findMany({ where: { area_id: areaId } }),
  ])
  return [...tables, ...elements].map(r => ({ x: r.pos_x, y: r.pos_y, ...renderedSize(r.width, r.height, r.rotation) }))
}

/* ── Errores ── */

export function badRequest(error: ZodError): NextResponse {
  return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
}

export function handleRestauranteError(err: unknown, context: string): NextResponse {
  if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
  const code = (err as { code?: string } | null)?.code
  if (code === 'P2002') return NextResponse.json({ error: 'Ya existe un registro con ese nombre' }, { status: 409 })
  if (code === 'P2025') return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  console.error(`[restaurante] ${context} falló:`, err)
  return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
}

/**
 * Cuentas de mesa abiertas del negocio. La desactivación del módulo y el borrado de mesas se bloquean si > 0.
 * Hoy no existen cuentas (llegan con R2): devuelve 0. Punto único donde R2 conecta la consulta real.
 */
export async function countOpenTableAccounts(_businessId: number): Promise<number> {
  return 0
}

/** Lee el cuerpo JSON sin reventar con un cuerpo vacío o roto. */
export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json() } catch { return null }
}
