import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { aiChatLimiter } from '@/lib/rate-limit'

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
})

interface AnthropicContent {
  type:  string
  text?: string
}

interface AnthropicResponse {
  content: AnthropicContent[]
}

interface LowStockRow {
  name:    string
  net_qty: string | null
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    await aiChatLimiter.consume(`user:${session.userId}`)
  } catch {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Intenta en un minuto.' },
      { status: 429 }
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Asistente no configurado' }, { status: 503 })
  }

  let body: z.infer<typeof chatSchema>
  try {
    body = chatSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Mensaje inválido', issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }

  const bid  = session.businessId
  const now  = new Date()
  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)

  const [business, todaySales, pendingOrders, overdueCredit, lowStockProducts] = await Promise.all([
    prisma.business.findUnique({
      where:  { id: bid },
      select: { name: true },
    }),
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'paid', sold_at: { gte: todayStart, lt: tomorrowStart } },
      _sum:   { total_usd: true },
      _count: { id: true },
    }),
    prisma.order.count({
      where: { business_id: bid, status: { notIn: ['delivered', 'cancelled'] } },
    }),
    prisma.sale.count({
      where: { business_id: bid, status: 'pending', origin: 'credit', due_date: { lt: now } },
    }),
    prisma.$queryRaw<LowStockRow[]>`
      SELECT p.name, IFNULL(ie.net_qty, 0) AS net_qty
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity) - SUM(waste) AS net_qty
        FROM inventory_entries WHERE business_id = ${bid} GROUP BY product_id
      ) ie ON ie.product_id = p.id
      WHERE p.business_id = ${bid} AND p.active = 1
        AND IFNULL(ie.net_qty, 0) <= p.min_stock AND p.min_stock > 0
      ORDER BY net_qty ASC LIMIT 5`,
  ])

  const totalUsd      = Number(todaySales._sum.total_usd ?? 0)
  const businessName  = business?.name ?? 'tu negocio'
  const lowStockList  = lowStockProducts.length > 0
    ? lowStockProducts.map(p => `${p.name} (${Number(p.net_qty ?? 0)} uds.)`).join(', ')
    : null

  const context = [
    `Ventas hoy: ${todaySales._count.id} ventas por $${totalUsd.toFixed(2)} USD`,
    pendingOrders > 0
      ? `Pedidos activos en cocina/sala: ${pendingOrders}`
      : 'Sin pedidos activos',
    overdueCredit > 0
      ? `Cobros vencidos (CxC): ${overdueCredit} ventas a crédito sin cobrar`
      : 'Sin cobros vencidos',
    lowStockList
      ? `Productos con stock bajo: ${lowStockList}`
      : 'Sin productos con stock bajo',
  ].join('\n')

  const systemPrompt =
    `Eres el asistente de ActivoPOS para el negocio "${businessName}".` +
    `\nTienes acceso a los datos reales del negocio de hoy.` +
    `\nResponde en español venezolano, de forma concisa y útil.` +
    `\nSolo respondes sobre el negocio — no sobre temas externos.` +
    `\nDatos del negocio hoy:\n${context}`

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: body.message }],
    }),
  })

  if (!anthropicRes.ok) {
    console.error('Anthropic API error:', anthropicRes.status)
    return NextResponse.json({ error: 'Error del asistente' }, { status: 502 })
  }

  const data = await anthropicRes.json() as AnthropicResponse
  const text = data.content.find(c => c.type === 'text')?.text ?? ''

  return NextResponse.json({ ok: true, response: text })
}
