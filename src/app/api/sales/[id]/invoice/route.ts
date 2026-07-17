import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { loadLogo } from '@/lib/pdf-utils'

type Context = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const { db } = await getAuthenticatedTenant()

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const sale = await db.sale.findFirst({
      where:   { id }, // business_id inyectado por el tenant layer
      include: {
        client: { select: { name: true, phone: true, email: true } },
        items: {
          select: {
            id: true, product_name: true, quantity: true,
            price_per_unit_usd: true, sale_mode: true, subtotal_usd: true,
          },
          orderBy: { id: 'asc' },
        },
        payments: {
          select: {
            amount_usd: true, amount_bs: true,
            payment_method: { select: { name: true } },
          },
        },
        business: {
          select: {
            name: true, legal_name: true, rif: true, address: true, city: true,
            phone: true, email: true, logo_path: true,
            iva_enabled: true, iva_pct: true, quotation_footer: true,
          },
        },
      },
    })
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })

    const logo = sale.business.logo_path ? await loadLogo(sale.business.logo_path) : null

    const { jsPDF } = await import('jspdf')
    const doc  = new jsPDF({ unit: 'mm', format: 'letter' })
    const r2   = (x: number) => Math.round(x * 100) / 100
    const rate = Number(sale.rate_used) || 1

    if (logo) doc.addImage(logo.dataUrl, 'PNG', 15, 12, logo.width, logo.height)

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('FACTURA DE SERVICIO', 105, 20, { align: 'center' })

    let y = 28
    const checkPageBreak = () => {
      if (y > 260) {
        doc.addPage()
        y = 20
      }
    }
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(sale.business.legal_name || sale.business.name, 105, y, { align: 'center' })

    doc.setFontSize(9)
    if (sale.business.rif) {
      y += 5
      doc.text(`RIF: ${sale.business.rif}`, 105, y, { align: 'center' })
    }
    if (sale.business.address) {
      y += 5
      const addr = sale.business.city ? `${sale.business.address}, ${sale.business.city}` : sale.business.address
      doc.text(addr, 105, y, { align: 'center' })
    }
    if (sale.business.phone) {
      y += 5
      doc.text(`Tel: ${sale.business.phone}`, 105, y, { align: 'center' })
    }
    if (sale.business.email) {
      y += 5
      doc.text(`Correo: ${sale.business.email}`, 105, y, { align: 'center' })
    }

    // Meta
    y += 12
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`N° ${sale.ticket_number}`, 15, y)
    doc.text(`Estado: ${sale.status.toUpperCase()}`, 140, y)
    y += 6
    doc.text(`Fecha: ${sale.sold_at ? sale.sold_at.toISOString().slice(0, 10) : '—'}`, 15, y)

    // Client
    y += 10
    if (sale.client) {
      doc.setFont('helvetica', 'bold')
      doc.text('Cliente:', 15, y)
      doc.setFont('helvetica', 'normal')
      doc.text(sale.client.name, 35, y)
      if (sale.client.phone) {
        y += 6
        doc.text(`Tel: ${sale.client.phone}`, 35, y)
      }
    }

    // Items table
    y += 14
    doc.setFont('helvetica', 'bold')
    doc.text('Descripción', 15, y)
    doc.text('Cant.', 110, y, { align: 'right' })
    doc.text('Precio USD', 145, y, { align: 'right' })
    doc.text('Subtotal USD', 195, y, { align: 'right' })
    doc.line(15, y + 2, 195, y + 2)
    y += 8

    doc.setFont('helvetica', 'normal')
    for (const item of sale.items) {
      const qty   = Number(item.quantity)
      const price = Number(item.price_per_unit_usd)
      const sub   = Number(item.subtotal_usd)
      doc.text(item.product_name.slice(0, 50), 15, y)
      doc.text(qty.toFixed(2), 110, y, { align: 'right' })
      doc.text(`$${price.toFixed(2)}`, 145, y, { align: 'right' })
      doc.text(`$${sub.toFixed(2)}`, 195, y, { align: 'right' })
      y += 7
      if (y > 260) {
        doc.addPage()
        y = 20
      }
    }

    // Totals — total_usd es IVA-inclusivo (mismo cómputo que sales/[id]/ticket/route.ts)
    checkPageBreak()
    doc.line(15, y + 2, 195, y + 2)
    y += 10
    const totalUsd  = Number(sale.total_usd)
    const ivaEnabled = sale.business.iva_enabled
    const ivaPct    = Number(sale.business.iva_pct ?? 0)
    let subtotalUsd: number
    let ivaAmount:   number
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
    const totalBs = r2(totalUsd * rate)

    doc.setFont('helvetica', 'normal')
    doc.text(`Subtotal USD: $${subtotalUsd.toFixed(2)}`, 195, y, { align: 'right' })
    y += 6
    // IVA desconectado -- ver auditoría 2026-07-16, no borrar.
    if (false && ivaEnabled) {
      doc.text(`IVA (${ivaPct}%): $${ivaAmount.toFixed(2)}`, 195, y, { align: 'right' })
      y += 6
    }
    doc.setFont('helvetica', 'bold')
    doc.text(`Total USD: $${totalUsd.toFixed(2)}`, 195, y, { align: 'right' })
    y += 7
    doc.text(`Total Bs.: Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 195, y, { align: 'right' })
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Tasa BCV: Bs. ${rate.toFixed(2)}/USD`, 195, y, { align: 'right' })

    // Métodos de pago
    if (sale.payments.length > 0) {
      y += 12
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Métodos de pago:', 15, y)
      doc.setFont('helvetica', 'normal')
      for (const p of sale.payments) {
        y += 6
        checkPageBreak()
        const usd = Number(p.amount_usd)
        const bs  = Number(p.amount_bs)
        doc.text(
          `${p.payment_method.name}: $${usd.toFixed(2)} / Bs. ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
          15, y,
        )
      }
    }

    // Condiciones del negocio — debajo de todo, alineado a la izquierda
    if (sale.business.quotation_footer) {
      y += 14
      checkPageBreak()
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      const footerLines = doc.splitTextToSize(sale.business.quotation_footer, 180)
      doc.text(footerLines, 15, y)
    }

    const pdfBytes = doc.output('arraybuffer')
    const safeName = sale.business.name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)
    const filename = `factura-${sale.ticket_number}-${safeName}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
