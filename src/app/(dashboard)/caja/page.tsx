'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Plus,
  DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { MovimientoModal } from '@/components/cash/MovimientoModal'
import { CierreConfirmModal } from '@/components/cash/CierreConfirmModal'
import type { PaymentMethod } from '@/components/cash/MovimientoModal'
import styles from './caja.module.css'

/* ── Types ── */

interface RegisterInfo {
  id: number
  openedAt: string
  cashierName: string
  openingAmountBs: number
  openingAmountUsd: number
  rateAtOpen: number
}

interface TurnoStats {
  salesCount: number
  totalVentasBs: number
  totalVentasUsd: number
  cashVentasBs: number
  movIn: number
  movOut: number
  efectivoEsperado: number
  cobrosCredito: { usd: number; bs: number; count: number }
}

interface CashStatus {
  isOpen: boolean
  register?: RegisterInfo
  turnoStats?: TurnoStats
}

interface Movement {
  id: number
  type: 'in' | 'out'
  amount_bs: number
  amount_usd: number
  concept: string
  created_at: string
  payment_method?: { name: string; type: string } | null
  user?: { name: string } | null
}

interface PmStat {
  id: number
  name: string
  type: string
  totalUsd: number
  totalBs: number
  count: number
}

/* ── Helpers ── */

function fmtUsd(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtBs(n: number) {
  return `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return `hace ${Math.floor(diff)}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return `hace ${h}h ${m > 0 ? ` ${m}min` : ''}`
}

function pmDotClass(type: string): string {
  const map: Record<string, string> = {
    cash: styles.pmDotCash,
    transfer: styles.pmDotTransfer,
    zelle: styles.pmDotZelle,
    binance: styles.pmDotBinance,
    card: styles.pmDotCard,
  }
  return map[type] ?? styles.pmDotOther
}

/* ── Sub-components ── */

function PageSkeleton() {
  return (
    <div className={styles.skeletonPage}>
      <div className={styles.skeletonHeader} />
      <div className={styles.skeletonKpis}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonKpiCard} />
        ))}
      </div>
    </div>
  )
}

function KpiCard({
  label,
  usd,
  bs,
  meta,
  isExpected = false,
}: {
  label: string
  usd: number
  bs: number
  meta?: string
  isExpected?: boolean
}) {
  return (
    <div className={`${styles.kpiCard} ${isExpected ? styles.kpiCardExpected : ''}`}>
      <p className={styles.kpiLabel}>{label}</p>
      <div className={styles.kpiAmounts}>
        <span className={styles.kpiUsd}>{fmtUsd(usd)}</span>
        <span className={styles.kpiBs}>{fmtBs(bs)}</span>
      </div>
      {meta && <p className={styles.kpiMeta}>{meta}</p>}
    </div>
  )
}

/* ── Main inner component (uses toast hook) ── */

