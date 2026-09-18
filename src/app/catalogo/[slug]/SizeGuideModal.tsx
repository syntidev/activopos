'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import styles from './SizeGuideModal.module.css'

interface SizeGuideEntry {
  local:      string
  equivalent: string
}

interface SizeGuideData {
  label_local:      string
  label_equivalent: string
  entries:          SizeGuideEntry[]
}

interface Props {
  open:     boolean
  category: string
  onClose:  () => void
}

// Tabla de referencia (EU↔US, talla↔P/M/G) por categoría de preset — dato
// genérico de industria, no de tenant. Fetch perezoso: solo pega al abrir el
// modal, no en cada render del detalle de producto.
export function SizeGuideModal({ open, category, onClose }: Props) {
  const [data,    setData]    = useState<SizeGuideData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || data) return
    setLoading(true)
    fetch(`/api/size-guide?category=${encodeURIComponent(category)}`)
      .then(r => r.ok ? r.json() : null)
      .then((j: SizeGuideData | null) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [open, category, data])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }} role="presentation">
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Guía de tallas">
        <div className={styles.header}>
          <h2 className={styles.title}>Guía de tallas</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <p className={styles.status}>Cargando…</p>
        ) : !data ? (
          <p className={styles.status}>No hay guía de tallas disponible.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{data.label_local}</th>
                  <th>{data.label_equivalent}</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(e => (
                  <tr key={e.local}>
                    <td>{e.local}</td>
                    <td>{e.equivalent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={styles.disclaimer}>
          Referencial — la equivalencia real puede variar según la marca.
        </p>
      </div>
    </div>
  )
}
