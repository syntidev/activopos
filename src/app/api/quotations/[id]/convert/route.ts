import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { prisma } from '@/lib/prisma'
import { readCachedBcvRate } from '@/lib/bcv'
import { generateTicketNumber } from '@/lib/ticket'

type Context = { params: { id: string } }

/* ── POST /api/quotations/[id]/convert — Quotation → Sale (pending) ── */

export async function POST(_req: NextRequest, { params }: Context) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let session: SessionPayload
  let db: TenantPrisma
  try {
    const t = await getAuthenticatedTenant()
    session = t.session
    db = t.db
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  // Validación (fuera del $transaction) → tenant layer
  const quotation = await db.quotation.findFirst({
    where:   { id }, // business_id inyectado por el tenant layer
    include: { items: true },
  })

  if (!quotation) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

  if (quotation.status === 'rejected' || quotation.status === 'expired') {
    return NextResponse.json(
      { error: 'No se puede convertir una cotización rechazada o vencida' },
      { status: 409 }
    )
  }

  const missingProduct = quotation.items.find(i => i.product_id == null)
  if (missingProduct) {
    return NextResponse.json(
      { error: `El ítem "${missingProduct.name}" no tiene producto asociado — todos los ítems deben tener producto para convertir a venta` },
      { status: 422 }
    )
  }

  const productIds = quotation.items.map(i => i.product_id as number)
  const rate       = await readCachedBcvRate()
  const r2         = (x: number) => Math.round(x * 100) / 100

  try {
    // $transaction en prisma base: business_id manual adentro
    const sale = await prisma.$transaction(async tx => {
      const products = await tx.product.findMany({
        where:  { id: { in: productIds }, business_id: session.businessId },
        select: { id: true, sale_mode: true, base_unit_label: true, cost_per_unit_usd: true },
      })
      const productMap = new Map(products.map(p => [p.id, p]))

      const ticket_number = await generateTicketNumber(session.businessId, tx)

      const total_usd = r2(Number(quotation.total_usd))
      const total_bs  = r2(total_usd * rate)

      const newSale = await tx.sale.create({
        data: {
          business_id:  session.businessId,
          cashier_id:   session.userId,
          ticket_number,
          status:       'credit',
          origin:       'quote',
          total_usd,
          total_bs,
          rate_used:    rate,
          client_id:    quotation.client_id,
          sold_at:      null,
          items: {
            create: quotation.items.map(i => {
              const p           = productMap.get(i.product_id as number)
              const priceUsd    = Number(i.price_usd)
              const subtotalUsd = r2(Number(i.qty) * priceUsd)
              return {
                product_id:         i.product_id as number,
                product_name:       i.name,
                sale_mode:          p?.sale_mode ?? 'unit',
                unit_label:         p?.base_unit_label ?? 'und',
                quantity:           Number(i.qty),
                price_per_unit_usd: priceUsd,
                cost_per_unit_usd:  Number(p?.cost_per_unit_usd ?? 0),
                subtotal_usd:       subtotalUsd,
                subtotal_bs:        r2(subtotalUsd * rate),
                rate_used:          rate,
                discount_usd:       0,
              }
            }),
          },
        },
        select: { id: true, ticket_number: true },
      })

      // status='credit' descuenta stock — misma regla que sales/route.ts (paid|credit).
      // Mismo patrón: entry_type='sale', notes con el ticket, sin reference_id
      // (InventoryEntry no tiene esa columna).
      await tx.inventoryEntry.createMany({
        data: quotation.items.map(i => ({
          business_id: session.businessId,
          product_id:  i.product_id as number,
          quantity:    -Number(i.qty),
          waste:       0,
          entry_type:  'sale',
          notes:       `VENTA #${newSale.ticket_number}`,
          created_by:  session.userId,
        })),
      })

      await tx.quotation.update({
        where: { id },
        data:  { status: 'accepted' },
      })

      return newSale
    })

    return NextResponse.json({ ok: true, sale_id: sale.id, ticket_number: sale.ticket_number })
  } catch (err) {
    console.error('quotations convert POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
