'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Plus, FileText } from 'lucide-react'
import { Badge, EmptyState, useToast } from '@/components/ui'
import { GastoModal } from '@/components/finanzas/GastoModal'
import styles from './finanzas.module.css'

interface CxPItem {
  id:        number
  concepto:  string
  monto_usd: number
  categoria: string
  fecha:     string
}

export function CxPSection({ month }: { month: string }) {
  const { toast } = useToast()
  const [items, setItems]         = useState<CxPItem[]>([])
  const [total, setTotal]         = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/cxp')
      if (res.ok) {
        const j = await res.json()
        setItems(j.cxp ?? [])
        setTotal(j.total_usd ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const markPaid = async (id: number) => {
    const res = await fetch(`/api/finanzas/cxp/${id}`, { method: 'PATCH' })
    if (res.ok) {
      toast('Marcado como pagado', 'success')
      load()
    } else {
      toast('Error al actualizar', 'error')
    }
  }

  if (loading) return <div className={styles.loading}>Cargando cuentas por pagar...</div>

  return (
    <>
      <div className={styles.sectionHeader}>
        <div className={styles.summaryRow}>
          <div className={`${styles.summaryCard} ${items.length > 0 ? styles.summaryDanger : ''}`}>
            <span className={styles.summaryLabel}>Por pagar</span>
            <span className={styles.summaryValue}>${total.toFixed(2)}</span>
          </div>
        </div>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          <Plus size={15} aria-hidden="true" />
          Nueva CxP
        </button>
      </div>

      {!items.length ? (
        <EmptyState
          icon={FileText}
          title="Sin cuentas por pagar"
          description="No hay deudas pendientes."
        />
      ) : (
        <div className={styles.cxcList}>
          {items.map(item => (
            <div key={item.id} className={styles.cxcRow}>
              <div className={styles.cxcLeft}>
                <span className={styles.cxcName}>{item.concepto}</span>
                <div className={styles.cxcMeta}>
                  <Badge variant="neutral" size="sm">{item.categoria}</Badge>
                  <span>·</span>
                  <span>{new Date(item.fecha).toLocaleDateString('es-VE')}</span>
                </div>
              </div>
              <div className={styles.cxcRight}>
                <span className={styles.cxcSaldo}>${item.monto_usd.toFixed(2)}</span>
                <button className={styles.abonarBtn} onClick={() => markPaid(item.id)}>
                  <CheckCircle size={13} aria-hidden="true" />
                  Pagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <GastoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        mode="cxp"
        month={month}
        onSuccess={load}
      />
    </>
  )
}
