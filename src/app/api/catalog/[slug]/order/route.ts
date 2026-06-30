import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { catalogLimiter, getClientIp } from '@/lib/rate-limit'

const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)

// price_usd and name intentionally omitted — server fetches canonical values from DB
const ItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty:        z.number().positive().max(9999),
})

const BodySchema = z.object({
  items:              z.array(ItemSchema).min(1).max(50),
  customer_name:      z.string().min(1).max(120).trim(),
  customer_phone:     z.string().min(7).max(20).trim(),
  customer_reference: z.string().min(1).max(200).trim(),
  payment_method:     z.string().min(1).max(60).trim(),
  notes:              z.string().max(500).trim().optional(),
})

type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface ResolvedItem {
  product_id:   number
  product_name: string
  qty:          number
  price_usd:    number
  subtotal_usd: number
}

async function generateOrderNumber(businessId: number, prefix: string, tx: TxClient): Promise<string> {
  const last = await tx.order.findFirst({
    where: {
      business_id:  businessId,
      order_number: { startsWith: `${prefix}-` },
    },
    orderBy: { id: 'desc' },
    select: { order_number: true },
  })

  let nextNum = 1
  if (last) {
    const parts = last.order_number.split('-')
    const n = parseInt(parts[parts.length - 1] ?? '0', 10)
    nextNum = !isNaN(n) && n < 99999 ? n + 1 : 1
  }

  return `${prefix}-${nextNum.toString().padStart(5, '0')}`
}

function buildWaMessage(
  order_number:       string,
  customer_name:      string,
  customer_phone:     string,
  customer_reference: string,
  payment_method:     string,
  resolvedItems:      ResolvedItem[],
  totalUsd:           number,
  totalBs:            number,
): string {
  const itemLines = resolvedItems
    .map(i => `- ${i.product_name} x${i.qty} — $${i.price_usd.toFixed(2)}`)
    .join('\n')

  return [
    `🛍️ *Nuevo pedido #${order_number}*`,
    `Cliente: ${customer_name}`,
    `WhatsApp: ${customer_phone}`,
    `Sector: ${customer_reference}`,
    '',
    `*Productos:*`,
    itemLines,
    '',
    `💰 *Total: $${totalUsd.toFixed(2)}*`,
    `   Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} al cambio BCV`,
    '',
    `Método de pago: ${payment_method}`,
  ].join('\n')
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  try {
    await catalogLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta más tarde.' },
      { status: 429 },
    )
  }

  const parsedSlug = slugSchema.safeParse(params.slug)
  if (!parsedSlug.success) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
  }

  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const body = parsed.data

  const business = await prisma.business.findFirst({
    where: { catalog_slug: parsedSlug.data, catalog_active: true, active: true },
    select: { id: true, name: true, phone: true, ticket_prefix: true },
  })

  if (!business) {
    return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })
  }

  // Fetch canonical products from DB — never trust client-supplied prices or names
  const uniqueProductIds = Array.from(new Set(body.items.map(i => i.product_id)))

  const dbProducts = await prisma.product.findMany({
    where: {
      id:              { in: uniqueProductIds },
      business_id:     business.id,
      active:          true,
      show_in_catalog: true,
    },
    select: {
      id:                 true,
      name:               true,
      sale_mode:          true,
      price_per_unit_usd: true,
      price_per_kg_usd:   true,
      category:           { select: { requires_preparation: true } },
    },
  })

  if (dbProducts.length !== uniqueProductIds.length) {
    return NextResponse.json(
      { error: 'Uno o más productos no están disponibles en este catálogo' },
      { status: 422 },
    )
  }

  const productMap = new Map(dbProducts.map(p => [p.id, p]))

  // Build resolved items using server-side prices and names
  const resolvedItems: ResolvedItem[] = body.items.map(item => {
    const p = productMap.get(item.product_id)!
    const priceUsd = p.sale_mode === 'weight'
      ? (p.price_per_kg_usd  ? Number(p.price_per_kg_usd)  : 0)
      : (p.price_per_unit_usd ? Number(p.price_per_unit_usd) : 0)
    return {
      product_id:   item.product_id,
      product_name: p.name,
      qty:          item.qty,
      price_usd:    priceUsd,
      subtotal_usd: Math.round(item.qty * priceUsd * 100) / 100,
    }
  })

  const needsKds = dbProducts.some(p => p.category?.requires_preparation === true)

  const rate = await getBcvRate()

  const order = await prisma.$transaction(async (tx) => {
    const order_number = await generateOrderNumber(business.id, business.ticket_prefix, tx)

    const totalUsd = Math.round(
      resolvedItems.reduce((s, i) => s + i.subtotal_usd, 0) * 100,
    ) / 100
    const totalBs = Math.round(totalUsd * rate * 100) / 100

    // Upsert client by phone
    let clientId: number | null = null
    const existing = await tx.client.findFirst({
      where: { business_id: business.id, phone: body.customer_phone },
      select: { id: true },
    })

    if (existing) {
      clientId = existing.id
    } else {
      const created = await tx.client.create({
        data: {
          business_id: business.id,
          name:        body.customer_name,
          phone:       body.customer_phone,
        },
        select: { id: true },
      })
      clientId = created.id
    }

    const noteLines = [
      `Método de pago: ${body.payment_method}`,
      body.notes ?? '',
    ].filter(Boolean).join('\n')

    return tx.order.create({
      data: {
        business_id:    business.id,
        order_number,
        status:         'received',
        origin:         'catalog',
        client_id:      clientId,
        client_name:    body.customer_name,
        client_phone:   body.customer_phone,
        client_address: body.customer_reference,
        notes:          noteLines,
        total_usd:      totalUsd,
        total_bs:       totalBs,
        rate_used:      rate,
        send_to_kds:    needsKds,
        items: {
          create: resolvedItems.map(item => ({
            product_id:         item.product_id,
            product_name:       item.product_name,
            quantity:           item.qty,
            price_per_unit_usd: item.price_usd,
            subtotal_usd:       item.subtotal_usd,
          })),
        },
      },
      select: {
        id:           true,
        order_number: true,
        total_usd:    true,
        total_bs:     true,
      },
    })
  })

  const bizPhone = business.phone?.replace(/\D/g, '') ?? ''
  const waMessage = buildWaMessage(
    order.order_number,
    body.customer_name,
    body.customer_phone,
    body.customer_reference,
    body.payment_method,
    resolvedItems,
    Number(order.total_usd),
    Number(order.total_bs),
  )

  const whatsapp_url = bizPhone
    ? `https://wa.me/${bizPhone}?text=${encodeURIComponent(waMessage)}`
    : null

  return NextResponse.json(
    {
      ok:            true,
      order_id:      order.id,
      ticket_number: order.order_number,
      whatsapp_url,
    },
    { status: 201 },
  )
}
