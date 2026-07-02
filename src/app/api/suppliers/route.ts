import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit } from '@/lib/plan-guard'

const supplierSchema = z.object({
  name:    z.string().trim().min(1).max(150),
  rif:     z.string().trim().max(20).optional(),
  phone:   z.string().trim().max(20).optional(),
  email:   z.string().trim().email().max(100).optional().or(z.literal('')),
  address: z.string().trim().max(255).optional(),
  notes:   z.string().trim().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const q = req.nextUrl.searchParams.get('q')?.trim()

    const suppliers = await db.supplier.findMany({
      where: {
        is_active: true, // business_id inyectado por el tenant layer
        ...(q ? { OR: [{ name: { contains: q } }, { rif: { contains: q } }] } : {}),
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ ok: true, suppliers })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    let data: z.infer<typeof supplierSchema>
    try {
      data = supplierSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const planCheck = await checkPlanLimit('create_supplier')
    if (!planCheck.allowed) return NextResponse.json({ error: planCheck.reason }, { status: 403 })

    const supplier = await db.supplier.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        name:    data.name,
        rif:     data.rif || null,
        phone:   data.phone || null,
        email:   data.email || null,
        address: data.address || null,
        notes:   data.notes || null,
      },
    })

    return NextResponse.json({ ok: true, supplier }, { status: 201 })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
