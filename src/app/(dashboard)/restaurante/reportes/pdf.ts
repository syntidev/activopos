import type { RestauranteReportDTO } from '@/types/restaurante'

/** PDF del reporte (jsPDF, solo en el navegador). Mismas cifras que el CSV; las propinas van en su propia sección, aparte de las ventas. */

const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const bs = (n: number): string => `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const mins = (n: number | null): string => (n === null ? '—' : `${n} min`)

const MARGIN = 15
const PAGE_H = 297
const LINE = 6

export async function downloadReportPdf(r: RestauranteReportDTO): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const ensure = (h: number): void => { if (y + h > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN } }
  const title = (t: string): void => { ensure(12); y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(t, MARGIN, y); y += LINE; doc.setFont('helvetica', 'normal'); doc.setFontSize(10) }
  const row = (left: string, right: string): void => { ensure(LINE); doc.text(left, MARGIN, y); doc.text(right, 210 - MARGIN, y, { align: 'right' }); y += LINE }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Reporte del restaurante', MARGIN, y); y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`${r.from} a ${r.to}`, MARGIN, y); y += LINE

  title('Ventas netas (sin propinas)')
  row(`Total · ${r.net_sales.sales} ${r.net_sales.sales === 1 ? 'venta' : 'ventas'}`, `${usd(r.net_sales.total.usd)}   ${bs(r.net_sales.total.bs)}`)
  title('Por mesonero')
  for (const w of r.net_sales.by_waiter) row(`${w.name} (${w.sales})`, `${usd(w.net.usd)}   ${bs(w.net.bs)}`)
  title('Por área')
  for (const a of r.net_sales.by_area) row(`${a.name} (${a.sales})`, `${usd(a.net.usd)}   ${bs(a.net.bs)}`)

  title('Propinas (aparte de las ventas)')
  for (const t of r.tips.by_waiter) {
    row(`${t.name} (${t.count})`, `${usd(t.total.usd)}   ${bs(t.total.bs)}`)
    row(`   efectivo ${usd(t.cash.usd)} · otros métodos ${usd(t.other.usd)}`, '')
  }
  row('Total propinas', `${usd(r.tips.total.usd)}   ${bs(r.tips.total.bs)}`)
  row(`   efectivo ${usd(r.tips.cash.usd)} · otros métodos ${usd(r.tips.other.usd)}`, '')

  title('Rotación de mesas')
  row('Cuentas cerradas', String(r.rotation.closed_accounts))
  row('Vueltas por mesa', r.rotation.turns_per_table === null ? '—' : String(r.rotation.turns_per_table))
  row('Duración promedio de una cuenta', mins(r.rotation.avg_minutes))

  title('Tiempos por estación (p50 / p90)')
  for (const s of r.stations) row(`${s.name} (${s.items} ítems)`, `espera ${mins(s.wait_p50)} / ${mins(s.wait_p90)} · preparación ${mins(s.prep_p50)} / ${mins(s.prep_p90)} · total ${mins(s.total_p50)} / ${mins(s.total_p90)}`)

  doc.save(`restaurante-${r.from}_${r.to}.pdf`)
}
