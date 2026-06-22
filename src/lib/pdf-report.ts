import { prisma } from '@/lib/prisma'

const TEAL   = '#0EA5A4'
const WHITE  = '#FFFFFF'
const GRAY1  = '#F4F4F4' // zebra even row
const GRAY2  = '#E0E0E0' // divider
const BLACK  = '#111111'
const MUTED  = '#666666'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtBs(n: number): string {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ── Shared header ── */

async function drawHeader(doc: InstanceType<Awaited<ReturnType<typeof loadJsPDF>>>, title: string, subtitle: string, businessName: string) {
  const [r, g, b] = hexToRgb(TEAL)
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, 210, 28, 'F')

  // Business name
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(businessName.toUpperCase(), 15, 11)

  // Badge
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(130, 5, 65, 10, 2, 2, 'F')
  const [tr, tg, tb] = hexToRgb(TEAL)
  doc.setTextColor(tr, tg, tb)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(title.toUpperCase(), 162.5, 11.5, { align: 'center' })

  // Subtitle
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(subtitle, 15, 22)
}

async function loadJsPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

/* ── KPI block ── */
function drawKpiRow(doc: InstanceType<Awaited<ReturnType<typeof loadJsPDF>>>, y: number, kpis: { label: string; value: string; delta?: string }[]) {
  const colW = 60
  const x0   = 15
  kpis.forEach((kpi, i) => {
    const x = x0 + i * colW
    const [r, g, b] = hexToRgb(TEAL)
    doc.setDrawColor(r, g, b)
    doc.setLineWidth(0.5)
    doc.rect(x, y, colW - 4, 18)
    doc.setTextColor(r, g, b)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(kpi.label.toUpperCase(), x + 3, y + 6)
    doc.setTextColor(17, 17, 17)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(kpi.value, x + 3, y + 14)
    if (kpi.delta) {
      const up = kpi.delta.startsWith('+')
      doc.setFontSize(7)
      doc.setTextColor(up ? 16 : 220, up ? 185 : 38, up ? 129 : 38)
      doc.text(kpi.delta, x + colW - 6, y + 14, { align: 'right' })
    }
  })
}

/* ── Table header ── */
function drawTableHeader(doc: InstanceType<Awaited<ReturnType<typeof loadJsPDF>>>, y: number, cols: { label: string; x: number; w: number; align?: 'left' | 'right' | 'center' }[]) {
  const [r, g, b] = hexToRgb(TEAL)
  doc.setFillColor(r, g, b)
  doc.rect(15, y, 180, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  cols.forEach(c => {
    const textX = c.align === 'right' ? c.x + c.w - 2 : c.x + 2
    doc.text(c.label, textX, y + 5.5, { align: c.align ?? 'left' })
  })
  return y + 8
}

/* ── Table row ── */
function drawTableRow(
  doc: InstanceType<Awaited<ReturnType<typeof loadJsPDF>>>,
  y: number,
  cells: { text: string; x: number; w: number; align?: 'left' | 'right' | 'center' }[],
  even: boolean
) {
  if (even) {
    const [r, g, b] = hexToRgb(GRAY1)
    doc.setFillColor(r, g, b)
    doc.rect(15, y, 180, 7, 'F')
  }
  doc.setTextColor(17, 17, 17)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  cells.forEach(c => {
    const textX = c.align === 'right' ? c.x + c.w - 2 : c.x + 2
    doc.text(c.text.slice(0, 35), textX, y + 5, { align: c.align ?? 'left' })
  })
  return y + 7
}

/* ── Bar chart: top products ── */
function drawBarChart(
  doc: InstanceType<Awaited<ReturnType<typeof loadJsPDF>>>,
  y: number,
  items: { name: string; value: number }[]
) {
  const maxVal = Math.max(...items.map(i => i.value), 1)
  const maxBarW = 100
  const [r, g, b] = hexToRgb(TEAL)
  items.slice(0, 8).forEach((item, i) => {
    const barW = Math.round((item.value / maxVal) * maxBarW)
    const rowY = y + i * 10
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 17, 17)
    doc.text(item.name.slice(0, 28), 15, rowY + 4)
    doc.setFillColor(r, g, b)
    doc.rect(85, rowY, barW, 5, 'F')
    doc.setTextColor(102, 102, 102)
    doc.text(fmtUsd(item.value), 190, rowY + 4, { align: 'right' })
  })
  return y + items.slice(0, 8).length * 10 + 4
}

