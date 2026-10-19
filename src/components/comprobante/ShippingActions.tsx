'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardCopy, Tag } from 'lucide-react'
import { Button } from '@/components/ui'
import { printShippingLabelThermal } from '@/lib/thermal-print'
import { shippingCopyText } from '@/lib/shipping'
import type { ShippingData } from '@/lib/shipping'
import type { ThermalCodepage } from '@/types/thermal'
import styles from './ShippingActions.module.css'

interface ShippingActionsProps {
  /** Pedido (tarjeta de Pedidos) o la venta que lo cobró (Comprobante / Historial). */
  orderId?: number
  saleId?: number
  /** El padre ya sabe que es envío: se muestra sin consultar y los datos se leen al pulsar. */
  knownDelivery?: boolean
}

interface ShippingResponse {
  ok:           boolean
  delivery:     boolean
  business_id?: number
  codepage?:    ThermalCodepage
  data?:        ShippingData
}

/**
 * Etiqueta de envío 58 mm y "Copiar datos de envío". Solo para pedidos con envío:
 * si el pedido/venta no es envío, no renderiza nada. Sin precios ni totales.
 */
export function ShippingActions({ orderId, saleId, knownDelivery = false }: ShippingActionsProps) {
  const [visible, setVisible] = useState(knownDelivery)
  const [busy, setBusy]       = useState(false)
  // Bultos: dato del momento de despachar, solo para esta impresión/copia (no se guarda).
  const [bundles, setBundles] = useState('')
  const [status, setStatus]   = useState<{ ok: boolean; text: string } | null>(null)

  const query = orderId ? `order_id=${orderId}` : `sale_id=${saleId ?? 0}`

  const load = useCallback(async (): Promise<ShippingResponse> => {
    const res = await fetch(`/api/shipping-data?${query}`, { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) throw new Error(`No se pudieron leer los datos de envío (HTTP ${res.status}).`)
    return await res.json() as ShippingResponse
  }, [query])

  useEffect(() => {
    if (knownDelivery) return
    let cancelled = false
    load()
      .then(r => { if (!cancelled) setVisible(r.delivery) })
      .catch(() => { if (!cancelled) setVisible(false) })
    return () => { cancelled = true }
  }, [knownDelivery, load])

  const handlePrint = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const r = await load()
      if (!r.delivery || !r.data || r.business_id === undefined) {
        setStatus({ ok: false, text: 'Este pedido no es un envío.' })
        return
      }
      const out = await printShippingLabelThermal(r.data, r.business_id, r.codepage ?? 'cp858')
      if (out.state === 'printed') setStatus({ ok: true, text: `Etiqueta impresa en ${out.printer}.` })
      else if (out.state === 'skipped') setStatus({ ok: false, text: 'La impresión térmica está apagada en este equipo (Configuración → Impresión). Usa "Copiar datos de envío".' })
      else setStatus({ ok: false, text: out.sent ? `${out.message} Revisa la impresora antes de reintentar.` : out.message })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'No se pudo imprimir la etiqueta.' })
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    setStatus(null)
    try {
      const r = await load()
      if (!r.delivery || !r.data) { setStatus({ ok: false, text: 'Este pedido no es un envío.' }); return }
      await navigator.clipboard.writeText(shippingCopyText({ ...r.data, bundles }))
      setStatus({ ok: true, text: 'Datos de envío copiados.' })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'No se pudo copiar.' })
    }
  }

  if (!visible) return null

  return (
    <div className={styles.root}>
      <div className={styles.bundlesRow}>
        <label className={styles.bundlesLabel} htmlFor={`bundles-${query}`}>Bultos (opcional)</label>
        <input
          id={`bundles-${query}`}
          type="text"
          inputMode="numeric"
          className={styles.bundlesInput}
          value={bundles}
          onChange={e => setBundles(e.target.value.slice(0, 10))}
          onClick={e => e.stopPropagation()}
          placeholder="Ej. 2"
        />
      </div>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Tag size={14} aria-hidden="true" />}
          loading={busy}
          onClick={(e) => { e.stopPropagation(); void handlePrint() }}
        >
          Imprimir etiqueta de envío
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ClipboardCopy size={14} aria-hidden="true" />}
          onClick={(e) => { e.stopPropagation(); void handleCopy() }}
        >
          Copiar datos de envío
        </Button>
      </div>
      {status && <p className={status.ok ? styles.ok : styles.error} role="status">{status.text}</p>}
    </div>
  )
}
