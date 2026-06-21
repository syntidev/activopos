'use client'

import { useState, useEffect } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Button }          from '@/components/ui/Button'
import { CxCSection }      from './CxCSection'
import { CxPSection }      from './CxPSection'
import { GastosSection }   from './GastosSection'
import { ResumenSection }  from './ResumenSection'
import styles from './finanzas.module.css'

const TABS = [
  { key: 'resumen', label: 'Resumen'     },
  { key: 'gastos',  label: 'Gastos'      },
  { key: 'cxc',     label: 'Por Cobrar'  },
  { key: 'cxp',     label: 'Por Pagar'   },
] as const

type TabKey = typeof TABS[number]['key']

export default function FinanzasPage() {
  const [tab, setTab]   = useState<TabKey>('resumen')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [rate, setRate] = useState(0)

  useEffect(() => {
    fetch('/api/rates/bcv')
      .then(r => r.json())
      .then(j => { if (j.ok && j.rate) setRate(Number(j.rate)) })
  }, [])

  return (
    <div className={`${styles.page} page-container`}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Finanzas</h1>
        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
            disabled
            title="Exportar Excel — próximamente"
          >
            Excel
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
        {tab === 'cxc'     && <CxCSection rate={rate} />}
        {tab === 'cxp'     && <CxPSection month={month} />}
        {tab === 'gastos'  && <GastosSection month={month} />}
        {tab === 'resumen' && <ResumenSection month={month} rate={rate} />}
      </div>
    </div>
  )
}
