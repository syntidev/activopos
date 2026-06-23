import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { generateTicketNumber } from '@/lib/ticket'
import { createNotification } from '@/lib/notifications'

const saleItemSchema = z.object({
  product_id:   z.number().int().positive(),
  quantity:     z.number().positive(),
  sale_mode:    z.enum(['unit', 'weight', 'service', 'length', 'volume', 'package']),
  discount_usd: z.number().min(0).default(0),
  variant_id:   z.number().int().positive().optional(),
  // price_per_unit_usd NOT accepted from client — SEC-01: always fetched from DB
})

const paymentSchema = z.object({
  payment_method_id: z.number().int().positive(),
  amount_bs: z.number().positive(),
  amount_usd: z.number().positive(),
  reference: z.string().optional(),
})

const saleSchema = z.object({
  items:        z.array(saleItemSchema).min(1),
  client_id:    z.number().int().positive().optional(),
  client_name:  z.string().max(120).optional(),
  status:       z.enum(['quote', 'pending', 'paid']),
  origin:       z.enum(['pos', 'quote', 'credit']),
  notes:        z.string().optional(),
  payments:     z.array(paymentSchema).optional(),
  due_date:     z.string().datetime().optional(),
  credit_days:  z.number().int().positive().optional(),
  credit_notes: z.string().max(500).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const status = params.get('status')
  const from = params.get('from')
  const to = params.get('to')
  const cashierId = params.get('cashier_id')
  const clientId = params.get('client_id')
  const ticket = params.get('ticket')

  const sales = await prisma.sale.findMany({
    where: {
      business_id: session.businessId,
      ...(ticket && {
        ticket_number: { contains: ticket },
      }),
      ...(status && {
        status: status as 'quote' | 'pending' | 'paid' | 'cancelled',
      }),
      ...(from || to
        ? {
            sold_at: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(`${to}T23:59:59`) }),
            },
          }
        : {}),
      ...(cashierId && { cashier_id: parseInt(cashierId, 10) }),
      ...(clientId && { client_id: parseInt(clientId, 10) }),
    },
    include: {
      items: true,
      payments: {
        include: { payment_method: { select: { id: true, name: true, type: true } } },
      },
      client: { select: { id: true, name: true, phone: true } },
      cashier: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  })

  return NextResponse.json({ ok: true, sales })
}

