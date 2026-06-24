import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt2(n: number): string {
  return n.toFixed(2)
}

function fmtDate(d: Date): string {
  return d.toLocaleString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return new Response('No autorizado', { status: 401 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return new Response('ID inválido', { status: 400 })

  const bid = session.businessId

  const [sale, business] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, business_id: bid },
      include: {
        items: {
          select: {
            product_name: true,
            quantity:     true,
            price_per_unit_usd: true,
            subtotal_usd: true,
            discount_usd: true,
          },
          orderBy: { id: 'asc' },
        },
        payments: {
          include: { payment_method: { select: { name: true } } },
        },
        cashier: { select: { name: true } },
      },
    }),
    prisma.business.findUnique({
      where:  { id: bid },
      select: {
        name:          true,
        address:       true,
        phone:         true,
        ticket_footer: true,
        catalog_slug:  true,
        catalog_active: true,
        iva_enabled:   true,
        iva_pct:       true,
      },
    }),
  ])

  if (!sale)     return new Response('Venta no encontrada', { status: 404 })
  if (!business) return new Response('Negocio no encontrado', { status: 404 })

  const totalUsd  = Number(sale.total_usd)
  const totalBs   = Number(sale.total_bs)
  const rate      = Number(sale.rate_used)
  const ivaEnabled = business.iva_enabled
  const ivaPct    = Number(business.iva_pct ?? 0)

  let subtotalUsd: number
  let ivaAmount: number
  if (ivaEnabled && ivaPct > 0) {
    subtotalUsd = totalUsd / (1 + ivaPct / 100)
    ivaAmount   = totalUsd - subtotalUsd
  } else {
    subtotalUsd = totalUsd
    ivaAmount   = 0
  }

  const itemsHtml = sale.items.map(item => {
    const qty  = Number(item.quantity)
    const name = esc(item.product_name).slice(0, 20)
    const sub  = fmt2(Number(item.subtotal_usd))
    const disc = Number(item.discount_usd)
    const discLine = disc > 0
      ? `<div class="row" style="font-size:9px;color:#555"><span>  Desc.:</span><span>-$${fmt2(disc)}</span></div>`
      : ''
    return `<div class="row"><span>${qty}&times; ${name}</span><span>$${sub}</span></div>${discLine}`
  }).join('')

  const paymentsHtml = sale.payments.map(p =>
    `<div class="row"><span>Método: ${esc(p.payment_method.name)}</span><span>$${fmt2(Number(p.amount_usd))}</span></div>`
  ).join('')

  const catalogUrl = business.catalog_active && business.catalog_slug
    ? `<div class="c" style="margin-top:4px;font-size:9px">activopos.com/c/${esc(business.catalog_slug)}</div>`
    : ''

  const footerMsg = business.ticket_footer
    ? `<div class="c" style="margin:4px 0">${esc(business.ticket_footer)}</div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ticket ${esc(sale.ticket_number)}</title>
<style>
@page { size: 58mm auto; margin: 2mm 1mm; }
*     { box-sizing: border-box; margin: 0; padding: 0; }
body  {
  font-family: 'Courier New', Courier, monospace;
  font-size: 10px;
  width: 220px;
  color: #000;
  background: #fff;
  padding: 2px;
}
.c   { text-align: center; }
.b   { font-weight: bold; }
.biz { font-size: 12px; font-weight: bold; margin-bottom: 2px; }
.hr  { border: none; border-top: 1px dashed #000; margin: 3px 0; }
.row { display: flex; justify-content: space-between; margin: 1px 0; }
@media print {
  @page { size: 58mm auto; margin: 0; }
}
</style>
<script>window.onload = () => window.print()</script>
</head>
<body>
<div class="c" style="margin-bottom:2px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="20" height="20" style="vertical-align:middle"><defs><clipPath id="lc"><polygon points="235,270 600,-600 600,500 0,500"/></clipPath></defs><path d="M200,40 L360,340 L40,340 Z" fill="#0038BD"/><path d="M200,40 L360,340 L40,340 Z" fill="#EF8E01" clip-path="url(#lc)"/></svg></div>
<div class="c biz">${esc(business.name)}</div>
${business.address ? `<div class="c">${esc(business.address)}</div>` : ''}
${business.phone   ? `<div class="c">Tel: ${esc(business.phone)}</div>` : ''}
<div class="hr"></div>
<div>Ticket: ${esc(sale.ticket_number)}</div>
<div>Fecha:  ${sale.sold_at ? fmtDate(sale.sold_at) : '—'}</div>
<div>Cajero: ${esc(sale.cashier.name)}</div>
<div class="hr"></div>
${itemsHtml}
<div class="hr"></div>
<div class="row"><span>SUBTOTAL:</span><span>$${fmt2(subtotalUsd)}</span></div>
<div class="row"><span>IVA (${ivaEnabled ? ivaPct : 0}%):</span><span>$${fmt2(ivaAmount)}</span></div>
<div class="row b"><span>TOTAL USD:</span><span>$${fmt2(totalUsd)}</span></div>
<div class="row"><span>TOTAL Bs:</span><span>Bs.${totalBs.toFixed(2)}</span></div>
<div class="row"><span>Tasa BCV:</span><span>${rate.toFixed(4)}</span></div>
<div class="hr"></div>
${paymentsHtml}
<div class="hr"></div>
${footerMsg}
<div class="c">&#161;Gracias por su compra!</div>
<div class="hr"></div>
${catalogUrl}
<div class="c" style="font-size:8px;color:#999;margin-top:4px">Powered by ActivoPOS</div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
