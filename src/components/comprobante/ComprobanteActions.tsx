'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, MessageCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  comprobanteWhatsappUrl, downloadComprobanteImage, fetchComprobante, printComprobante,
  whatsappBlockedReason,
} from '@/lib/comprobante'
import type { ComprobanteTicket } from '@/lib/comprobante'
import styles from './ComprobanteActions.module.css'

interface ComprobanteActionsProps {
  saleId: number
}

type Busy = 'print' | 'image' | null

/**
 * Acciones del comprobante de venta: imprimir (QZ / navegador), enviar por
 * WhatsApp y descargar imagen. Compartido por Pedidos→Cobrar y el Historial.
 */
export function ComprobanteActions({ saleId }: ComprobanteActionsProps) {
  const [ticket, setTicket]   = useState<ComprobanteTicket | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy]       = useState<Busy>(null)
  const [status, setStatus]   = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setTicket(null)
    setLoadError(null)
    fetchComprobante(saleId)
      .then(t => { if (!cancelled) setTicket(t) })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'No se pudo leer el comprobante.')
      })
    return () => { cancelled = true }
  }, [saleId])

  const handlePrint = useCallback(async () => {
    setBusy('print')
    setStatus(null)
    const r = await printComprobante(saleId)
    setStatus({ ok: r.ok, text: r.message })
    setBusy(null)
  }, [saleId])

  const handleImage = useCallback(async () => {
    if (!ticket) return
    setBusy('image')
    setStatus(null)
    try {
      await downloadComprobanteImage(ticket)
      setStatus({ ok: true, text: 'Imagen descargada.' })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'No se pudo generar la imagen.' })
    } finally {
      setBusy(null)
    }
  }, [ticket])

  const waBlocked = ticket ? whatsappBlockedReason(ticket) : null
  const waUrl     = ticket && !waBlocked ? comprobanteWhatsappUrl(ticket) : null

  return (
    <div className={styles.root}>
      <div className={styles.actions}>
        <Button
          variant="primary"
          leftIcon={<Printer size={16} aria-hidden="true" />}
          loading={busy === 'print'}
          onClick={handlePrint}
        >
          Imprimir
        </Button>
        <Button
          variant="secondary"
          leftIcon={<MessageCircle size={16} aria-hidden="true" />}
          disabled={!waUrl}
          onClick={() => { if (waUrl) window.open(waUrl, '_blank', 'noopener,noreferrer') }}
        >
          WhatsApp
        </Button>
        <Button
          variant="secondary"
          leftIcon={<Download size={16} aria-hidden="true" />}
          loading={busy === 'image'}
          disabled={!ticket}
          onClick={handleImage}
        >
          Descargar imagen
        </Button>
      </div>

      {loadError && <p className={styles.error} role="alert">{loadError}</p>}
      {!loadError && ticket && waBlocked && <p className={styles.hint}>WhatsApp no disponible: {waBlocked}</p>}
      {status && (
        <p className={status.ok ? styles.ok : styles.error} role="status">{status.text}</p>
      )}
    </div>
  )
}
