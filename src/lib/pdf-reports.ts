// Professional PDF report generator for ActivoPOS
// Colors are fixed (not theme-dependent) per design spec

const PDF_COLORS = {
  brand:   [37,  99,  235] as const,
  text:    [15,  23,  42]  as const,
  muted:   [100, 116, 139] as const,
  border:  [226, 232, 240] as const,
  success: [16,  185, 129] as const,
  surface: [248, 250, 252] as const,
  white:   [255, 255, 255] as const,
}

// Column widths in mm for the products table (A4 portrait: 210mm - 30mm margins = 180mm usable)
const COL_WIDTHS = {
  producto:  82,
  cant:      18,
  precio:    26,
  total:     26,
} as const

interface PaymentMethodData {
  id:       number
  name:     string
  totalUsd: number
}

interface TopProductData {
  productId: number
  name:      string
  quantity:  number
  totalUsd:  number
  totalBs:   number
}

export interface DailyReportData {
  date:            string
  businessName:    string
  rate:            number
  salesCount:      number
  totalUsd:        number
  totalBs:         number
  byPaymentMethod: PaymentMethodData[]
  topProducts:     TopProductData[]
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function drawLine(doc: import('jspdf').jsPDF, x1: number, y: number, x2: number): void {
  const [r, g, b] = PDF_COLORS.border
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(0.3)
  doc.line(x1, y, x2, y)
}

function sectionLabel(doc: import('jspdf').jsPDF, text: string, x: number, y: number): void {
  const [r, g, b] = PDF_COLORS.muted
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text(text.toUpperCase(), x, y)
}

export async function generateDailyReportPdf(data: DailyReportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw   = doc.internal.pageSize.getWidth()   // 210
  const m    = 15  // margin
  const cw   = pw - m * 2  // content width: 180mm
  let y      = m

  /* ─── HEADER ─────────────────────────────────────────── */
  const [br, bg, bb] = PDF_COLORS.brand
  doc.setFillColor(br, bg, bb)
  doc.rect(0, 0, pw, 28, 'F')

  doc.setTextColor(...PDF_COLORS.white)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(data.businessName, m, 12)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Reporte de Ventas — ${formatDateEs(data.date)}`, m, 19)

  doc.setFontSize(7)
  doc.text('activopos.com', m, 24)

  doc.setFontSize(8.5)
  doc.text(data.date, pw - m, 12, { align: 'right' })

  y = 38

  /* ─── KPI SUMMARY ────────────────────────────────────── */
  sectionLabel(doc, 'Resumen del día', m, y)
  y += 4

  const kpiW  = (cw - 6) / 3
  const kpiH  = 18
  const kpis  = [
    { label: 'Total USD',        value: fmtUsd(data.totalUsd) },
    { label: 'Tickets cobrados', value: String(data.salesCount) },
    { label: 'Ticket promedio',  value: data.salesCount > 0 ? fmtUsd(data.totalUsd / data.salesCount) : '$0.00' },
  ]

  kpis.forEach((kpi, i) => {
    const kx = m + i * (kpiW + 3)
    const [sr, sg, sb] = PDF_COLORS.surface
    doc.setFillColor(sr, sg, sb)
    doc.roundedRect(kx, y, kpiW, kpiH, 2, 2, 'F')

    const [mr, mg, mb] = PDF_COLORS.muted
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(mr, mg, mb)
    doc.text(kpi.label, kx + 4, y + 6)

    const [tr, tg, tb] = PDF_COLORS.text
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(tr, tg, tb)
    doc.text(kpi.value, kx + 4, y + 14)
  })

  y += kpiH + 4

  // Bs total below KPIs
  const [mr2, mg2, mb2] = PDF_COLORS.muted
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(mr2, mg2, mb2)
  doc.text(
    `Total Bs.: ${data.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}  ·  Tasa BCV: Bs. ${data.rate.toFixed(2)}`,
    m, y
  )
  y += 6

  drawLine(doc, m, y, pw - m)
  y += 6

  /* ─── MÉTODOS DE PAGO ────────────────────────────────── */
  if (data.byPaymentMethod.length > 0) {
    sectionLabel(doc, 'Métodos de pago', m, y)
    y += 5

    const maxAmt = Math.max(...data.byPaymentMethod.map(p => p.totalUsd))
    const BAR_MAX_W = 60  // mm max bar width
    const BAR_H     = 4
    const pct = (n: number) => (maxAmt > 0 ? n / maxAmt : 0)

    for (const pm of data.byPaymentMethod) {
      const [mr3, mg3, mb3] = PDF_COLORS.muted
      const [tr3, tg3, tb3] = PDF_COLORS.text
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')

      doc.setTextColor(tr3, tg3, tb3)
      doc.text(pm.name, m, y + 3.5)

      const totalAll = data.byPaymentMethod.reduce((s, p) => s + p.totalUsd, 0)
      const pctText  = totalAll > 0 ? `${((pm.totalUsd / totalAll) * 100).toFixed(1)}%` : '0%'

      doc.setTextColor(mr3, mg3, mb3)
      doc.text(fmtUsd(pm.totalUsd), m + 52, y + 3.5)
      doc.text(pctText, m + 80, y + 3.5, { align: 'right' })

      // Bar
      const barX = m + 84
      const [bsr, bsg, bsb] = PDF_COLORS.surface
      doc.setFillColor(bsr, bsg, bsb)
      doc.roundedRect(barX, y, BAR_MAX_W, BAR_H, 1, 1, 'F')

      const barW = BAR_MAX_W * pct(pm.totalUsd)
      if (barW > 0) {
        const [pbr, pbg, pbb] = PDF_COLORS.brand
        doc.setFillColor(pbr, pbg, pbb)
        doc.roundedRect(barX, y, barW, BAR_H, 1, 1, 'F')
      }

      y += BAR_H + 5
    }
    y += 3
    drawLine(doc, m, y, pw - m)
    y += 6
  }

  /* ─── TOP PRODUCTOS ──────────────────────────────────── */
  if (data.topProducts.length > 0) {
    sectionLabel(doc, 'Top productos del día', m, y)
    y += 5

    // Table header
    const [bfr, bfg, bfb] = PDF_COLORS.text
    doc.setFillColor(bfr, bfg, bfb)
    doc.rect(m, y, cw, 6.5, 'F')

    doc.setTextColor(...PDF_COLORS.white)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')

    const cx = {
      producto: m + 2,
      cant:     m + COL_WIDTHS.producto + 2,
      precio:   m + COL_WIDTHS.producto + COL_WIDTHS.cant + 2,
      total:    m + COL_WIDTHS.producto + COL_WIDTHS.cant + COL_WIDTHS.precio + 2,
    }

    doc.text('PRODUCTO',  cx.producto, y + 4.5)
    doc.text('CANT',      cx.cant,     y + 4.5)
    doc.text('P. UNIT',   cx.precio,   y + 4.5)
    doc.text('TOTAL',     cx.total,    y + 4.5)
    y += 6.5

    doc.setTextColor(...PDF_COLORS.text)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    data.topProducts.forEach((p, i) => {
      if (i % 2 === 0) {
        const [sfr, sfg, sfb] = PDF_COLORS.surface
        doc.setFillColor(sfr, sfg, sfb)
        doc.rect(m, y, cw, 6.5, 'F')
      }

      const unitUsd = p.quantity > 0 ? p.totalUsd / p.quantity : 0
      const nameClip = p.name.length > 45 ? p.name.slice(0, 44) + '…' : p.name

      doc.setTextColor(...PDF_COLORS.text)
      doc.text(nameClip,                                cx.producto, y + 4.5)

      const [mr4, mg4, mb4] = PDF_COLORS.muted
      doc.setTextColor(mr4, mg4, mb4)
      doc.text(String(p.quantity),   cx.cant,   y + 4.5)
      doc.text(fmtUsd(unitUsd),      cx.precio, y + 4.5)

      doc.setTextColor(...PDF_COLORS.text)
      doc.setFont('helvetica', 'bold')
      doc.text(fmtUsd(p.totalUsd),   cx.total,  y + 4.5)
      doc.setFont('helvetica', 'normal')

      y += 6.5
    })
    y += 5
  }

  /* ─── FOOTER ─────────────────────────────────────────── */
  const pageH = doc.internal.pageSize.getHeight()
  const [mr5, mg5, mb5] = PDF_COLORS.muted
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(mr5, mg5, mb5)
  doc.text(
    `Generado: ${new Date().toLocaleString('es-VE')} · ActivoPOS`,
    pw / 2, pageH - 8, { align: 'center' }
  )

  doc.save(`reporte_diario_${data.date}.pdf`)
}

function formatDateEs(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
}
