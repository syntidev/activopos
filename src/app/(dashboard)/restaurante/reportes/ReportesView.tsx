'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { HelpButton } from '@/components/help/HelpButton'
import { businessDateKey, shiftDateKey } from '@/lib/business-day'
import { callApi } from '@/lib/restaurante-client'
import { formatBs, formatUsd } from '@/lib/restaurante'
import type { ReportMoneyDTO, ReportSalesRowDTO, RestauranteReportDTO } from '@/types/restaurante'
import { downloadReportPdf } from './pdf'
import styles from './reportes.module.css'

type Preset = 'hoy' | '7' | 'mes' | 'otro'

const minutes = (n: number | null): string => (n === null ? '—' : `${n} min`)
const BAR_W = 100

function range(preset: Exclude<Preset, 'otro'>): { from: string; to: string } {
  const today = businessDateKey()
  if (preset === 'hoy') return { from: today, to: today }
  if (preset === '7') return { from: shiftDateKey(today, -6), to: today }
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

function Money({ m, big = false }: { m: ReportMoneyDTO; big?: boolean }) {
  return <span className={big ? styles.moneyBig : styles.money}>{formatUsd(m.usd)}<small>{formatBs(m.bs)}</small></span>
}

/** Barra proporcional (SVG: el ancho es un atributo, no un estilo en línea). */
function Bar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(1, Math.round((value / max) * BAR_W)) : 0
  return <svg className={styles.bar} viewBox={`0 0 ${BAR_W} 4`} preserveAspectRatio="none" aria-hidden="true"><rect className={styles.barBg} width={BAR_W} height="4" rx="2" /><rect className={styles.barFg} width={w} height="4" rx="2" /></svg>
}

