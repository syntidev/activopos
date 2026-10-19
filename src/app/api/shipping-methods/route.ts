import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { toShippingMethodDTO } from '@/lib/shipping-methods'
import { SHIPPING_KINDS } from '@/types/shipping'
import type { ShippingKind } from '@/types/shipping'

// CRUD de métodos de envío del negocio (Configuración). Lectura: cualquier rol del negocio.
// Escritura: solo admin/super_admin. business_id SIEMPRE de la sesión (capa de tenant).

const createSchema = z.object({
  code:            z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,40}$/, 'code: 2-40 caracteres a-z, 0-9, _ o -'),
  label:           z.string().trim().min(1).max(120),
  kind:            z.enum(SHIPPING_KINDS as [ShippingKind, ...ShippingKind[]]),
  requires_branch: z.boolean().default(false),
  active:          z.boolean().default(true),
  sort_order:      z.number().int().min(0).max(9999).default(0),
  instructions:    z.string().trim().max(2000).nullable().optional(),
}).strict()

export async function GET(): Promise<NextResponse> {
  try {
    const { db } = await getAuthenticatedTenant()
    const rows = await db.businessShippingMethod.findMany({ orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] }) // business_id inyectado
    return NextResponse.json({ ok: true, methods: rows.map(toShippingMethodDTO) })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('shipping-methods GET error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const parsed = createSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
    }
    const created = await db.businessShippingMethod.create({
      data: { business_id: session.businessId, ...parsed.data, instructions: parsed.data.instructions ?? null },
    })
    return NextResponse.json({ ok: true, method: toShippingMethodDTO(created) }, { status: 201 })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un método con ese código.', field: 'code' }, { status: 409 })
    }
    console.error('shipping-methods POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
