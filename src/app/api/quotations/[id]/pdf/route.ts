import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { loadLogo } from '@/lib/pdf-utils'

type Context = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const { db } = await getAuthenticatedTenant()

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const quotation = await db.quotation.findFirst({
      where:   { id }, // business_id inyectado por el tenant layer
      include: {
        client:   { select: { name: true, phone: true, email: true } },
        items:    true,
        business: {
          select: {
            name: true, phone: true, address: true,
            rif: true, email: true, quotation_footer: true, logo_path: true,
          },
        },
      },
    })
    if (!quotation) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    const logo = quotation.business.logo_path ? await loadLogo(quotation.business.logo_path) : null

    const { jsPDF } = await import('jspdf')
    const doc  = new jsPDF({ unit: 'mm', format: 'letter' })
    const r2   = (x: number) => Math.round(x * 100) / 100
    const rate = Number(quotation.rate_used) || 1

    if (logo) doc.addImage(logo.dataUrl, 'PNG', 15, 12, logo.width, logo.height)

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('COTIZACIÓN', 105, 20, { align: 'center' })

    let y = 28
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(quotation.business.name, 105, y, { align: 'center' })

    doc.setFontSize(9)
    if (quotation.business.rif) {
      y += 5
      doc.text(`RIF: ${quotation.business.rif}`, 105, y, { align: 'center' })
    }
    if (quotation.business.address) {
      y += 5
      doc.text(quotation.business.address, 105, y, { align: 'center' })
    }
    if (quotation.business.phone) {
      y += 5
      doc.text(`Tel: ${quotation.business.phone}`, 105, y, { align: 'center' })
    }
    if (quotation.business.email) {
      y += 5
      doc.text(`Correo: ${quotation.business.email}`, 105, y, { align: 'center' })
    }

    // Meta
    y += 12
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`N° ${quotation.number}`, 15, y)
    doc.text(`Estado: ${quotation.status.toUpperCase()}`, 140, y)
    y += 6
    doc.text(`Fecha: ${quotation.created_at.toISOString().slice(0, 10)}`, 15, y)
    if (quotation.valid_until) {
      y += 6
      doc.text(`Válida hasta: ${quotation.valid_until.toISOString().slice(0, 10)}`, 15, y)
    }

    // Client
    y += 10
    if (quotation.client) {
      doc.setFont('helvetica', 'bold')
      doc.text('Cliente:', 15, y)
      doc.setFont('helvetica', 'normal')
      doc.text(quotation.client.name, 35, y)
      if (quotation.client.phone) {
        y += 6
        doc.text(`Tel: ${quotation.client.phone}`, 35, y)
      }
    }

    // Items table
    y += 14
    doc.setFont('helvetica', 'bold')
    doc.text('Descripción', 15, y)
    doc.text('Cant.', 110, y, { align: 'right' })
    doc.text('Precio USD', 145, y, { align: 'right' })
    doc.text('Total USD', 195, y, { align: 'right' })
    doc.line(15, y + 2, 195, y + 2)
    y += 8

    doc.setFont('helvetica', 'normal')
    for (const item of quotation.items) {
      const qty   = Number(item.qty)
      const price = Number(item.price_usd)
      const total = Number(item.total_usd)
      doc.text(item.name.slice(0, 50), 15, y)
      doc.text(qty.toFixed(2), 110, y, { align: 'right' })
      doc.text(`$${price.toFixed(2)}`, 145, y, { align: 'right' })
      doc.text(`$${total.toFixed(2)}`, 195, y, { align: 'right' })
      y += 7
      if (y > 260) {
        doc.addPage()
        y = 20
      }
    }

    // Totals
    doc.line(15, y + 2, 195, y + 2)
    y += 10
    const totalUsd = Number(quotation.total_usd)
    const totalBs  = r2(totalUsd * rate)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total USD: $${totalUsd.toFixed(2)}`, 195, y, { align: 'right' })
    y += 7
    doc.text(`Total Bs.: Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 195, y, { align: 'right' })
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Tasa BCV: Bs. ${rate.toFixed(2)}/USD`, 195, y, { align: 'right' })

    // Notes
    if (quotation.notes) {
      y += 14
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Notas:', 15, y)
      doc.setFont('helvetica', 'normal')
      doc.text(quotation.notes.slice(0, 200), 15, y + 6)
    }

    // Condiciones del negocio — debajo de los totales, alineado a la izquierda
    if (quotation.business.quotation_footer) {
      y += 14
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      const footerLines = doc.splitTextToSize(quotation.business.quotation_footer, 180)
      doc.text(footerLines, 15, y)
    }

    const pdfBytes  = doc.output('arraybuffer')
    const safeName  = quotation.business.name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)
    const filename  = `cotizacion-${quotation.number}-${safeName}.pdf`

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
