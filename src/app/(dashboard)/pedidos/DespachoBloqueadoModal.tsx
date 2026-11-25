'use client'

import { useEffect, useRef, useState } from 'react'
import d from './PedidoPago.module.css'

interface DespachoBloqueadoModalProps {
  open:         boolean
  orderNumber:  string
  /** Motivo del 422 tal cual lo devuelve el servidor. */
  message:      string
  /** Solo un administrador puede despachar sin cobrar. */
  isAdmin:      boolean
  busy:         boolean
  /** Error del intento de despacho con motivo (403/422), tal cual. */
  error:        string
  onCobrar:     () => void
  onOverride:   (reason: string) => void
  onClose:      () => void
}

const MOTIVO_MIN = 3

/** Aviso cuando avanzar un pedido sin cobrar es rechazado (422 PAYMENT_REQUIRED). Admin: despachar sin cobrar con motivo; cajero: solo cobrar. */
export function DespachoBloqueadoModal({ open, orderNumber, message, isAdmin, busy, error, onCobrar, onOverride, onClose }: DespachoBloqueadoModalProps) {
  const [motivo, setMotivo] = useState('')
  const primeroRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) { setMotivo(''); return }
    const previo = document.activeElement as HTMLElement | null
    primeroRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previo?.focus() }
  }, [open, busy, onClose])

  if (!open) return null
  const valido = motivo.trim().length >= MOTIVO_MIN

  return (
    <div className={d.bloqueoOverlay} onClick={() => { if (!busy) onClose() }}>
      <div className={d.bloqueo} role="alertdialog" aria-modal="true" aria-label={`Pedido ${orderNumber} sin cobrar`} data-testid="despacho-bloqueado" onClick={e => e.stopPropagation()}>
        <h2 className={d.bloqueoTitulo}>Pedido {orderNumber} sin cobrar</h2>
        <p className={d.bloqueoMsg} role="alert" data-testid="despacho-motivo">{message}</p>

        {isAdmin && (
          <div className={d.campo}>
            <label className={d.etiqueta} htmlFor="despacho-motivo-input">Motivo para despachar sin cobrar (obligatorio)</label>
            <textarea
              id="despacho-motivo-input"
              className={d.texto}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              maxLength={200}
              placeholder="Ej.: cliente frecuente, paga contra entrega"
              data-testid="despacho-motivo-input"
            />
            <p className={d.etiqueta}>Queda registrado en la bitácora con tu usuario.</p>
          </div>
        )}
        {error && <p className={d.errorInline} role="alert" data-testid="despacho-error">{error}</p>}

        <div className={d.acciones}>
          <button type="button" className={d.accionSecundaria} onClick={onClose} disabled={busy}>Cerrar</button>
          {isAdmin && (
            <button type="button" className={d.accionPeligro} onClick={() => onOverride(motivo.trim())} disabled={busy || !valido} data-testid="despachar-sin-cobrar">
              Despachar sin cobrar
            </button>
          )}
          <button type="button" className={d.accionPrimaria} onClick={onCobrar} disabled={busy} ref={primeroRef} data-testid="despacho-cobrar">
            Cobrar ahora
          </button>
        </div>
      </div>
    </div>
  )
}
