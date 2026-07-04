'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileSpreadsheet, Check } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { Button }          from '@/components/ui/Button'
import { CxCSection }      from './CxCSection'
import { CxPSection }      from './CxPSection'
import { GastosSection }   from './GastosSection'
import { ResumenSection }  from './ResumenSection'
import { PylSection }      from './PylSection'
import styles from './finanzas.module.css'

const TABS = [
  { key: 'resumen', label: 'Resumen'               },
  { key: 'pyl',     label: 'Estado de Resultados'  },
  { key: 'gastos',  label: 'Gastos'                },
  { key: 'cxc',     label: 'Por Cobrar'            },
  { key: 'cxp',     label: 'Por Pagar'             },
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

  useEffect(() => {
    fetch('/api/rates/bcv')
      .then(r => r.json())
      .then(j => { if (j.ok && j.rate) setRate(Number(j.rate)) })
  }, [])

  const handleExportExcel = useCallback(() => {
    if (exportingExcel) return
    setExportingExcel(true)
    const [year, mon] = month.split('-')
    const lastDay = new Date(Number(year), Number(mon), 0).getDate()
    const from = `${month}-01`
    const to   = `${month}-${String(lastDay).padStart(2, '0')}`
    window.location.href = `/api/finanzas/export?from=${from}&to=${to}`
    setTimeout(() => {
      setExportingExcel(false)
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 2000)
    }, 1500)
  }, [month, exportingExcel])

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
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
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
      </div>
    </div>
  )
}