async function checkStockAlerts(businessId: number, productIds: number[], ticketNumber: string) {
  // FIX 5: scope to business_id for tenant isolation
  const products = await prisma.product.findMany({
    where:  { id: { in: productIds }, business_id: businessId },
    select: { id: true, name: true, stock_alert_threshold: true },
  })
  const aggs = await Promise.all(
    products.map(p =>
      prisma.inventoryEntry
        .aggregate({ where: { product_id: p.id, business_id: businessId }, _sum: { quantity: true, waste: true } })
        .then(a => ({ id: p.id, net: Number(a._sum.quantity ?? 0) - Number(a._sum.waste ?? 0) }))
    )
  )
  const stockMap = new Map(aggs.map(a => [a.id, a.net]))
  for (const p of products) {
    const net = stockMap.get(p.id) ?? 0
    // FIX 6: threshold=0 means "disabled" — only alert when threshold is explicitly set above zero
    if (p.stock_alert_threshold > 0 && net <= p.stock_alert_threshold) {
      await createNotification(
        businessId,
        'stock_low',
        'Stock bajo',
        `${p.name}: ${net} unidades disponibles (umbral: ${p.stock_alert_threshold}). Venta: ${ticketNumber}.`,
        'product',
        p.id
      )
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = saleSchema.parse(await req.json())

    if (body.status === 'paid' && (!body.payments || body.payments.length === 0)) {
      return NextResponse.json(
        { error: 'Se requieren métodos de pago para cobrar' },
        { status: 400 }
      )
    }

    if (body.origin === 'credit' && !body.client_id && !body.client_name?.trim()) {
      return NextResponse.json(
        { error: 'Se requiere nombre o cliente para registrar una venta a crédito' },
        { status: 400 }
      )
    }

    const rate = await getBcvRate()

    const { sale, componentAlertIds } = await prisma.$transaction(async (tx) => {
      const productIds = body.items.map(i => i.product_id)
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          business_id: session.businessId,
          active: true,
        },
        select: {
          id: true, name: true, base_unit_label: true,
          product_type: true, unit_type: true, unit_step: true,
          price_per_unit_usd: true, price_per_kg_usd: true,
          components: {
            select: {
              id: true, component_id: true, quantity: true, unit_label: true,
              component: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (products.length !== new Set(productIds).size) {
        throw new Error('Uno o más productos no encontrados o inactivos')
      }

      const productMap = new Map(products.map(p => [p.id, p]))

      // R4: if credit sale has client_name but no client_id → create client atomically
      let clientId: number | null = body.client_id ?? null
      if (body.origin === 'credit' && clientId === null && body.client_name?.trim()) {
        const created = await tx.client.create({
          data: { name: body.client_name.trim(), business_id: session.businessId },
          select: { id: true },
        })
        clientId = created.id
      }

      // Fetch variants for items that specify one
      const variantIds = body.items
        .map(i => i.variant_id)
        .filter((v): v is number => v !== undefined)
      const variants = variantIds.length > 0
        ? await tx.productVariant.findMany({
            where: { id: { in: variantIds }, is_active: true },
            select: { id: true, product_id: true, price_usd: true, stock: true },
          })
        : []
      const variantMap = new Map(variants.map(v => [v.id, v]))

      // Validate quantities
      for (const item of body.items) {
        const product = productMap.get(item.product_id)!
        if (product.unit_type === 'unit') {
          if (!Number.isInteger(item.quantity) || item.quantity < 1) {
            throw new Error(`Cantidad inválida para "${product.name}": debe ser entero positivo`)
          }
        } else {
          const step = product.unit_step ?? 0.001
          if (item.quantity < step) {
            throw new Error(`Cantidad inválida para "${product.name}": mínimo ${step}`)
          }
        }
      }

      const saleItems = body.items.map(item => {
        const product = productMap.get(item.product_id)!
        const variant = item.variant_id != null ? variantMap.get(item.variant_id) : undefined

        // Validate variant belongs to this product
        if (variant && variant.product_id !== product.id) {
          throw new Error(`Variante no corresponde al producto "${product.name}"`)
        }

        // SEC-01: price always from DB — variant price_usd takes priority over product price
        const priceUsd = variant?.price_usd != null
          ? Number(variant.price_usd)
          : Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0)
        if (priceUsd <= 0) throw new Error(`Precio no configurado para "${product.name}"`)

        const subtotal_usd =
          item.quantity * priceUsd - item.discount_usd
        const subtotal_bs = subtotal_usd * rate

        const recipe_snapshot =
          product.product_type !== 'simple' && product.components.length > 0
            ? JSON.stringify(
                product.components.map(c => ({
                  component_id:   c.component_id,
                  component_name: c.component.name,
                  quantity:       c.quantity,
                  unit_label:     c.unit_label,
                }))
              )
            : null

        return {
          product_id:         item.product_id,
          product_name:       product.name,
          sale_mode:          item.sale_mode,
          unit_label:         product.base_unit_label,
          quantity:           item.quantity,
          price_per_unit_usd: priceUsd,
          subtotal_usd:       Math.round(subtotal_usd * 10000) / 10000,
          subtotal_bs:        Math.round(subtotal_bs * 100) / 100,
          rate_used:          rate,
          discount_usd:       item.discount_usd,
          recipe_snapshot,
          variant_id:         item.variant_id ?? null,
        }
      })

      const total_usd =
        Math.round(saleItems.reduce((acc, i) => acc + i.subtotal_usd, 0) * 100) / 100
      const total_bs =
        Math.round(saleItems.reduce((acc, i) => acc + i.subtotal_bs, 0) * 100) / 100

      let montoRecibidoUsd: number | null = null
      let vueltoUsd: number | null = null

      if (body.status === 'paid' && body.payments) {
        const payTotalBs  = body.payments.reduce((acc, p) => acc + p.amount_bs,  0)
        const payTotalUsd = body.payments.reduce((acc, p) => acc + p.amount_usd, 0)
        if (payTotalBs < total_bs - 0.01) {
          throw new Error(
            `Pago insuficiente. Total: ${total_bs.toFixed(2)} Bs. Recibido: ${payTotalBs.toFixed(2)} Bs`
          )
        }
        montoRecibidoUsd = Math.round(payTotalUsd * 100) / 100
        vueltoUsd        = Math.max(0, Math.round((payTotalUsd - total_usd) * 100) / 100)
      }

      const ticket_number = await generateTicketNumber(session.businessId, tx)

      const newSale = await tx.sale.create({
        data: {
          business_id:        session.businessId,
          cashier_id:         session.userId,
          ticket_number,
          status:             body.status,
          origin:             body.origin,
          total_usd,
          total_bs,
          rate_used:          rate,
          client_id:          clientId,
          client_name:        body.client_name,
          notes:              body.notes,
          monto_recibido_usd: montoRecibidoUsd,
          vuelto_usd:         vueltoUsd,
          due_date:           body.due_date ? new Date(body.due_date) : null,
          credit_days:        body.credit_days ?? null,
          credit_notes:       body.credit_notes ?? null,
          sold_at: body.status === 'paid' ? new Date() : null,
          items: { create: saleItems },
          ...(body.status === 'paid' && body.payments
            ? {
                payments: {
                  create: body.payments.map(p => ({
                    payment_method_id: p.payment_method_id,
                    amount_bs: p.amount_bs,
                    amount_usd: p.amount_usd,
                    reference: p.reference,
                    rate_used: rate,
                  })),
                },
              }
            : {}),
        },
        include: {
          items: true,
          payments: {
            include: {
              payment_method: { select: { id: true, name: true, type: true } },
            },
          },
          client: { select: { id: true, name: true } },
        },
      })

      // FIX 7: collect all deducted product IDs (simple + combo components) for stock alerts
      const componentAlertIds: number[] = []

      if (body.status === 'paid') {
        const inventoryDeductions: {
          business_id: number
          product_id:  number
          quantity:    number
          waste:       number
          notes:       string
          created_by:  number
        }[] = []

        for (const item of body.items) {
          const product = productMap.get(item.product_id)!
          if (product.product_type === 'simple') {
            if (item.variant_id != null) {
              // Variant stock tracked on ProductVariant row
              await tx.productVariant.update({
                where: { id: item.variant_id },
                data:  { stock: { decrement: item.quantity } },
              })
            } else {
              inventoryDeductions.push({
                business_id: session.businessId,
                product_id:  item.product_id,
                quantity:    -item.quantity,
                waste:       0,
                notes:       `VENTA #${ticket_number}`,
                created_by:  session.userId,
              })
            }
          } else {
            // combo or fabricable: deduct each component's stock
            for (const comp of product.components) {
              inventoryDeductions.push({
                business_id: session.businessId,
                product_id:  comp.component_id,
                quantity:    -(item.quantity * comp.quantity),
                waste:       0,
                notes:       `VENTA #${ticket_number} (componente de ${product.name})`,
                created_by:  session.userId,
              })
              componentAlertIds.push(comp.component_id)
            }
          }
        }

        if (inventoryDeductions.length > 0) {
          await tx.inventoryEntry.createMany({ data: inventoryDeductions })
        }

        await tx.activityLog.create({
          data: {
            business_id: session.businessId,
            user_id: session.userId,
            action: 'sale_paid',
            model_type: 'Sale',
            model_id: newSale.id,
            new_values: { ticket_number, total_usd, total_bs, rate },
          },
        })
      }

      return { sale: newSale, componentAlertIds }
    })

    // Fire-and-forget: check stock_alert_threshold for all deducted products
    if (body.status === 'paid') {
      const simpleProductIds = sale.items
        .filter(i => i.variant_id == null)
        .map(i => i.product_id)
      const allAlertIds = Array.from(new Set([...simpleProductIds, ...componentAlertIds]))
      if (allAlertIds.length > 0) {
        void checkStockAlerts(session.businessId, allAlertIds, sale.ticket_number).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, sale }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    if (err instanceof Error) {
      const knownErrors = ['Pago insuficiente', 'productos no encontrados', 'Cantidad inválida', 'Precio no configurado', 'Variante no corresponde']
      if (knownErrors.some(e => err.message.includes(e))) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
    }
    console.error('sales POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
