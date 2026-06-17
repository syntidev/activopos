import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { catalogLimiter, getClientIp } from '@/lib/rate-limit'

const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)

const ItemSchema = z.object({
  product_id: z.number().int().positive(),
  name:       z.string().min(1).max(120).trim(),
  qty:        z.number().positive().max(9999),
  price_usd:  z.number().min(0).max(999999),
})

const BodySchema = z.object({
  items:              z.array(ItemSchema).min(1).max(50),
  customer_name:      z.string().min(1).max(120).trim(),
  customer_phone:     z.string().min(7).max(20).trim(),
  customer_reference: z.string().min(1).max(200).trim(),
  payment_method:     z.string().min(1).max(60).trim(),
  notes:              z.string().max(500).trim().optional(),
})

type Body = z.infer<typeof BodySchema>

// TxClient type for use inside $transaction
type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

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
  order_number: string,
  body: Body,
  totalUsd: number,
  totalBs: number,
): string {
  const itemLines = body.items
    .map(i => `- ${i.name} x${i.qty} — $${i.price_usd.toFixed(2)}`)
    .join('\n')

  return [
    `🛍️ *Nuevo pedido #${order_number}*`,
    `Cliente: ${body.customer_name}`,
    `WhatsApp: ${body.customer_phone}`,
    `Sector: ${body.customer_reference}`,
    '',
    `*Productos:*`,
    itemLines,
    '',
    `💰 *Total: $${totalUsd.toFixed(2)}*`,
    `   Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} al cambio BCV`,
    '',
    `Método de pago: ${body.payment_method}`,
  ].join('\n')
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  // Rate limiting
  try {
    await catalogLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta más tarde.' },
      { status: 429 },
    )
  }

  // Validate slug
  const parsedSlug = slugSchema.safeParse(params.slug)
  if (!parsedSlug.success) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
  }

  // Parse + validate body
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

  // Find business
  const business = await prisma.business.findFirst({
    where: { catalog_slug: parsedSlug.data, catalog_active: true, active: true },
    select: { id: true, name: true, phone: true, ticket_prefix: true },
  })

  if (!business) {
    return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })
  }

  // Validate all product_ids belong to this business
  const uniqueProductIds = Array.from(new Set(body.items.map(i => i.product_id)))

  const validCount = await prisma.product.count({
    where: {
      id:              { in: uniqueProductIds },
      business_id:     business.id,
      active:          true,
      show_in_catalog: true,
    },
  })

  if (validCount !== uniqueProductIds.length) {
    return NextResponse.json(
      { error: 'Uno o más productos no están disponibles en este catálogo' },
      { status: 422 },
    )
  }

  // Get BCV rate — never throws
  const rate = await getBcvRate()

  // Create order + items + upsert client in one transaction
  const order = await prisma.$transaction(async (tx) => {
    const order_number = await generateOrderNumber(business.id, business.ticket_prefix, tx)

    const totalUsd = Math.round(
      body.items.reduce((s, i) => s + i.qty * i.price_usd, 0) * 100,
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

    // Combine payment method + optional notes
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
        items: {
          create: body.items.map(item => ({
            product_id:         item.product_id,
            product_name:       item.name,
            quantity:           item.qty,
            price_per_unit_usd: item.price_usd,
            subtotal_usd:       Math.round(item.qty * item.price_usd * 100) / 100,
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

  // Build WhatsApp URL with packed message
  const bizPhone = business.phone?.replace(/\D/g, '') ?? ''
  const waMessage = buildWaMessage(
    order.order_number,
    body,
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
