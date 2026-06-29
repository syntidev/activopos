import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

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
        business: { select: { name: true, phone: true, address: true } },
      },
    })
    if (!quotation) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    const { jsPDF } = await import('jspdf')
    const doc  = new jsPDF({ unit: 'mm', format: 'a4' })
    const r2   = (x: number) => Math.round(x * 100) / 100
    const rate = Number(quotation.rate_used) || 1

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('COTIZACIÓN', 105, 20, { align: 'center' })
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(quotation.business.name, 105, 28, { align: 'center' })
    if (quotation.business.phone) doc.text(`Tel: ${quotation.business.phone}`, 105, 34, { align: 'center' })

    // Meta
    doc.setFontSize(10)
    doc.text(`N° ${quotation.number}`, 15, 48)
    doc.text(`Fecha: ${quotation.created_at.toISOString().slice(0, 10)}`, 15, 54)
    if (quotation.valid_until) {
      doc.text(`Válida hasta: ${quotation.valid_until.toISOString().slice(0, 10)}`, 15, 60)
    }
    doc.text(`Estado: ${quotation.status.toUpperCase()}`, 140, 48)

    // Client
    if (quotation.client) {
      doc.setFont('helvetica', 'bold')
      doc.text('Cliente:', 15, 70)
      doc.setFont('helvetica', 'normal')
      doc.text(quotation.client.name, 35, 70)
      if (quotation.client.phone) doc.text(`Tel: ${quotation.client.phone}`, 35, 76)
    }

    // Items table
    let y = 90
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
