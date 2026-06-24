'use client'

import { useRef, useState, useCallback } from 'react'
import { X, Minus, Plus, ShoppingCart } from 'lucide-react'
import { useScanner } from '@/hooks/useScanner'
import type { ProductForPOS, TicketState, TicketTotals } from '@/lib/pos'
import styles from './ScannerModal.module.css'

/* ── Props ── */

interface Props {
  open: boolean
  ticket: TicketState
  totals: TicketTotals
  onAddProduct: (product: ProductForPOS) => void
  onUpdateQty: (productId: number, qty: number) => void
  onClose: () => void
  onProcesarPago: () => void
}

/* ── Formatters ── */

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtBs(bs: number): string {
  return `Bs. ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ── Audio feedback ── */

function playBeep(freq: number, durationMs: number): void {
  try {
    const ctx  = new window.AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.start()
    osc.stop(ctx.currentTime + durationMs / 1000)
    osc.onended = () => void ctx.close()
  } catch {
    // audio not supported
  }
}

/* ── Component ── */

export function ScannerModal({
  open, ticket, totals, onAddProduct, onUpdateQty, onClose, onProcesarPago,
}: Props) {
  /* Barcode lookup cache — persists across scans within one open session */
  const barcodeCache  = useRef<Map<string, ProductForPOS | null>>(new Map())
  const lookingUpRef  = useRef(false)

  const [flash, setFlash]       = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 1000)
  }

  const handleBarcode = useCallback(async (code: string) => {
    if (lookingUpRef.current) return
    lookingUpRef.current = true

    let product: ProductForPOS | null | undefined = barcodeCache.current.get(code)
    if (product === undefined) {
      // Not yet cached — fetch once
      try {
        const res  = await fetch(`/api/products/search?q=${encodeURIComponent(code)}&limit=1`)
        const data = res.ok ? (await res.json() as { products?: ProductForPOS[] }) : {}
        product = data.products?.[0] ?? null
      } catch {
        product = null
      }
      barcodeCache.current.set(code, product)
    }

    lookingUpRef.current = false

    if (product) {
      onAddProduct(product)
      setFlash(true)
      setTimeout(() => setFlash(false), 200)
      playBeep(880, 80)
      if (navigator.vibrate) navigator.vibrate([50])
    } else {
      playBeep(220, 200)
      showToast('Producto no encontrado')
    }
  }, [onAddProduct])

  const { videoContainerRef, permError } = useScanner({
    active:   open,
    onResult: handleBarcode,
  })

  if (!open) return null

  const isEmpty = ticket.items.length === 0

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Escáner de código de barras"
    >

      {/* ══ Camera zone (33dvh) ══ */}
      <div className={styles.cameraZone}>

        {/* Video stream — Quagga renders <video>+<canvas> inside this div */}
        <div
          ref={videoContainerRef}
          className={styles.video}
          aria-hidden="true"
        />

        {/* Viewfinder + dark overlay outside via box-shadow */}
        {!permError && (
          <>
            <div className={styles.viewfinder} aria-hidden="true">
              <span className={`${styles.corner} ${styles.cornerTL}`} />
              <span className={`${styles.corner} ${styles.cornerTR}`} />
              <span className={`${styles.corner} ${styles.cornerBL}`} />
              <span className={`${styles.corner} ${styles.cornerBR}`} />
              <span className={styles.scanLine} />
              {/* Green flash — viewfinder only, success scan */}
              <div
                className={`${styles.viewfinderFlash}${flash ? ` ${styles.viewfinderFlashActive}` : ''}`}
                aria-hidden="true"
              />
            </div>
            <p className={styles.scanHint} aria-hidden="true">Centra el código en el recuadro</p>
          </>
        )}

        {/* Status badge (top-left) */}
        <div className={styles.statusBadge}>
          {permError ? (
            <span className={styles.permMsg}>Activa la cámara en la configuración.</span>
          ) : (
            <>
              <span className={styles.scanDot} aria-hidden="true" />
              <span>Escaneando...</span>
            </>
          )}
        </div>

        {/* Close button (top-right) */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Cerrar escáner"
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>

        {/* Not-found toast */}
        {toastMsg && (
          <p className={styles.toast} role="status" aria-live="polite">
            {toastMsg}
          </p>
        )}
      </div>

      {/* ══ Cart zone (67dvh) ══ */}
      <div className={styles.cartZone}>

        {isEmpty ? (
          <div className={styles.cartEmpty}>
            <ShoppingCart size={36} className={styles.cartEmptyIcon} aria-hidden="true" />
            <p className={styles.cartEmptyText}>Escanea un producto para agregarlo</p>
          </div>
        ) : (
          <ul className={styles.itemList} role="list">
            {ticket.items.map(item => (
              <li
                key={`${item.product_id}-${item.variant_id ?? 0}`}
                className={styles.itemRow}
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.product_name}</span>
                  {item.variant_label && (
                    <span className={styles.itemVariant}>{item.variant_label}</span>
                  )}
                  <span className={styles.itemUnit}>
                    {fmtUsd(item.price_per_unit_usd)} / {item.unit_label}
                  </span>
                </div>

                <div className={styles.itemControls}>
                  <div className={styles.qtyControl}>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => onUpdateQty(item.product_id, item.quantity - 1)}
                      aria-label={`Reducir ${item.product_name}`}
                    >
                      <Minus size={14} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <span className={styles.qtyVal}>
                      {item.sale_mode === 'weight'
                        ? item.quantity.toFixed(2)
                        : item.quantity
                      }
                    </span>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => onUpdateQty(item.product_id, item.quantity + 1)}
                      aria-label={`Aumentar ${item.product_name}`}
                    >
                      <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </div>

                  <div className={styles.itemSubtotal}>
                    <span className={styles.itemUsd}>{fmtUsd(item.subtotal_usd)}</span>
                    <span className={styles.itemBs}>{fmtBs(item.subtotal_bs)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Sticky footer */}
        <div className={styles.cartFooter}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total</span>
            <div className={styles.totalAmounts}>
              <span className={styles.totalUsd}>{fmtUsd(totals.total_usd)}</span>
              <span className={styles.totalBs}>{fmtBs(totals.total_bs)}</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.cobrarBtn}
            onClick={onProcesarPago}
            disabled={isEmpty}
            aria-label={`Cobrar ${fmtUsd(totals.total_usd)}`}
          >
            Cobrar {fmtUsd(totals.total_usd)}
          </button>
        </div>
      </div>
    </div>
  )
}
