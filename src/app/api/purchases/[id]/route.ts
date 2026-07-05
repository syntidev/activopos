import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

const patchSchema = z.object({
  reference: z.string().trim().max(50).nullable().optional(),
  notes:     z.string().trim().nullable().optional(),
  status:    z.enum(['received', 'cancelled']).optional(), // 'pending' nunca es destino — es el estado inicial
})

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const purchase = await db.purchase.findFirst({
      where: { id }, // business_id inyectado
      include: {
        supplier: true,
        items: {
          include: { product: { select: { id: true, name: true, price_per_unit_usd: true } } },
        },
      },
    })
    if (!purchase) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

    return NextResponse.json({
      ok: true,
      purchase: {
        ...purchase,
        total_usd: Number(purchase.total_usd),
        items: purchase.items.map(i => ({
          ...i,
          qty:      Number(i.qty),
          cost_usd: Number(i.cost_usd),
          product:  { ...i.product, price_per_unit_usd: i.product.price_per_unit_usd != null ? Number(i.product.price_per_unit_usd) : null },
        })),
      },
    })
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

    // Ownership scoped por tenant (el $transaction usa prisma base, sin scope automático)
    const existing = await db.purchase.findFirst({
      where: { id }, // business_id inyectado
      include: { items: true },
    })
    if (!existing) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

    // Estado terminal — cancelled nunca transiciona a nada
    if (data.status !== undefined && existing.status === 'cancelled') {
      return NextResponse.json({ error: 'La compra está anulada — no se puede modificar' }, { status: 400 })
    }

    // ── pending → received: confirma la compra. NUNCA toca inventario — el
    // stock ya se sumó en POST (Sprint 64). Solo garantiza que exista la CxP
    // (sin duplicar si ya existe) y actualiza el status. ────────────────────
    if (data.status === 'received') {
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: 'Solo una compra pending puede pasar a received' }, { status: 400 })
      }

      const bid = session.businessId
      const purchase = await prisma.$transaction(async tx => {
        const existingGasto = await tx.gasto.findFirst({
          where: { purchase_id: id, business_id: bid },
          select: { id: true },
        })

        if (!existingGasto) {
          const supplier = await tx.supplier.findFirst({ where: { id: existing.supplier_id }, select: { name: true } })
          await tx.gasto.create({
            data: {
              business_id: bid,
              concepto:    `Compra proveedor${existing.reference ? ` #${existing.reference}` : ''}`,
              monto_usd:   existing.total_usd,
              categoria:   'proveedor',
              is_paid:     false,
              due_date:    null,
              supplier:    supplier?.name ?? null,
              supplier_id: existing.supplier_id,
              purchase_id: id,
              created_by:  session.userId,
              fecha:       new Date(new Date().toISOString().slice(0, 10)),
            },
          })
        }
        // Si ya existe la CxP → no se toca, no se duplica.

        return tx.purchase.update({
          where: { id, business_id: bid },
          data:  { status: 'received' },
        })
      })

      return NextResponse.json({ ok: true, purchase: { ...purchase, total_usd: Number(purchase.total_usd) } })
    }

    // ── Anulación con rollback atómico ──────────────────────────────────────
    // (existing.status === 'cancelled' ya fue rechazado arriba con 400 — este
    // branch solo se alcanza con pending/received vivos)
    if (data.status === 'cancelled') {
      // Cantidad a revertir por producto (un producto puede repetirse en items)
      const reverseByProduct = new Map<number, number>()
      for (const it of existing.items) {
        reverseByProduct.set(it.product_id, (reverseByProduct.get(it.product_id) ?? 0) + Number(it.qty))
      }

      // Verificar stock suficiente ANTES de tocar nada — stock nunca puede quedar negativo
      for (const [productId, reverseQty] of Array.from(reverseByProduct)) {
        const agg = await db.inventoryEntry.aggregate({
          where: { product_id: productId }, // business_id inyectado
          _sum:  { quantity: true, waste: true },
        })
        const net = Number(agg._sum.quantity ?? 0) - Number(agg._sum.waste ?? 0)
        if (net < reverseQty) {
          return NextResponse.json(
            { error: 'Stock insuficiente para revertir esta compra' },
            { status: 409 },
          )
        }
      }

      const bid = session.businessId
      // $transaction con prisma base (la extension no se propaga al tx) — business_id manual
      const cancelled = await prisma.$transaction(async tx => {
        await tx.inventoryEntry.createMany({
          data: existing.items.map(it => ({
            business_id:       bid,
            product_id:        it.product_id,
            quantity:          -Number(it.qty),
            waste:             0,
            entry_type:        'purchase_reversal',
            cost_per_unit_usd: Number(it.cost_usd),
            supplier:          null,
            notes:             `Anulación compra #${id}`,
            created_by:        session.userId,
          })),
        })

        // Cerrar la CxP ligada (si existe y sigue sin pagar) — SOFT DELETE con
        // trazabilidad: nunca se borra un registro financiero, se marca cancelled.
        await tx.gasto.updateMany({
          where: { purchase_id: id, business_id: bid, is_paid: false },
          data: {
            status:           'cancelled',
            cancelled_reason: 'compra_anulada',
            cancelled_at:     new Date(),
            cancelled_by:     session.userId, // desde sesión, nunca del body
          },
        })

        return tx.purchase.update({
          where: { id, business_id: bid },
          data:  { status: 'cancelled' },
        })
      })

      return NextResponse.json({ ok: true, purchase: { ...cancelled, total_usd: Number(cancelled.total_usd) } })
    }

    // ── Edición simple (notes/reference) — items inmutables ──────────────────
    const purchase = await db.purchase.update({
      where: { id }, // business_id inyectado
      data: {
        ...(data.reference !== undefined ? { reference: data.reference || null } : {}),
        ...(data.notes !== undefined     ? { notes: data.notes || null }         : {}),
      },
    })

    return NextResponse.json({ ok: true, purchase: { ...purchase, total_usd: Number(purchase.total_usd) } })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
