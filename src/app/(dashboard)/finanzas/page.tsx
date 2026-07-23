'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileSpreadsheet, Check, Tag } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { Button }          from '@/components/ui/Button'
import { useToast }        from '@/components/ui'
import { UpgradeModal }    from '@/components/ui/UpgradeModal'
import { usePlanGate }     from '@/hooks/usePlanGate'
import { CxCSection }      from './CxCSection'
import { CxPSection }      from './CxPSection'
import { GastosSection }   from './GastosSection'
import { ResumenSection }  from './ResumenSection'
import { PylSection }      from './PylSection'
import { TabCategorias }   from '../configuracion/tabs/TabCategorias'
import { HelpButton }      from '@/components/help/HelpButton'
import styles from './finanzas.module.css'

const TABS = [
  { key: 'resumen',    label: 'Resumen'               },
  { key: 'pyl',        label: 'Estado de Resultados'  },
  { key: 'gastos',     label: 'Gastos'                },
  { key: 'cxc',        label: 'Por Cobrar'            },
  { key: 'cxp',        label: 'Por Pagar'             },
  { key: 'categorias', label: 'Categorías', Icon: Tag },
] as const

type TabKey = typeof TABS[number]['key']

export default function FinanzasPage() {
  const [tab, setTab]   = useState<TabKey>('resumen')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [rate,            setRate]           = useState(0)
  const [exportingExcel,  setExportingExcel] = useState(false)
  const [exportSuccess,   setExportSuccess]  = useState(false)
  const { toast } = useToast()

  // Gate de plan a nivel de página, mismo mecanismo que ReportesClient.tsx
  // (guardedFetch + upgradeReason + UpgradeModal). El hook es reactivo — solo
  // sabe que hay bloqueo DESPUÉS de un 403 real — así que se dispara una sola
  // llamada proactiva contra un endpoint de Finanzas ya gateado en el backend
  // (checkPlanLimit('access_finanzas')) para decidir qué renderizar. Las
  // secciones (ResumenSection, etc.) no se tocan ni repiten esta lógica.
  const { guardedFetch, upgradeReason, clearUpgrade } = usePlanGate()
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [hasAccess,      setHasAccess]      = useState(false)

  useEffect(() => {
    fetch('/api/rates/bcv')
      .then(r => r.json())
      .then(j => { if (j.ok && j.rate) setRate(Number(j.rate)) })
  }, [])

  useEffect(() => {
    let alive = true
    guardedFetch(`/api/finanzas/resumen?month=${month}`)
      .then(res => { if (alive) setHasAccess(res.ok) })
      .finally(() => { if (alive) setCheckingAccess(false) })
    return () => { alive = false }
    // Chequeo único al montar con el mes inicial — cambiar de mes no cambia el
    // plan, no hace falta repetir el check en cada cambio de `month`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExportExcel = useCallback(async () => {
    if (exportingExcel) return
    setExportingExcel(true)
    try {
      const [year, mon] = month.split('-')
      const lastDay = new Date(Number(year), Number(mon), 0).getDate()
      const from = `${month}-01`
      const to   = `${month}-${String(lastDay).padStart(2, '0')}`
      const res  = await fetch(`/api/finanzas/export?from=${from}&to=${to}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `finanzas-${year}-${mon}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 2000)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al exportar', 'error')
    } finally {
      setExportingExcel(false)
    }
  }, [month, exportingExcel, toast])

  if (checkingAccess) {
    return (
      <div className={`${styles.page} page-container`}>
        <div className={styles.loading}>Cargando…</div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className={`${styles.page} page-container`}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Finanzas</h1>
        </div>
        <div className={styles.sectionError}>
          {upgradeReason ?? 'El módulo de finanzas requiere plan Negocio Activo.'}
        </div>
        <UpgradeModal reason={upgradeReason} onClose={clearUpgrade} />
      </div>
    )
  }

  return (
    <div className={`${styles.page} page-container`}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Finanzas</h1>
        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={
              exportSuccess
                ? <Check size={14} aria-hidden="true" />
                : <FileSpreadsheet size={14} aria-hidden="true" />
            }
            onClick={handleExportExcel}
            loading={exportingExcel}
            aria-label="Exportar Excel del mes seleccionado"
          >
            {exportSuccess ? '¡Listo!' : 'Excel'}
          </Button>
          <input
            type="month"
            className={styles.monthInput}
            value={month}
            onChange={e => setMonth(e.target.value)}
            aria-label="Seleccionar mes"
          />
        </div>
      </div>

      <div className={styles.tabsRow} role="tablist">
        {TABS.map(t => {
          const Icon = 'Icon' in t ? t.Icon : null
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {Icon && <Icon size={14} aria-hidden="true" />}
              {t.label}
            </button>
          )
        })}
      </div>

      <div className={styles.tabContent} role="tabpanel">
        <ErrorBoundary fallback={<div className={styles.sectionError}>Error al cargar esta sección</div>}>
          {tab === 'resumen' && <ResumenSection month={month} rate={rate} />}
        </ErrorBoundary>
        <ErrorBoundary fallback={<div className={styles.sectionError}>Error al cargar esta sección</div>}>
          {tab === 'pyl'     && <PylSection rate={rate} />}
        </ErrorBoundary>
        <ErrorBoundary fallback={<div className={styles.sectionError}>Error al cargar esta sección</div>}>
          {tab === 'gastos'  && <GastosSection month={month} rate={rate} />}
        </ErrorBoundary>
        <ErrorBoundary fallback={<div className={styles.sectionError}>Error al cargar esta sección</div>}>
          {tab === 'cxc'     && <CxCSection rate={rate} />}
        </ErrorBoundary>
        <ErrorBoundary fallback={<div className={styles.sectionError}>Error al cargar esta sección</div>}>
          {tab === 'cxp'     && <CxPSection month={month} />}
        </ErrorBoundary>
        <ErrorBoundary fallback={<div className={styles.sectionError}>Error al cargar esta sección</div>}>
          {/* businessId no se usa dentro de TabCategorias (endpoint ya es tenant-scoped server-side) */}
          {tab === 'categorias' && <TabCategorias businessId={0} />}
        </ErrorBoundary>
      </div>
      <HelpButton module="finanzas" />
    </div>
  )
}
