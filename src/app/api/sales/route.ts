import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { generateTicketNumber } from '@/lib/ticket'

const saleItemSchema = z.object({
  product_id:   z.number().int().positive(),
  quantity:     z.number().positive(),
  sale_mode:    z.enum(['unit', 'weight', 'service', 'length', 'volume', 'package']),
  discount_usd: z.number().min(0).default(0),
  // price_per_unit_usd NOT accepted from client — SEC-01: always fetched from DB
})

const paymentSchema = z.object({
  payment_method_id: z.number().int().positive(),
  amount_bs: z.number().positive(),
  amount_usd: z.number().positive(),
  reference: z.string().optional(),
})

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  client_id: z.number().int().positive().optional(),
  client_name: z.string().max(120).optional(),
  status: z.enum(['quote', 'pending', 'paid']),
  origin: z.enum(['pos', 'quote', 'credit']),
  notes: z.string().optional(),
  payments: z.array(paymentSchema).optional(),
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

  const sales = await prisma.sale.findMany({
    where: {
      business_id: session.businessId,
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

    const rate = await getBcvRate()

    const sale = await prisma.$transaction(async (tx) => {
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
        // SEC-01: price always from DB — never from client body
        const priceUsd = Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0)
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
        }
      })

      const total_usd =
        Math.round(saleItems.reduce((acc, i) => acc + i.subtotal_usd, 0) * 100) / 100
      const total_bs =
        Math.round(saleItems.reduce((acc, i) => acc + i.subtotal_bs, 0) * 100) / 100

      if (body.status === 'paid' && body.payments) {
        const payTotal = body.payments.reduce((acc, p) => acc + p.amount_bs, 0)
        if (payTotal < total_bs - 0.01) {
          throw new Error(
            `Pago insuficiente. Total: ${total_bs.toFixed(2)} Bs. Recibido: ${payTotal.toFixed(2)} Bs`
          )
        }
      }

      const ticket_number = await generateTicketNumber(session.businessId, tx)

      const newSale = await tx.sale.create({
        data: {
          business_id: session.businessId,
          cashier_id: session.userId,
          ticket_number,
          status: body.status,
          origin: body.origin,
          total_usd,
          total_bs,
          rate_used: rate,
          client_id: body.client_id,
          client_name: body.client_name,
          notes: body.notes,
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
            inventoryDeductions.push({
              business_id: session.businessId,
              product_id:  item.product_id,
              quantity:    -item.quantity,
              waste:       0,
              notes:       `VENTA #${ticket_number}`,
              created_by:  session.userId,
            })
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
            }
          }
        }

        await tx.inventoryEntry.createMany({ data: inventoryDeductions })

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

      return newSale
    })

    return NextResponse.json({ ok: true, sale }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    if (err instanceof Error) {
      const knownErrors = ['Pago insuficiente', 'productos no encontrados', 'Cantidad inválida', 'Precio no configurado']
      if (knownErrors.some(e => err.message.includes(e))) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
    }
    console.error('sales POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