function SalesList({ title, rows, empty }: { title: string; rows: readonly ReportSalesRowDTO[]; empty: string }) {
  const max = Math.max(0, ...rows.map(r => r.net.usd))
  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {rows.length === 0 ? <p className={styles.empty}>{empty}</p> : (
        <ul className={styles.list}>
          {rows.map(r => (
            <li key={`${r.id}`} className={styles.row}>
              <div className={styles.rowTop}><span className={styles.name}>{r.name}</span><Money m={r.net} /></div>
              <Bar value={r.net.usd} max={max} />
              <span className={styles.sub}>{r.sales} {r.sales === 1 ? 'venta' : 'ventas'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Reportes del restaurante (admin): ventas netas, propinas aparte, rotación y tiempos por estación. USD y Bs siempre juntos. */
export function ReportesView() {
  const [preset, setPreset] = useState<Preset>('hoy')
  const [from, setFrom] = useState(() => range('hoy').from)
  const [to, setTo] = useState(() => range('hoy').to)
  const [report, setReport] = useState<RestauranteReportDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (f: string, t: string): Promise<void> => {
    setLoading(true)
    const res = await callApi<{ report: RestauranteReportDTO }>(`/api/restaurante/reportes?from=${f}&to=${t}`, 'GET')
    setLoading(false)
    if (!res.ok) { setError(res.error); return }
    setError(null); setReport(res.data.report)
  }, [])

  useEffect(() => { void load(from, to) }, [from, to, load])

  function pick(p: Exclude<Preset, 'otro'>): void {
    const r = range(p)
    setPreset(p); setFrom(r.from); setTo(r.to)
  }

  const r = report
  const maxTip = r ? Math.max(0, ...r.tips.by_waiter.map(t => t.total.usd)) : 0

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <h1 className={styles.title}>Reportes del restaurante</h1>
        <div className={styles.controls}>
          <div className={styles.seg} role="radiogroup" aria-label="Período">
            {([['hoy', 'Hoy'], ['7', '7 días'], ['mes', 'Este mes']] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={preset === k} className={`${styles.segBtn} ${preset === k ? styles.segOn : ''}`} onClick={() => pick(k)}>{label}</button>
            ))}
          </div>
          <label className={styles.date}><span>Desde</span><input type="date" value={from} max={to} onChange={e => { setPreset('otro'); setFrom(e.target.value) }} /></label>
          <label className={styles.date}><span>Hasta</span><input type="date" value={to} min={from} onChange={e => { setPreset('otro'); setTo(e.target.value) }} /></label>
        </div>
        <div className={styles.exports}>
          <a className={styles.btn} href={`/api/restaurante/reportes/export?from=${from}&to=${to}&format=csv`} download><Download size={16} aria-hidden="true" />CSV</a>
          <button type="button" className={styles.btn} disabled={!r} onClick={() => { if (r) void downloadReportPdf(r) }}><FileText size={16} aria-hidden="true" />PDF</button>
        </div>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading && !r && <p className={styles.empty}>Cargando…</p>}

      {r && (
        <>
          <section className={styles.kpis} aria-label="Resumen">
            <div className={styles.kpi}><span className={styles.kpiLabel}>Ventas netas</span><Money m={r.net_sales.total} big /><span className={styles.sub}>{r.net_sales.sales} {r.net_sales.sales === 1 ? 'venta' : 'ventas'} · sin propinas</span></div>
            <div className={`${styles.kpi} ${styles.kpiTip}`}><span className={styles.kpiLabel}>Propinas (aparte)</span><Money m={r.tips.total} big /><span className={styles.sub}>efectivo {formatUsd(r.tips.cash.usd)} · otros {formatUsd(r.tips.other.usd)}</span></div>
            <div className={styles.kpi}><span className={styles.kpiLabel}>Rotación</span><span className={styles.moneyBig}>{r.rotation.turns_per_table ?? '—'}<small>vueltas por mesa</small></span><span className={styles.sub}>{r.rotation.closed_accounts} cuentas cerradas · {minutes(r.rotation.avg_minutes)} cada una</span></div>
          </section>

          <div className={styles.grid}>
            <SalesList title="Ventas por mesonero" rows={r.net_sales.by_waiter} empty="Sin ventas de mesa en este período." />
            <SalesList title="Ventas por área" rows={r.net_sales.by_area} empty="Sin ventas de mesa en este período." />

            <section className={styles.card} aria-label="Propinas por mesonero">
              <h2 className={styles.cardTitle}>Propinas por mesonero</h2>
              {r.tips.by_waiter.length === 0 ? <p className={styles.empty}>Sin propinas en este período.</p> : (
                <ul className={styles.list}>
                  {r.tips.by_waiter.map(t => (
                    <li key={`${t.id}`} className={styles.row}>
                      <div className={styles.rowTop}><span className={styles.name}>{t.name}</span><Money m={t.total} /></div>
                      <Bar value={t.total.usd} max={maxTip} />
                      <span className={styles.sub}>{t.count} {t.count === 1 ? 'propina' : 'propinas'} · efectivo {formatUsd(t.cash.usd)} · otros {formatUsd(t.other.usd)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.card} aria-label="Tiempos por estación">
              <h2 className={styles.cardTitle}>Tiempos por estación</h2>
              {r.stations.length === 0 ? <p className={styles.empty}>No hay estaciones configuradas.</p> : (
                <ul className={styles.list}>
                  {r.stations.map(s => (
                    <li key={s.id} className={styles.row}>
                      <div className={styles.rowTop}><span className={styles.name}>{s.name}</span><span className={styles.sub}>{s.items} {s.items === 1 ? 'ítem' : 'ítems'}</span></div>
                      <dl className={styles.times}>
                        <div><dt>Espera</dt><dd>{minutes(s.wait_p50)} <i>/</i> {minutes(s.wait_p90)}</dd></div>
                        <div><dt>Preparación</dt><dd>{minutes(s.prep_p50)} <i>/</i> {minutes(s.prep_p90)}</dd></div>
                        <div><dt>Total</dt><dd>{minutes(s.total_p50)} <i>/</i> {minutes(s.total_p90)}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.hint}>p50 = la mitad se despacha en ese tiempo o menos; p90 = nueve de cada diez.</p>
            </section>

            <section className={styles.card} aria-label="Rotación por área">
              <h2 className={styles.cardTitle}>Rotación por área</h2>
              {r.rotation.by_area.length === 0 ? <p className={styles.empty}>Sin cuentas cerradas en este período.</p> : (
                <ul className={styles.list}>
                  {r.rotation.by_area.map(a => (
                    <li key={a.area} className={styles.row}>
                      <div className={styles.rowTop}><span className={styles.name}>{a.area}</span><span className={styles.money}>{a.closed}<small>{a.closed === 1 ? 'cuenta' : 'cuentas'}</small></span></div>
                      <span className={styles.sub}>{minutes(a.avg_minutes)} de promedio por cuenta</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
      <HelpButton module="restaurante" />
    </div>
  )
}