/* ── Footer ── */
function drawFooter(doc: InstanceType<Awaited<ReturnType<typeof loadJsPDF>>>, pageNum: number, totalPages: number) {
  const pageH = doc.internal.pageSize.getHeight()
  const [r, g, b] = hexToRgb(GRAY2)
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(0.3)
  doc.line(15, pageH - 14, 195, pageH - 14)
  doc.setTextColor(102, 102, 102)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text('ActivoPOS — Sistema de Punto de Venta', 15, pageH - 8)
  doc.text(`Página ${pageNum} de ${totalPages}`, 195, pageH - 8, { align: 'right' })
}

/* ── Monthly report ── */
export async function generateMonthlyReport(businessId: number, period: string): Promise<Buffer> {
  // period = "2026-06" format
  const [yearStr, monthStr] = period.split('-')
  const year  = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const from  = new Date(year, month - 1, 1)
  const to    = new Date(year, month, 0, 23, 59, 59)

  const [business, sales, topProducts] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, phone: true, address: true },
    }),
    prisma.sale.findMany({
      where: {
        business_id: businessId,
        status:      'paid',
        sold_at:     { gte: from, lte: to },
      },
      include: { items: { select: { product_name: true, quantity: true, subtotal_usd: true } } },
      orderBy: { sold_at: 'asc' },
    }),
    prisma.saleItem.groupBy({
      by:     ['product_name'],
      where:  {
        sale: {
          business_id: businessId,
          status:      'paid',
          sold_at:     { gte: from, lte: to },
        },
      },
      _sum:    { subtotal_usd: true },
      orderBy: { _sum: { subtotal_usd: 'desc' } },
      take:    8,
    }),
  ])

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const subtitle   = `${monthNames[month - 1]} ${year}`
  const totalUsd   = sales.reduce((s, v) => s + Number(v.total_usd), 0)
  const totalBs    = sales.reduce((s, v) => s + Number(v.total_bs), 0)
  const avgRate    = sales.length > 0 ? (totalBs / totalUsd || 1) : 1
  const countSales = sales.length

  const JsPDF = await loadJsPDF()
  const doc   = new JsPDF({ unit: 'mm', format: 'a4' })

  await drawHeader(doc, 'Reporte Mensual', subtitle, business?.name ?? 'ActivoPOS')

  // KPIs
  let y = 38
  drawKpiRow(doc, y, [
    { label: 'Total USD',  value: fmtUsd(totalUsd) },
    { label: 'Total Bs.',  value: fmtBs(totalBs) },
    { label: 'Ventas',     value: countSales.toString() },
  ])
  y += 26

  // Top products bar chart
  doc.setTextColor(17, 17, 17)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Top Productos por Ingresos', 15, y)
  y += 6
  const topItems = topProducts.map(p => ({
    name:  p.product_name,
    value: Number(p._sum.subtotal_usd ?? 0),
  }))
  if (topItems.length > 0) {
    y = drawBarChart(doc, y, topItems)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(102, 102, 102)
    doc.text('Sin datos de ventas para este período', 15, y + 4)
    y += 12
  }
  y += 4

  // Sales table
  doc.setTextColor(17, 17, 17)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Detalle de Ventas', 15, y)
  y += 4

  const cols = [
    { label: 'Ticket',   x: 15,  w: 30, align: 'left'  as const },
    { label: 'Fecha',    x: 45,  w: 35, align: 'left'  as const },
    { label: 'Cliente',  x: 80,  w: 50, align: 'left'  as const },
    { label: 'Total USD', x: 130, w: 35, align: 'right' as const },
    { label: 'Total Bs.', x: 165, w: 30, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, cols)

  let page = 1
  for (let i = 0; i < sales.length; i++) {
    const s       = sales[i]
    const dateStr = s.sold_at ? s.sold_at.toISOString().slice(0, 10) : s.created_at.toISOString().slice(0, 10)
    const cells   = [
      { text: s.ticket_number,                           x: 15,  w: 30 },
      { text: dateStr,                                   x: 45,  w: 35 },
      { text: s.client_name ?? 'Consumidor final',       x: 80,  w: 50 },
      { text: fmtUsd(Number(s.total_usd)),               x: 130, w: 35, align: 'right' as const },
      { text: fmtBs(Number(s.total_bs)),                 x: 165, w: 30, align: 'right' as const },
    ]
    y = drawTableRow(doc, y, cells, i % 2 === 0)
    if (y > 265) {
      drawFooter(doc, page, 1)
      doc.addPage()
      page++
      await drawHeader(doc, 'Reporte Mensual', subtitle, business?.name ?? 'ActivoPOS')
      y = 38
      y = drawTableHeader(doc, y, cols)
    }
  }

  // Totals row
  y += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(17, 17, 17)
  doc.text(`TOTAL: ${fmtUsd(totalUsd)}`, 165, y, { align: 'right' })
  y += 6
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(102, 102, 102)
  doc.text(`Tasa promedio: Bs. ${avgRate.toFixed(2)}/USD`, 15, y)

  drawFooter(doc, page, page)

  return Buffer.from(doc.output('arraybuffer'))
}

