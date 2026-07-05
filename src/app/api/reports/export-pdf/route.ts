import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')

const rangeSchema = z.object({
  from: dateStr,
  to:   dateStr,
}).superRefine((data, ctx) => {
  const f = new Date(data.from)
  const t = new Date(data.to)
  if (isNaN(f.getTime()) || isNaN(t.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha inválida' })
    return
  }
  if (f > t) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '"from" debe ser anterior o igual a "to"' })
  }
  if ((t.getTime() - f.getTime()) / 86_400_000 > 90) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rango máximo 90 días' })
  }
})

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface TopProductRow {
  name:      string
  quantity:  string | number
  total_usd: string | number
}

interface ProfitRow {
  profit: string | null
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const sp     = req.nextUrl.searchParams
  const parsed = rangeSchema.safeParse({ from: sp.get('from'), to: sp.get('to') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  const { from: fromStr, to: toStr } = parsed.data
  const bid  = session.businessId
  const from = new Date(`${fromStr}T00:00:00Z`)
  const to   = new Date(`${toStr}T23:59:59.999Z`)

  const [salesAgg, profitRows, topProductsRaw, gastos, business] = await Promise.all([
    db.sale.aggregate({
      where: { status: 'paid', sold_at: { gte: from, lte: to } }, // business_id inyectado
      _sum:   { total_usd: true, total_bs: true },
      _count: { id: true },
    }),

    // $queryRaw NO pasa por el tenant layer — business_id manual obligatorio.
    // Costo histórico desde si.cost_per_unit_usd (capturado al vender), no el
    // costo actual del producto — mismo patrón que day/range (GAP-R1).
    prisma.$queryRaw<ProfitRow[]>`
      SELECT SUM(si.subtotal_usd - si.quantity * IFNULL(si.cost_per_unit_usd, 0)) AS profit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.business_id = ${bid}
        AND s.status = 'paid'
        AND s.sold_at >= ${from}
        AND s.sold_at <= ${to}`,

    prisma.$queryRaw<TopProductRow[]>`
      SELECT si.product_name AS name,
             SUM(si.quantity)     AS quantity,
             SUM(si.subtotal_usd) AS total_usd
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.business_id = ${bid}
        AND s.status = 'paid'
        AND s.sold_at >= ${from}
        AND s.sold_at <= ${to}
      GROUP BY si.product_name
      ORDER BY total_usd DESC
      LIMIT 10`,

    // categoria='proveedor' excluida: esa compra de inventario ya cuenta como
    // costo variable vía SaleItem al venderse — contarla aquí la duplicaría
    // (mismo fix aplicado en finanzas/pyl, resumen y punto-equilibrio — GAP-R2).
    db.gasto.aggregate({
      where: { fecha: { gte: from, lte: to }, categoria: { not: 'proveedor' } }, // business_id inyectado
      _sum: { monto_usd: true },
    }),

    // Business es la raíz del tenant (no tiene business_id) → no se filtra.
    db.business.findUnique({
      where:  { id: bid },
      select: { name: true, logo_path: true },
    }),
  ])

  const totalIngresos = Number(salesAgg._sum.total_usd ?? 0)
  const totalGastos   = Number(gastos._sum.monto_usd ?? 0)
  const utilidad      = totalIngresos - totalGastos
  const margen        = totalIngresos > 0 ? (utilidad / totalIngresos) * 100 : 0
  const profitBruto   = parseFloat(profitRows[0]?.profit ?? '0') || 0
  const salesCount    = salesAgg._count.id

  const topProductsHtml = topProductsRaw.map((p, i) =>
    `<tr>
      <td>${i + 1}</td>
      <td>${esc(p.name)}</td>
      <td>${Number(p.quantity).toFixed(1)}</td>
      <td>$${Number(p.total_usd).toFixed(2)}</td>
    </tr>`
  ).join('')

  const logoHtml = business?.logo_path
    ? `<img src="${esc(business.logo_path)}" alt="Logo" style="height:40px;object-fit:contain;display:block;margin:0 auto 8px">`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte ${fromStr} → ${toStr}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Inter, system-ui, sans-serif;
    font-size: 12px;
    color: #111;
    background: #fff;
    padding: 24px;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 { font-size: 20px; font-weight: 700; }
  h2 { font-size: 14px; font-weight: 600; margin: 20px 0 8px; }
  .header {
    background: #0EA5A4;
    color: #fff;
    padding: 20px 24px;
    border-radius: 8px;
    margin-bottom: 24px;
    text-align: center;
  }
  .header h1 { color: #fff; }
  .header p  { opacity: .85; margin-top: 4px; font-size: 13px; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .kpi {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }
  .kpi-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
  .kpi-value { font-size: 18px; font-weight: 700; }
  .green { color: #16a34a; }
  .red   { color: #dc2626; }
  table  { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th     { background: #f9fafb; font-weight: 600; }
  td:last-child, th:last-child { text-align: right; }
  .footer { margin-top: 24px; font-size: 10px; color: #9ca3af; text-align: center; }
  @media print {
    @page { margin: 15mm 10mm; }
    body  { padding: 0; }
    .no-print { display: none; }
  }
</style>
<script>window.onload = () => window.print()</script>
</head>
<body>
<div class="header">
  ${logoHtml}
  <h1>${esc(business?.name ?? 'Reporte de Ventas')}</h1>
  <p>Período: ${fromStr} — ${toStr}</p>
</div>

<div class="summary-grid">
  <div class="kpi">
    <div class="kpi-label">Ventas</div>
    <div class="kpi-value">${salesCount}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Ingresos</div>
    <div class="kpi-value">$${totalIngresos.toFixed(2)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Gastos</div>
    <div class="kpi-value red">$${totalGastos.toFixed(2)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Utilidad Neta</div>
    <div class="kpi-value ${utilidad >= 0 ? 'green' : 'red'}">$${utilidad.toFixed(2)}</div>
  </div>
</div>

<table style="margin-bottom:16px">
  <tr><th>Concepto</th><th>Valor USD</th></tr>
  <tr><td>Ingresos totales</td><td>$${totalIngresos.toFixed(2)}</td></tr>
  <tr><td>Gastos totales</td><td>$${totalGastos.toFixed(2)}</td></tr>
  <tr><td><strong>Utilidad neta</strong></td><td><strong>$${utilidad.toFixed(2)}</strong></td></tr>
  <tr><td>Ganancia bruta (costo vs precio)</td><td>$${profitBruto.toFixed(2)}</td></tr>
  <tr><td>Margen neto</td><td>${margen.toFixed(1)}%</td></tr>
</table>

<h2>Top Productos del Período</h2>
<table>
  <thead><tr><th>#</th><th>Producto</th><th>Unidades</th><th>Total USD</th></tr></thead>
  <tbody>${topProductsHtml || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody>
</table>

<div class="footer">
  ActivoPOS &mdash; Reporte generado el ${new Date().toLocaleDateString('es-VE')}
</div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
