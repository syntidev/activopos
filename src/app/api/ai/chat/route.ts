import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { aiChatLimiter } from '@/lib/rate-limit'
import { checkPlanLimit } from '@/lib/plan-guard'
import { callBlogLlm, ProviderError } from '@/lib/blog/llm'

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
})

interface LowStockRow {
  name:    string
  net_qty: string | null
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Solo administradores pueden usar el asistente.' }, { status: 403 })

  const planCheck = await checkPlanLimit('access_ai')
  if (!planCheck.allowed) return NextResponse.json({ error: planCheck.reason }, { status: 403 })

  try {
    await aiChatLimiter.consume(`user:${session.userId}`)
  } catch {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Intenta en un minuto.' },
      { status: 429 }
    )
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
      where: { business_id: bid, status: 'credit', origin: 'credit', due_date: { lt: now } },
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
    `Eres el asistente de soporte de ActivoPOS, un sistema POS para negocios ` +
    `venezolanos. Atiendes al negocio "${businessName}".` +
    `\nRespondes en español venezolano con tuteo (tú, no vos). Respuestas cortas, ` +
    `máximo 3 oraciones. Directo al grano, sin saludos largos.` +
    `\n\nEl sistema tiene estos módulos:` +
    `\nPOS (punto de venta con escáner triple, multi-ticket, pago mixto, crédito, ` +
    `variantes, peso), Inventario (entradas, consumo interno, historial), ` +
    `Productos (importación Excel, variantes, imágenes WebP), Catálogo Digital ` +
    `(URL pública, QR, pedidos por WhatsApp, Kanban), Clientes (CxC, precio ` +
    `mayorista), Proveedores y Compras (CxP), Caja (apertura, cierre, cuadre), ` +
    `Finanzas (P&L, punto equilibrio, gastos, CxC, CxP, export Excel), Reportes ` +
    `(día, ventas, inventario, caja, export Excel/PDF), Analytics (tendencias, ` +
    `productos top), Cotizaciones (PDF, convertir a venta), Devoluciones (3 pasos, ` +
    `restaurar stock), Configuración (métodos de pago: Pago Móvil, Zelle, Binance, ` +
    `USDT, Zinli, Efectivo), Usuarios (cajero/admin), Tu Día (resumen narrativo diario).` +
    `\n\nPrecios en USD siempre. Tasa BCV automática en cada venta.` +
    `\nNo reemplaza facturación SENIAT — la complementa.` +
    `\nSi no sabes la respuesta, di: "Para eso te recomiendo contactar soporte por WhatsApp."` +
    `\nSolo respondes sobre ActivoPOS y el negocio — no sobre temas externos.` +
    `\n\nDatos reales del negocio hoy:\n${context}`

  try {
    const text = await callBlogLlm(body.message, { system: systemPrompt })
    return NextResponse.json({ ok: true, response: text.trim() })
  } catch (err) {
    // El cliente cae a las reglas locales ante cualquier no-2xx — incluye
    // NVIDIA_API_KEY ausente (500), que en dev es el caso normal.
    const status = err instanceof ProviderError ? err.status : 502
    console.error('Ayuda IA falló:', status, err)
    return NextResponse.json({ error: 'Error del asistente' }, { status })
  }
}
