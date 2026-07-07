'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Download, Eye, EyeOff, MessageSquare, QrCode, X } from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import styles from './catalogo-admin.module.css'

/* ── Types ───────────────────────────────────────────────── */

type CatalogVisibility = 'visible' | 'hidden' | 'on_request'

interface TopProduct {
  id:                 number
  name:               string
  image_url:          string | null
  order_count:        number
  catalog_visibility: CatalogVisibility
}

interface MetricsData {
  period:      string
  catalog_url: string | null
  qr_data:     string | null
  orders:      { this_month: number }
  top_products: TopProduct[]
  products_summary: { total: number; visible: number; hidden: number; on_request: number }
}

/* ── Helpers ─────────────────────────────────────────────── */

const VIS_LABEL: Record<CatalogVisibility, string> = {
  visible:    'Visible',
  hidden:     'Oculto',
  on_request: 'Consultar',
}

const VIS_BADGE_CLASS: Record<CatalogVisibility, string> = {
  visible:    styles.visBadgeVisible,
  hidden:     styles.visBadgeHidden,
  on_request: styles.visBadgeOnRequest,
}

/* ── Content ─────────────────────────────────────────────── */

function CatalogoAdminContent() {
  const { toast } = useToast()
  const [data,        setData]        = useState<MetricsData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState<number[]>([])
  const [updating,    setUpdating]    = useState(false)
  const [togglingId,  setTogglingId]  = useState<number | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/catalogo/metrics')
      if (res.ok) {
        const j = await res.json()
        if (j.ok) { setData(j); setSelected([]) }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function callBulkVisibility(ids: number[], visibility: CatalogVisibility): Promise<boolean> {
    const res = await fetch('/api/products/bulk-visibility', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ product_ids: ids, catalog_visibility: visibility }),
    })
    return res.ok
  }

  async function quickToggle(productId: number, current: CatalogVisibility) {
    setTogglingId(productId)
    try {
      const next: CatalogVisibility = current === 'visible' ? 'hidden' : 'visible'
      const ok = await callBulkVisibility([productId], next)
      if (ok) { toast('Visibilidad actualizada', 'success'); await load() }
      else toast('Error al actualizar', 'error')
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  async function bulkUpdate(visibility: CatalogVisibility) {
    if (selected.length === 0) return
    setUpdating(true)
    try {
      const ok = await callBulkVisibility(selected, visibility)
      if (ok) {
        toast(`${selected.length} productos actualizados`, 'success')
        await load()
        setSelected([])
      } else {
        toast('Error al actualizar', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setUpdating(false)
    }
  }

  function handleDownloadQr() {
    if (!data?.qr_data) return
    const a = document.createElement('a')
    a.href = data.qr_data
    a.download = 'qr-catalogo.png'
    a.click()
  }

  function toggleSelect(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleAll() {
    const products = data?.top_products ?? []
    setSelected(prev => prev.length === products.length ? [] : products.map(p => p.id))
  }

  if (loading) return <div className={styles.loading}>Cargando catálogo digital…</div>
  if (!data)   return <div className={styles.loading}>Sin datos disponibles.</div>

  const { products_summary: sum, top_products: products } = data
  const qrUrl = data.qr_data ?? null

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Catálogo Digital</h1>
          <p className={styles.pageSub}>Gestión de visibilidad · {data.period}</p>
        </div>
        <div className={styles.headerActions}>
          {data.catalog_url && (
            <a
              href={data.catalog_url}
              target="_blank"
              rel="noreferrer"
              className={styles.viewLink}
            >
              <ExternalLink size={14} aria-hidden="true" />
              Ver catálogo
            </a>
          )}
          {qrUrl && (
            <button className={styles.qrBtn} onClick={() => setQrModalOpen(true)}>
              <QrCode size={14} aria-hidden="true" />
              QR
            </button>
          )}
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Pedidos este mes</span>
          <span className={styles.kpiValue}>{data.orders.this_month}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Visibles</span>
          <span className={`${styles.kpiValue} ${styles.kpiSuccess}`}>{sum.visible}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Ocultos</span>
          <span className={`${styles.kpiValue} ${styles.kpiMuted}`}>{sum.hidden}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Consultar</span>
          <span className={`${styles.kpiValue} ${styles.kpiWarning}`}>{sum.on_request}</span>
        </div>
      </div>

      {/* ── Top productos ── */}
      {products.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Top productos más pedidos</h2>

          {selected.length > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selected.length} seleccionados</span>
              <button
                className={styles.bulkBtn}
                onClick={() => bulkUpdate('visible')}
                disabled={updating}
              >
                <Eye size={13} aria-hidden="true" />
                Publicar
              </button>
              <button
                className={styles.bulkBtn}
                onClick={() => bulkUpdate('hidden')}
                disabled={updating}
              >
                <EyeOff size={13} aria-hidden="true" />
                Ocultar
              </button>
              <button
                className={styles.bulkBtn}
                onClick={() => bulkUpdate('on_request')}
                disabled={updating}
              >
                <MessageSquare size={13} aria-hidden="true" />
                Consultar
              </button>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={`${styles.th} ${styles.colCheck}`}>
                    <input
                      type="checkbox"
                      checked={products.length > 0 && selected.length === products.length}
                      onChange={toggleAll}
                      aria-label={`Seleccionar los ${products.length} mostrados`}
                    />
                  </th>
                  <th className={styles.th}>Producto</th>
                  <th className={`${styles.th} ${styles.colCenter} ${styles.thHidden}`}>Pedidos</th>
                  <th className={`${styles.th} ${styles.colCenter}`}>Visibilidad</th>
                  <th className={`${styles.th} ${styles.colRight}`}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td className={`${styles.td} ${styles.colCheck}`} data-label="Sel.">
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        aria-label={`Seleccionar ${p.name}`}
                      />
                    </td>
                    <td className={styles.td} data-label="Producto">
                      <span className={styles.productName}>{p.name}</span>
                    </td>
                    <td className={`${styles.td} ${styles.colCenter} ${styles.tdHidden}`} data-label="Pedidos">
                      <span className={styles.orderCount}>{p.order_count}</span>
                    </td>
                    <td className={`${styles.td} ${styles.colCenter}`} data-label="Visibilidad">
                      <span className={`${styles.visBadge} ${VIS_BADGE_CLASS[p.catalog_visibility]}`}>
                        {VIS_LABEL[p.catalog_visibility]}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.colRight}`} data-label="Acción">
                      <button
                        className={styles.actionBtn}
                        disabled={togglingId === p.id}
                        onClick={() => quickToggle(p.id, p.catalog_visibility)}
                      >
                        {p.catalog_visibility === 'visible'
                          ? <><EyeOff size={12} aria-hidden="true" /> Ocultar</>
                          : <><Eye    size={12} aria-hidden="true" /> Publicar</>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── QR modal ── */}
      {qrModalOpen && qrUrl && (
        <>
          <div
            className={styles.qrModalBackdrop}
            onClick={() => setQrModalOpen(false)}
          />
          <div className={styles.qrModal}>
            <div className={styles.qrModalHeader}>
              <h3 className={styles.qrModalTitle}>Código QR del catálogo</h3>
              <button
                className={styles.qrModalClose}
                onClick={() => setQrModalOpen(false)}
                aria-label="Cerrar"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.qrModalBody}>
              <img
                src={qrUrl}
                alt="QR del catálogo"
                width={200}
                height={200}
                className={styles.qrModalImg}
              />
              <p className={styles.qrModalUrl}>{data?.catalog_url}</p>
            </div>
            <div className={styles.qrModalFooter}>
              <button
                className={styles.qrModalDownload}
                onClick={handleDownloadQr}
              >
                <Download size={14} aria-hidden="true" />
                Descargar PNG
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}

/* ── Page export ─────────────────────────────────────────── */

export default function CatalogoAdminPage() {
  return (
    <ToastProvider>
      <CatalogoAdminContent />
    </ToastProvider>
  )
}
