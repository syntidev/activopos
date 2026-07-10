import { prisma } from './prisma'
import { readCachedBcvRate } from './bcv'
import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports')
const TOKEN_TTL_DAYS = 30

type GenerateResult = {
  filePath:  string
  token:     string
  expiresAt: Date
}

async function ensureReportsDir(): Promise<void> {
  if (!existsSync(REPORTS_DIR)) {
    await mkdir(REPORTS_DIR, { recursive: true })
  }
}

export async function generateMonthlyPDF(
  businessId: number,
  period: string
): Promise<GenerateResult> {
  const [year, month] = period.split('-').map(Number)
  const monthStart    = new Date(year, month - 1, 1)
  const monthEnd      = new Date(year, month, 1)

  const [business, salesAgg, dailyRaw, rate] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where:  { id: businessId },
      select: { name: true, phone: true, city: true },
    }),
    prisma.sale.aggregate({
      where: {
        business_id: businessId,
        status:      'paid',
        sold_at:     { gte: monthStart, lt: monthEnd },
      },
      _sum:   { total_usd: true, total_bs: true },
      _count: { id: true },
    }),
    prisma.$queryRaw<{ day: string; total_usd: string | number; count: string | number }[]>`
      SELECT DATE_FORMAT(sold_at, '%Y-%m-%d') AS day,
             SUM(total_usd) AS total_usd,
             COUNT(*)       AS count
      FROM sales
      WHERE business_id = ${businessId}
        AND status = 'paid'
        AND sold_at >= ${monthStart}
        AND sold_at < ${monthEnd}
      GROUP BY day
      ORDER BY day ASC
    `,
    readCachedBcvRate(),
  ])

  const { jsPDF } = await import('jspdf') as typeof import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  const totalUsd    = Number(salesAgg._sum.total_usd ?? 0)
  const totalBs     = Number(salesAgg._sum.total_bs  ?? 0)
  const salesCount  = salesAgg._count.id
  const monthNames  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const monthName   = monthNames[month - 1] ?? period

  // ── Encabezado ──
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Reporte Mensual de Ventas', 105, 20, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`${business.name}`, 105, 28, { align: 'center' })
  if (business.city) doc.text(business.city, 105, 34, { align: 'center' })
  doc.text(`Período: ${monthName} ${year}`, 105, 40, { align: 'center' })

  // ── Resumen ──
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen', 14, 54)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const r2 = (n: number) => n.toFixed(2)
  doc.text(`Total ventas:    $${r2(totalUsd)}  /  Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 14, 62)
  doc.text(`Transacciones:   ${salesCount}`, 14, 68)
  doc.text(`Tasa BCV ref.:   ${rate.toFixed(4)} Bs/$`, 14, 74)

  // ── Detalle diario ──
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Ventas por día', 14, 86)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Fecha',         14,  94)
  doc.text('Transacciones', 80,  94)
  doc.text('Total USD',     130, 94)
  doc.setFont('helvetica', 'normal')

  let y = 100
  for (const d of dailyRaw) {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.text(String(d.day),                     14,  y)
    doc.text(String(d.count),                   80,  y)
    doc.text(`$${r2(Number(d.total_usd))}`,     130, y)
    y += 6
  }

  // ── Pie ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Generado por ActivoPOS — ${new Date().toLocaleDateString('es-VE')} — Pág. ${i}/${pageCount}`,
      105, 290,
      { align: 'center' }
    )
  }

  await ensureReportsDir()

  const token      = crypto.randomUUID()
  const filename   = `${businessId}-${period}-${token.slice(0, 8)}.pdf`
  const filePath   = path.join(REPORTS_DIR, filename)
  const pdfBuffer  = Buffer.from(doc.output('arraybuffer'))

  await writeFile(filePath, pdfBuffer)

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS)

  return { filePath, token, expiresAt }
}
