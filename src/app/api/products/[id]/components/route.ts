import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const addSchema = z.object({
  component_id: z.number().int().positive(),
  quantity:     z.number().positive(),
  unit_label:   z.string().max(20).default('und'),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const n = parseInt(raw)
  return isNaN(n) ? null : n
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { db } = await getAuthenticatedTenant()

    const parentId = parseId(params.id)
    if (!parentId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const parent = await db.product.findFirst({
      where: { id: parentId, active: true }, // business_id inyectado por el tenant layer
      select: { id: true, name: true, product_type: true },
    })
    if (!parent) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const components = await db.productComponent.findMany({
      where: { parent_id: parentId }, // business_id inyectado por el tenant layer
      include: {
        component: {
          select: { id: true, name: true, sale_mode: true, base_unit_label: true },
        },
      },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({ ok: true, components })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const parentId = parseId(params.id)
  if (!parentId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = addSchema.parse(await req.json())

    if (body.component_id === parentId) {
      return NextResponse.json({ error: 'Un producto no puede ser componente de sí mismo' }, { status: 422 })
    }

    const [parent, component] = await Promise.all([
      prisma.product.findFirst({
        where: { id: parentId, business_id: session.businessId, active: true },
        select: { id: true, product_type: true },
      }),
      prisma.product.findFirst({
        where: { id: body.component_id, business_id: session.businessId, active: true },
        select: { id: true, product_type: true },
      }),
    ])

    if (!parent) return NextResponse.json({ error: 'Producto padre no encontrado' }, { status: 404 })
    if (!component) return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 })

    if (parent.product_type === 'simple') {
      return NextResponse.json({ error: 'Solo combos o fabricables pueden tener componentes' }, { status: 422 })
    }

    // v1: no chain — components cannot themselves be combos or fabricables
    if (component.product_type !== 'simple') {
      return NextResponse.json({ error: 'Un componente no puede ser combo ni fabricable (v1)' }, { status: 422 })
    }

    const record = await prisma.productComponent.create({
      data: {
        business_id:  session.businessId,
        parent_id:    parentId,
        component_id: body.component_id,
        quantity:     body.quantity,
        unit_label:   body.unit_label,
      },
      include: {
        component: { select: { id: true, name: true, sale_mode: true, base_unit_label: true } },
      },
    })

    return NextResponse.json({ ok: true, component: record }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    // unique constraint: duplicate component
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Este componente ya está en la receta' }, { status: 409 })
    }
    console.error('components POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