/* ── Daily report ── */
export async function generateDailyReport(businessId: number, date: string): Promise<Buffer> {
  // date = "2026-06-22" format
  const day  = new Date(`${date}T00:00:00`)
  const next = new Date(day.getTime() + 86_400_000)

  const [business, sales] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    }),
    prisma.sale.findMany({
      where: {
        business_id: businessId,
        status:      'paid',
        sold_at:     { gte: day, lt: next },
      },
      include: {
        items: { select: { product_name: true, quantity: true, subtotal_usd: true } },
        payments: {
          include: { payment_method: { select: { name: true } } },
        },
      },
      orderBy: { sold_at: 'asc' },
    }),
  ])

  const totalUsd = sales.reduce((s, v) => s + Number(v.total_usd), 0)
  const totalBs  = sales.reduce((s, v) => s + Number(v.total_bs), 0)

  const JsPDF = await loadJsPDF()
  const doc   = new JsPDF({ unit: 'mm', format: 'a4' })

  await drawHeader(doc, 'Reporte Diario', date, business?.name ?? 'ActivoPOS')

  let y = 38
  drawKpiRow(doc, y, [
    { label: 'Total USD',  value: fmtUsd(totalUsd) },
    { label: 'Total Bs.',  value: fmtBs(totalBs) },
    { label: 'Ventas',     value: sales.length.toString() },
  ])
  y += 26

  doc.setTextColor(17, 17, 17)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Ventas del día', 15, y)
  y += 4

  const cols = [
    { label: 'Ticket',    x: 15,  w: 28, align: 'left'  as const },
    { label: 'Hora',      x: 43,  w: 22, align: 'left'  as const },
    { label: 'Cliente',   x: 65,  w: 50, align: 'left'  as const },
    { label: 'Método',    x: 115, w: 35, align: 'left'  as const },
    { label: 'Total USD', x: 150, w: 25, align: 'right' as const },
    { label: 'Total Bs.', x: 175, w: 20, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, cols)

  let page = 1
  for (let i = 0; i < sales.length; i++) {
    const s       = sales[i]
    const hour    = s.sold_at ? s.sold_at.toISOString().slice(11, 16) : '--:--'
    const method  = s.payments[0]?.payment_method.name ?? 'N/A'
    const cells   = [
      { text: s.ticket_number,                       x: 15,  w: 28 },
      { text: hour,                                  x: 43,  w: 22 },
      { text: s.client_name ?? 'Consumidor final',   x: 65,  w: 50 },
      { text: method,                                x: 115, w: 35 },
      { text: fmtUsd(Number(s.total_usd)),           x: 150, w: 25, align: 'right' as const },
      { text: fmtBs(Number(s.total_bs)),             x: 175, w: 20, align: 'right' as const },
    ]
    y = drawTableRow(doc, y, cells, i % 2 === 0)
    if (y > 265) {
      drawFooter(doc, page, 1)
      doc.addPage()
      page++
      await drawHeader(doc, 'Reporte Diario', date, business?.name ?? 'ActivoPOS')
      y = 38
      y = drawTableHeader(doc, y, cols)
    }
  }

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(17, 17, 17)
  doc.text(`TOTAL DEL DÍA: ${fmtUsd(totalUsd)}`, 195, y, { align: 'right' })

  drawFooter(doc, page, page)

  return Buffer.from(doc.output('arraybuffer'))
}
