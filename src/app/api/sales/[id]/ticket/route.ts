import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

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

/* Medidas por formato. El ancho en px es el que usa la vista previa en
   pantalla; @page manda a la hora de imprimir. */
const FORMATS = {
  '58mm':  { page: '58mm auto', width: '220px', font: '10px', pad: '2px'  },
  '80mm':  { page: '80mm auto', width: '300px', font: '11px', pad: '3px'  },
  'carta': { page: 'letter',    width: '700px', font: '12px', pad: '12px' },
} as const

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return new Response('ID inválido', { status: 400 })

    const bid = session.businessId

    const [sale, business] = await Promise.all([
      db.sale.findFirst({
        where: { id }, // business_id inyectado por el tenant layer
        include: {
          items: {
            select: {
              product_name: true,
              quantity:     true,
              price_per_unit_usd: true,
              subtotal_usd: true,
              subtotal_bs:  true,
              discount_usd: true,
              // Descripción viva del producto, no un snapshot de la venta:
              // SaleItem no la persiste. Un ticket reimpreso muestra la
              // descripción de hoy, no la del día de la venta.
              product: { select: { description: true } },
            },
            orderBy: { id: 'asc' },
          },
          payments: {
            include: { payment_method: { select: { name: true } } },
          },
          cashier: { select: { name: true } },
          // Una venta con cliente elegido del listado guarda client_id pero
          // deja client_name/client_phone en null (solo se llenan cuando el
          // nombre se tipea suelto en el POS). Sin esta relación el ticket
          // no imprimiría cliente en el camino más común.
          client: { select: { name: true, phone: true } },
        },
      }),
      // Business es la raíz del tenant (no tiene business_id) → no se filtra.
      db.business.findUnique({
        where:  { id: bid },
        select: {
          name:          true,
          address:       true,
          phone:         true,
          rif:           true,
          ticket_footer: true,
          catalog_slug:  true,
          catalog_active: true,
          iva_enabled:   true,
          iva_pct:       true,
          ticket_format:              true,
          ticket_show_description:    true,
          ticket_show_bs:             true,
          ticket_show_foreign:        true,
          ticket_foreign_format:      true,
          ticket_show_address:        true,
          ticket_show_phone:          true,
          ticket_show_customer_data:  true,
          ticket_show_rif:            true,
          ticket_show_cashier_name:   true,
          ticket_show_bcv_rate:       true,
          ticket_show_payment_method: true,
        },
      }),
    ])

    if (!sale)     return new Response('Venta no encontrada', { status: 404 })
    if (!business) return new Response('Negocio no encontrado', { status: 404 })

    const fmt = FORMATS[business.ticket_format as keyof typeof FORMATS] ?? FORMATS['58mm']

    const showBs = business.ticket_show_bs
    /* La API impide guardar ambos en false, pero un UPDATE manual contra la DB
       sí podría dejarlos así. Si pasa, cae a divisas antes que imprimir un
       ticket sin un solo monto. */
    const showForeign = business.ticket_show_foreign || !showBs

    const fForeign = (n: number): string =>
      business.ticket_foreign_format === 'ref' ? `REF ${fmt2(n)}` : `$${fmt2(n)}`
    const fBs = (n: number): string => `Bs.${fmt2(n)}`

    const totalUsd  = Number(sale.total_usd)
    const totalBs   = Number(sale.total_bs)
    const rate      = Number(sale.rate_used)
    const ivaEnabled = business.iva_enabled
    const ivaPct    = Number(business.iva_pct ?? 0)

    let subtotalUsd: number
    let ivaAmount: number
    // IVA desconectado -- ver auditoría 2026-07-16, no borrar (riesgo fiscal:
    // esta matemática inversa fabricaba una línea de IVA a partir del total
    // ya cobrado, que nunca se persistió realmente como impuesto separado).
    if (false && ivaEnabled && ivaPct > 0) {
      subtotalUsd = totalUsd / (1 + ivaPct / 100)
      ivaAmount   = totalUsd - subtotalUsd
    } else {
      subtotalUsd = totalUsd
      ivaAmount   = 0
    }

    // IVA desconectado -- ver auditoría 2026-07-16, no borrar. Esta línea
    // se imprimía SIEMPRE ("IVA (0%): $0.00"), sin condicional, en todo
    // ticket reimpreso -- rastro visual de IVA vigente aunque iva_enabled
    // fuera false. Hallazgo adicional durante esta auditoría, mismo criterio.
    const ivaLineHtml = false
      ? `<div class="row"><span>IVA (${ivaEnabled ? ivaPct : 0}%):</span><span>$${fmt2(ivaAmount)}</span></div>`
      : ''

    const itemsHtml = sale.items.map(item => {
      const qty  = Number(item.quantity)
      const name = esc(item.product_name).slice(0, 20)
      const disc = Number(item.discount_usd)
      // El monto por línea sigue al mismo interruptor que los totales: si el
      // negocio apagó divisas, el ítem se imprime en Bs, no desaparece.
      const amount = showForeign
        ? fForeign(Number(item.subtotal_usd))
        : fBs(Number(item.subtotal_bs))
      const descLine = business.ticket_show_description && item.product.description
        ? `<div style="font-size:8px;color:#555;margin-left:6px">${esc(item.product.description).slice(0, 60)}</div>`
        : ''
      const discLine = disc > 0
        ? `<div class="row" style="font-size:9px;color:#555"><span>  Desc.:</span><span>-${fForeign(disc)}</span></div>`
        : ''
      return `<div class="row"><span>${qty}&times; ${name}</span><span>${amount}</span></div>${descLine}${discLine}`
    }).join('')

    const paymentsHtml = business.ticket_show_payment_method
      ? sale.payments.map(p =>
          `<div class="row"><span>Método: ${esc(p.payment_method.name)}</span><span>${fForeign(Number(p.amount_usd))}</span></div>`
        ).join('')
      : ''

    const clientName  = sale.client_name  ?? sale.client?.name  ?? null
    const clientPhone = sale.client_phone ?? sale.client?.phone ?? null

    const customerHtml = business.ticket_show_customer_data && (clientName || clientPhone)
      ? [
          clientName  ? `<div>Cliente: ${esc(clientName)}</div>`       : '',
          clientPhone ? `<div>Tel. cliente: ${esc(clientPhone)}</div>` : '',
          '<div class="hr"></div>',
        ].join('')
      : ''

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
@page { size: ${fmt.page}; margin: 2mm 1mm; }
*     { box-sizing: border-box; margin: 0; padding: 0; }
body  {
  font-family: 'Courier New', Courier, monospace;
  font-size: ${fmt.font};
  width: ${fmt.width};
  color: #000;
  background: #fff;
  padding: ${fmt.pad};
  margin: 0 auto;
}
.c   { text-align: center; }
.b   { font-weight: bold; }
.biz { font-size: 12px; font-weight: bold; margin-bottom: 2px; }
.hr  { border: none; border-top: 1px dashed #000; margin: 3px 0; }
.row { display: flex; justify-content: space-between; margin: 1px 0; }
@media print {
  @page { size: ${fmt.page}; margin: 0; }
}
</style>
<script>window.onload = () => window.print()</script>
</head>
<body>
<div class="c" style="margin-bottom:2px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="20" height="20" style="vertical-align:middle"><defs><clipPath id="lc"><polygon points="235,270 600,-600 600,500 0,500"/></clipPath></defs><path d="M200,40 L360,340 L40,340 Z" fill="#0038BD"/><path d="M200,40 L360,340 L40,340 Z" fill="#EF8E01" clip-path="url(#lc)"/></svg></div>
<div class="c biz">${esc(business.name)}</div>
${business.ticket_show_rif     && business.rif     ? `<div class="c">RIF: ${esc(business.rif)}</div>` : ''}
${business.ticket_show_address && business.address ? `<div class="c">${esc(business.address)}</div>` : ''}
${business.ticket_show_phone   && business.phone   ? `<div class="c">Tel: ${esc(business.phone)}</div>` : ''}
<div class="hr"></div>
<div>Ticket: ${esc(sale.ticket_number)}</div>
<div>Fecha:  ${sale.sold_at ? fmtDate(sale.sold_at) : '—'}</div>
${business.ticket_show_cashier_name ? `<div>Cajero: ${esc(sale.cashier.name)}</div>` : ''}
<div class="hr"></div>
${customerHtml}
${itemsHtml}
<div class="hr"></div>
${showForeign ? `<div class="row"><span>SUBTOTAL:</span><span>${fForeign(subtotalUsd)}</span></div>` : ''}
${ivaLineHtml}
${showForeign ? `<div class="row b"><span>TOTAL:</span><span>${fForeign(totalUsd)}</span></div>` : ''}
${showBs      ? `<div class="row b"><span>TOTAL Bs:</span><span>${fBs(totalBs)}</span></div>` : ''}
${business.ticket_show_bcv_rate ? `<div class="row"><span>Tasa BCV:</span><span>${rate.toFixed(4)}</span></div>` : ''}
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
  } catch (e) {
    if (e instanceof TenantError) return new Response(e.message, { status: e.status })
    throw e
  }
}
