import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { z } from 'zod'

const variantSchema = z.object({
  tipo:         z.enum(['talla', 'color', 'personalizado']),
  valor:        z.string().min(1).max(50),
  sku:          z.string().max(50).nullable().optional(),
  precio_extra: z.number().min(0).default(0),
  stock:        z.number().int().min(0).default(0),
  color_hex:    z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  sort_order:   z.number().int().default(0),
  price_usd:    z.number().min(0).nullable().optional(),
  cost_usd:     z.number().min(0).nullable().optional(),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => { const n = parseInt(raw); return isNaN(n) ? null : n }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { db } = await getAuthenticatedTenant()

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const product = await db.product.findFirst({
      where:  { id }, // business_id inyectado por el tenant layer
      select: { id: true },
    })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    // ProductVariant no tiene business_id — aislado por el chequeo de propiedad del producto
    const variants = await db.productVariant.findMany({
      where:   { product_id: id },
      orderBy: [{ sort_order: 'asc' }, { valor: 'asc' }],
    })

    return NextResponse.json({
      ok:       true,
      variants: variants.map(v => ({ ...v, precio_extra: Number(v.precio_extra) })),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const product = await db.product.findFirst({
      where:  { id }, // business_id inyectado por el tenant layer
      select: { id: true },
    })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const body = variantSchema.parse(await req.json())

    // ProductVariant no tiene business_id — se aísla por product_id ya validado
    const variant = await db.productVariant.create({
      data: {
        product_id:   id,
        tipo:         body.tipo,
        valor:        body.valor,
        sku:          body.sku          ?? null,
        precio_extra: body.precio_extra,
        stock:        body.stock,
        color_hex:    body.color_hex    ?? null,
        sort_order:   body.sort_order,
        price_usd:    body.price_usd    ?? null,
        cost_usd:     body.cost_usd     ?? null,
      },
    })

    return NextResponse.json(
      { ok: true, variant: { ...variant, precio_extra: Number(variant.precio_extra) } },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Variant create error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
