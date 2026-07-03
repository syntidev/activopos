import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const itemSchema = z.object({
  product_id: z.number().int().positive(),
  qty:        z.number().positive(),
  cost_usd:   z.number().min(0),
})

const purchaseSchema = z.object({
  supplier_id: z.number().int().positive(),
  reference:   z.string().trim().max(50).optional(),
  notes:       z.string().trim().optional(),
  status:      z.enum(['received', 'pending', 'cancelled']).default('received'),
  items:       z.array(itemSchema).min(1),
})

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const supplierId = req.nextUrl.searchParams.get('supplier_id')
    const from = req.nextUrl.searchParams.get('from')
    const to   = req.nextUrl.searchParams.get('to')

    const purchases = await db.purchase.findMany({
      where: {
        // business_id inyectado por el tenant layer
        ...(supplierId ? { supplier_id: parseInt(supplierId, 10) } : {}),
        ...((from || to) ? {
          created_at: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
          },
        } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        _count:   { select: { items: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    })

    return NextResponse.json({
      ok: true,
      purchases: purchases.map(p => ({ ...p, total_usd: Number(p.total_usd) })),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    let data: z.infer<typeof purchaseSchema>
    try {
      data = purchaseSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    // Validación (fuera del $transaction) → tenant layer
    const supplier = await db.supplier.findFirst({ where: { id: data.supplier_id, is_active: true } })
    if (!supplier) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    const productIds = Array.from(new Set(data.items.map(i => i.product_id)))
    const products = await db.product.findMany({ where: { id: { in: productIds }, active: true }, select: { id: true } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Uno o más productos no existen' }, { status: 400 })
    }

    // total_usd calculado en el servidor — nunca se confía en un total enviado por el cliente
    const totalUsd = Math.round(data.items.reduce((s, i) => s + i.qty * i.cost_usd, 0) * 100) / 100
    const purchaseNote = data.reference ? `Compra ${data.reference}` : 'Compra a proveedor'

    // $transaction en prisma base: business_id manual adentro (la extension no se propaga al tx)
    const purchase = await prisma.$transaction(async tx => {
      const created = await tx.purchase.create({
        data: {
          business_id: session.businessId,
          supplier_id: data.supplier_id,
          reference:   data.reference || null,
          notes:       data.notes || null,
          status:      data.status,
          total_usd:   totalUsd,
        },
      })

      const items = []
      for (const i of data.items) {
        items.push(await tx.purchaseItem.create({
          data: {
            purchase_id: created.id,
            product_id:  i.product_id,
            qty:         i.qty,
            cost_usd:    i.cost_usd,
          },
        }))
      }

      // Al registrar la compra como recibida → incrementar stock (mismo patrón que el POS, en positivo)
      if (data.status === 'received') {
        await tx.inventoryEntry.createMany({
          data: data.items.map(i => ({
            business_id:       session.businessId,
            product_id:        i.product_id,
            quantity:          i.qty,
            waste:             0,
            entry_type:        'purchase',
            cost_per_unit_usd: i.cost_usd,
            supplier:          supplier.name,
            notes:             purchaseNote,
            created_by:        session.userId,
          })),
        })
      }

      // Compra a crédito (mercancía recibida sin pagar) → genera deuda en CxP
      if (data.status === 'pending') {
        await tx.gasto.create({
          data: {
            business_id: session.businessId,
            concepto:    `Compra proveedor${data.reference ? ` #${data.reference}` : ''} — ${data.items.length} producto(s)`,
            monto_usd:   totalUsd,
            categoria:   'proveedor',
            is_paid:     false,
            due_date:    null,
            supplier:    supplier.name,
            created_by:  session.userId,
            fecha:       new Date(new Date().toISOString().slice(0, 10)),
          },
        })
      }

      return { ...created, items }
    })

    return NextResponse.json({
      ok: true,
      purchase: {
        ...purchase,
        total_usd: Number(purchase.total_usd),
        items: purchase.items.map(i => ({ ...i, qty: Number(i.qty), cost_usd: Number(i.cost_usd) })),
      },
    }, { status: 201 })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