function CajaContent() {
  const { toast } = useToast()

  const [status, setStatus]               = useState<CashStatus | null>(null)
  const [movements, setMovements]         = useState<Movement[]>([])
  const [pmStats, setPmStats]             = useState<PmStat[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading]             = useState(true)
  const [openingUsd, setOpeningUsd]       = useState('')
  const [openingBs, setOpeningBs]         = useState('')
  const [openingLoading, setOpeningLoading] = useState(false)
  const [closingUsd, setClosingUsd]       = useState('')
  const [closingBs, setClosingBs]         = useState('')
  const [closingLoading, setClosingLoading] = useState(false)
  const [showMovModal, setShowMovModal]   = useState(false)
  const [showCierreModal, setShowCierreModal] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cash/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      /* keep previous state */
    }
  }, [])

  const fetchMovements = useCallback(async () => {
    try {
      const res = await fetch('/api/cash/movement')
      if (res.ok) {
        const data = await res.json()
        setMovements(data.movements ?? [])
      }
    } catch {
      /* keep previous state */
    }
  }, [])

  const fetchDailyStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch(`/api/reports/daily?date=${today}`)
      if (res.ok) {
        const data = await res.json()
        setPmStats(data.byPaymentMethod ?? [])
      }
    } catch {
      /* non-critical */
    }
  }, [])

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/payment-methods')
      if (res.ok) {
        const data = await res.json()
        setPaymentMethods(data.methods ?? [])
      }
    } catch {
      /* non-critical */
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchStatus(), fetchPaymentMethods()])
    setLoading(false)
    await Promise.all([fetchMovements(), fetchDailyStats()])
  }, [fetchStatus, fetchMovements, fetchDailyStats, fetchPaymentMethods])

  useEffect(() => {
    fetchAll()
    pollRef.current = setInterval(() => {
      fetchStatus()
      fetchMovements()
      fetchDailyStats()
    }, 30_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchAll, fetchStatus, fetchMovements, fetchDailyStats])

  const handleOpen = async () => {
    const usd = parseFloat(openingUsd) || 0
    const bs  = parseFloat(openingBs)  || 0
    setOpeningLoading(true)
    try {
      const res = await fetch('/api/cash/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_amount_usd: usd, opening_amount_bs: bs }),
      })
      if (res.ok) {
        toast('Caja abierta correctamente', 'success')
        await fetchAll()
      } else {
        const data = await res.json()
        toast(data.error ?? 'Error al abrir la caja', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setOpeningLoading(false)
    }
  }

  const handleClose = async () => {
    const usd = parseFloat(closingUsd) || 0
    const bs  = parseFloat(closingBs)  || 0
    setClosingLoading(true)
    try {
      const res = await fetch('/api/cash/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_amount_usd: usd, closing_amount_bs: bs }),
      })
      if (res.ok) {
        toast('Caja cerrada correctamente', 'success')
        setShowCierreModal(false)
        setClosingUsd('')
        setClosingBs('')
        await fetchAll()
      } else {
        const data = await res.json()
        toast(data.error ?? 'Error al cerrar la caja', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setClosingLoading(false)
    }
  }

  const handleMovimientoSaved = () => {
    fetchMovements()
    fetchStatus()
    fetchDailyStats()
    toast('Movimiento registrado', 'success')
  }

  if (loading) return <PageSkeleton />

  /* ── Caja cerrada ── */
  if (!status?.isOpen) {
    return (
      <div className={`${styles.page} page-container`}>
        <h1 className={styles.pageTitle}>Gestión de Caja</h1>
        <div className={styles.closedWrap}>
          <div className={styles.closedCard}>
            <div className={styles.closedIcon}>
              <Lock size={24} aria-hidden="true" />
            </div>
            <h2 className={styles.closedTitle}>La caja está cerrada</h2>
            <p className={styles.closedDesc}>
              Ingresa los fondos iniciales del turno para comenzar a registrar ventas.
            </p>
            <div className={styles.openForm}>
              <Input
                label="Fondos iniciales (USD)"
                type="number"
                min="0"
                step="0.01"
                value={openingUsd}
                onChange={(e) => setOpeningUsd(e.target.value)}
                placeholder="0.00"
                leftIcon={<DollarSign size={14} aria-hidden="true" />}
              />
              <Input
                label="Fondos iniciales (Bs)"
                type="number"
                min="0"
                step="0.01"
                value={openingBs}
                onChange={(e) => setOpeningBs(e.target.value)}
                placeholder="0.00"
              />
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleOpen}
                loading={openingLoading}
              >
                Abrir Caja
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Caja abierta ── */
  const reg   = status.register!
  const stats = status.turnoStats!
  const closingAmounts = {
    usd: parseFloat(closingUsd) || 0,
    bs:  parseFloat(closingBs)  || 0,
  }

  return (
    <div className={`${styles.page} page-container`}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <div className={styles.pageTitleRow}>
            <h1 className={styles.pageTitle}>Gestión de Caja</h1>
            <span className={`${styles.statusBadge} ${styles.statusBadgeOpen}`}>
              <span className={styles.statusDot} aria-hidden="true" />
              Caja Abierta
            </span>
          </div>
          <p className={styles.pageSubtitle}>
            Abierta {timeAgo(reg.openedAt)} · Cajero: {reg.cashierName} · Tasa: Bs {reg.rateAtOpen.toFixed(2)}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className={styles.kpis}>
        <KpiCard
          label="Fondos Iniciales"
          usd={reg.openingAmountUsd}
          bs={reg.openingAmountBs}
          meta={`Por: ${reg.cashierName}`}
        />
        <KpiCard
          label="Ventas del Turno"
          usd={stats.totalVentasUsd}
          bs={stats.totalVentasBs}
          meta={`${stats.salesCount} ${stats.salesCount === 1 ? 'ticket' : 'tickets'}`}
        />
        <KpiCard
          label="Cobros de Crédito"
          usd={stats.cobrosCredito?.usd ?? 0}
          bs={stats.cobrosCredito?.bs ?? 0}
          meta={`${stats.cobrosCredito?.count ?? 0} abono${(stats.cobrosCredito?.count ?? 0) !== 1 ? 's' : ''}`}
        />
        <KpiCard
          label="Efectivo Esperado"
          usd={stats.efectivoEsperado / (reg.rateAtOpen || 1)}
          bs={stats.efectivoEsperado}
          meta="Incluye ventas en efectivo"
          isExpected
        />
      </div>

      {/* Two columns */}
      <div className={styles.cols}>
        {/* Left: movements + pm breakdown */}
        <div className={styles.colLeft}>
          {/* Movements card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Movimientos de Caja</h2>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Plus size={14} aria-hidden="true" />}
                onClick={() => setShowMovModal(true)}
              >
                Agregar
              </Button>
            </div>

            {movements.length === 0 ? (
              <div className={styles.emptyMovements}>
                <span className={styles.emptyIcon}>
                  <ArrowDownLeft size={28} aria-hidden="true" />
                </span>
                Ningún movimiento extra registrado
              </div>
            ) : (
              <div className={styles.movList}>
                {movements.map((mov) => (
                  <div key={mov.id} className={styles.movItem}>
                    <div
                      className={`${styles.movIcon} ${
                        mov.type === 'in' ? styles.movIconIn : styles.movIconOut
                      }`}
                      aria-hidden="true"
                    >
                      {mov.type === 'in' ? (
                        <ArrowDownLeft size={14} />
                      ) : (
                        <ArrowUpRight size={14} />
                      )}
                    </div>
                    <div className={styles.movBody}>
                      <p className={styles.movConcept}>{mov.concept}</p>
                      <p className={styles.movMethodAndTime}>
                        {mov.payment_method?.name ?? 'Sin método'} ·{' '}
                        {new Date(mov.created_at).toLocaleTimeString('es-VE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span
                      className={`${styles.movAmount} ${
                        mov.type === 'in' ? styles.movAmountIn : styles.movAmountOut
                      }`}
                    >
                      {mov.type === 'in' ? '+' : '−'}{fmtBs(Number(mov.amount_bs))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment methods breakdown */}
          {pmStats.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Ventas por Método de Pago</h2>
              </div>
              <table className={styles.pmTable}>
                <thead className={styles.pmThead}>
                  <tr>
                    <th>Método</th>
                    <th>Total USD</th>
                    <th>Total Bs</th>
                    <th>Transacc.</th>
                  </tr>
                </thead>
                <tbody>
                  {pmStats.map((pm) => (
                    <tr key={pm.id} className={styles.pmRow}>
                      <td>
                        <span className={styles.pmName}>
                          <span className={`${styles.pmDot} ${pmDotClass(pm.type)}`} />
                          {pm.name}
                        </span>
                      </td>
                      <td className={styles.pmUsd}>{fmtUsd(pm.totalUsd)}</td>
                      <td className={styles.pmBs}>{fmtBs(pm.totalBs)}</td>
                      <td className={styles.pmCount}>{pm.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: cierre */}
        <div className={`${styles.card} ${styles.cardDangerBorder}`}>
          <div className={styles.cardHeader}>
            <h2 className={`${styles.cardTitle} ${styles.cardTitleDanger}`}>
              Declarar Cierre
            </h2>
          </div>
          <div className={styles.cierreBody}>
            <div className={styles.cierreWarning}>
              <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
              Registra el dinero contado físicamente. Luego se calculará la diferencia contra el efectivo esperado del sistema.
            </div>

            <div className={styles.cierreInputs}>
              <Input
                label="Efectivo contado (USD)"
                type="number"
                min="0"
                step="0.01"
                value={closingUsd}
                onChange={(e) => setClosingUsd(e.target.value)}
                placeholder="0.00"
                leftIcon={<DollarSign size={14} aria-hidden="true" />}
              />
              <Input
                label="Efectivo contado (Bs)"
                type="number"
                min="0"
                step="0.01"
                value={closingBs}
                onChange={(e) => setClosingBs(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <Button
              variant="danger"
              size="lg"
              fullWidth
              leftIcon={<Lock size={15} aria-hidden="true" />}
              onClick={() => setShowCierreModal(true)}
            >
              Cerrar Caja
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MovimientoModal
        open={showMovModal}
        onClose={() => setShowMovModal(false)}
        onSaved={handleMovimientoSaved}
        rate={reg.rateAtOpen}
        paymentMethods={paymentMethods}
      />

      <CierreConfirmModal
        open={showCierreModal}
        onClose={() => setShowCierreModal(false)}
        onConfirm={handleClose}
        closingAmounts={closingAmounts}
        turnoStats={stats}
        loading={closingLoading}
      />
    </div>
  )
}

/* ── Page export wraps with ToastProvider ── */
export default function CajaPage() {
  return (
    <ToastProvider>
      <CajaContent />
    </ToastProvider>
  )
}
