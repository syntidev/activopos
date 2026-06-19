'use client'

import { useState, useCallback } from 'react'
import { Filter, RefreshCw, Archive } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import styles from './historial.module.css'

/* ── Types ── */

interface HistorialEntry {
  id: number
  openedAt: string
  closedAt: string | null
  cashierName: string
  salesCount: number
  totalVentasBs: number
  totalVentasUsd: number
  efectivoEsperado: number
  efectivoContado: number | null
  diferencia: number | null
  rateAtOpen: number
}

/* ── Helpers ── */

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDatetime = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/* ── Inner component ── */

function HistorialContent() {
  const { toast } = useToast()

  const [from, setFrom]     = useState(daysAgo(30))
  const [to, setTo]         = useState(new Date().toISOString().slice(0, 10))
  const [data, setData]     = useState<HistorialEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cash/history?from=${from}&to=${to}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.history ?? [])
        setFetched(true)
      } else {
        toast('Error al cargar el historial', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setLoading(false)
    }
  }, [from, to, toast])

  return (
    <div className={`${styles.page} page-container`}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Historial de Cierres de Caja</h1>
          <p className={styles.pageSubtitle}>Consulta y verifica los cuadres de caja por turno.</p>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <label className={styles.filterLabel}>
          <span className={styles.filterLabelText}>Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={styles.dateInput}
          />
        </label>
        <label className={styles.filterLabel}>
          <span className={styles.filterLabelText}>Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={styles.dateInput}
          />
        </label>
        <div className={styles.filterActions}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Filter size={14} aria-hidden="true" />}
            onClick={fetchHistory}
            loading={loading}
          >
            Filtrar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={14} aria-hidden="true" />}
            onClick={fetchHistory}
            loading={loading}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {/* Table card */}
      <div className={styles.tableCard}>
        {!fetched ? (
          <div className={styles.emptyPrompt}>
            <Archive size={28} className={styles.emptyIcon} aria-hidden="true" />
            <p>Selecciona un rango de fechas y presiona <strong>Filtrar</strong>.</p>
          </div>
        ) : loading ? (
          <div className={styles.emptyPrompt}>
            <p className={styles.loadingText}>Cargando historial...</p>
          </div>
        ) : data.length === 0 ? (
          <div className={styles.emptyPrompt}>
            <Archive size={28} className={styles.emptyIcon} aria-hidden="true" />
            <p>No se encontraron cierres en el período seleccionado.</p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.th}>Fecha de Cierre</th>
                  <th className={styles.th}>Usuario</th>
                  <th className={styles.th}>Ventas Turno</th>
                  <th className={`${styles.th} ${styles.alignRight}`}>Efvo. Esperado</th>
                  <th className={`${styles.th} ${styles.alignRight}`}>Efvo. Contado</th>
                  <th className={`${styles.th} ${styles.alignRight}`}>Dif. USD</th>
                  <th className={`${styles.th} ${styles.alignRight}`}>Dif. Bs</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const difBs  = row.diferencia
                  const difUsd =
                    difBs !== null && row.rateAtOpen > 0
                      ? difBs / row.rateAtOpen
                      : null
                  const ok = difBs !== null && difBs <= 0

                  return (
                    <tr key={row.id} className={styles.row}>
                      <td className={styles.td}>
                        <span className={styles.dateCell}>{fmtDatetime(row.closedAt)}</span>
                        <span className={styles.openedAt}>Apertura: {fmtDatetime(row.openedAt)}</span>
                      </td>
                      <td className={styles.td}>{row.cashierName}</td>
                      <td className={styles.td}>
                        <div className={styles.salesStack}>
                          <span className={styles.salesUsd}>{fmtUsd(row.totalVentasUsd)}</span>
                          <span className={styles.salesBs}>{fmtBs(row.totalVentasBs)}</span>
                          <span className={styles.countChip}>{row.salesCount} tickets</span>
                        </div>
                      </td>
                      <td className={`${styles.td} ${styles.alignRight}`}>
                        {fmtBs(row.efectivoEsperado)}
                      </td>
                      <td className={`${styles.td} ${styles.alignRight}`}>
                        {row.efectivoContado !== null ? fmtBs(row.efectivoContado) : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.alignRight} ${ok ? styles.difOk : styles.difBad}`}>
                        {difUsd !== null ? fmtUsd(difUsd) : '—'}
                      </td>
                      <td className={`${styles.td} ${styles.alignRight} ${ok ? styles.difOk : styles.difBad}`}>
                        {difBs !== null ? fmtBs(difBs) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CajaHistorialPage() {
  return (
    <ToastProvider>
      <HistorialContent />
    </ToastProvider>
  )
}
