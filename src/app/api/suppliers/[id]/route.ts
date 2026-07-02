import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type RouteContext = { params: { id: string } }

const patchSchema = z.object({
  name:      z.string().trim().min(1).max(150).optional(),
  rif:       z.string().trim().max(20).nullable().optional(),
  phone:     z.string().trim().max(20).nullable().optional(),
  email:     z.string().trim().email().max(100).nullable().optional().or(z.literal('')),
  address:   z.string().trim().max(255).nullable().optional(),
  notes:     z.string().trim().nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const supplier = await db.supplier.findFirst({ where: { id } }) // business_id inyectado
    if (!supplier) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    return NextResponse.json({ ok: true, supplier })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    let data: z.infer<typeof patchSchema>
    try {
      data = patchSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const existing = await db.supplier.findFirst({ where: { id } }) // business_id inyectado
    if (!existing) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    const supplier = await db.supplier.update({
      where: { id }, // business_id inyectado
      data: {
        ...(data.name !== undefined    ? { name: data.name }              : {}),
        ...(data.rif !== undefined     ? { rif: data.rif || null }        : {}),
        ...(data.phone !== undefined   ? { phone: data.phone || null }    : {}),
        ...(data.email !== undefined   ? { email: data.email || null }    : {}),
        ...(data.address !== undefined ? { address: data.address || null } : {}),
        ...(data.notes !== undefined   ? { notes: data.notes || null }    : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active }  : {}),
      },
    })

    return NextResponse.json({ ok: true, supplier })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.supplier.findFirst({ where: { id } }) // business_id inyectado
    if (!existing) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    const supplier = await db.supplier.update({
      where: { id }, // business_id inyectado
      data:  { is_active: false },
    })

    return NextResponse.json({ ok: true, supplier })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
