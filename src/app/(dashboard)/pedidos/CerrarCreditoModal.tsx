'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { dual } from './money'
import { nombresDifieren, type ApiErrorBody, type PedidoClienteResumen } from './pago'
import d from './PedidoPago.module.css'

interface CerrarCreditoModalProps {
  open:   boolean
  /** client_name = el nombre escrito en el pedido (puede no coincidir con el del cliente enlazado). */
  order:  { id: number; order_number: string; total_usd: number; rate: number; client_name?: string | null }
  /** Cliente enlazado al pedido (el que recibe el crédito); se envía como confirmed_client_id. */
  client: PedidoClienteResumen | null
  onClose: () => void
  /** El servidor cerró el pedido a crédito: el padre refresca el pago. */
  onDone:  () => void
  /** CLIENT_NOT_CONFIRMED: el cliente del pedido cambió; el padre lo vuelve a leer. */
  onReloadClient: () => void
}

const PRESETS = [7, 14, 21, 30] as const
type Plazo = (typeof PRESETS)[number] | 'fecha'

/** Cerrar a crédito: el personal confirma a QUÉ cliente se le carga (nombre y cédula a la vista) y elige el plazo. */
export function CerrarCreditoModal({ open, order, client, onClose, onDone, onReloadClient }: CerrarCreditoModalProps) {
  const [plazo, setPlazo]   = useState<Plazo | null>(null)
  const [fecha, setFecha]   = useState('')
  const [notas, setNotas]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState<{ message: string; code?: string } | null>(null)
  const [verificado, setVerificado] = useState(false)

  useEffect(() => { if (!open) { setPlazo(null); setFecha(''); setNotas(''); setBusy(false); setError(null); setVerificado(false) } }, [open])
  // Si el cliente enlazado cambia (CLIENT_NOT_CONFIRMED → actualizar), la verificación anterior ya no vale.
  useEffect(() => { setVerificado(false) }, [client?.id])

  const sinCredito = client?.credit_authorized === false
  // Nombre escrito en el pedido ≠ nombre del cliente enlazado (sin tildes, mayúsculas ni espacios extra): se avisa y se exige la casilla.
  const nombreDistinto = !!client && nombresDifieren(order.client_name, client.name)
  const plazoOk    = plazo !== null && (plazo !== 'fecha' || fecha !== '')
  const puede      = !!client && !sinCredito && plazoOk && (!nombreDistinto || verificado) && !busy

  const confirmar = async (): Promise<void> => {
    if (!client || !puede) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${order.id}/cerrar-credito`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          confirmed_client_id: client.id,
          ...(plazo === 'fecha' ? { due_date: new Date(`${fecha}T23:59:59`).toISOString() } : { credit_days: plazo }),
          ...(notas.trim() ? { credit_notes: notas.trim() } : {}),
        }),
      })
      if (res.ok) { onDone(); return }
      const body = await res.json().catch(() => null) as ApiErrorBody | null
      // 400 INVALID_BODY, 422 CLIENT_NOT_CONFIRMED, límite, plazo…: el mensaje del servidor tal cual.
      setError({ message: body?.error ?? 'No se pudo cerrar el pedido a crédito.', code: body?.code })
    } catch {
      setError({ message: 'Error de conexión. Intenta de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <>
      <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Cancelar</Button>
      <Button variant="primary" size="md" onClick={() => { void confirmar() }} disabled={!puede} loading={busy} data-testid="credito-confirmar">
        Cerrar a crédito
      </Button>
    </>
  )

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose() }} title={`Cerrar a crédito · ${order.order_number}`} size="md" footer={footer}>
      <div className={d.cuerpo} data-testid="credito-modal">
        {client ? (
          <section className={d.clienteConfirm} aria-label="Cliente que recibe el crédito" data-testid="credito-cliente">
            <span>Cliente que recibe el crédito</span>
            <strong data-testid="credito-cliente-nombre">{client.name}</strong>
            <span data-testid="credito-cliente-cedula">Cédula: {client.cedula ?? 'sin cédula registrada'}</span>
            <span>
              Crédito disponible: {client.credit_authorized === false ? 'no autorizado'
                : client.credito_disponible_usd === null || client.credito_disponible_usd === undefined ? 'sin tope'
                : dual(client.credito_disponible_usd, order.rate)}
            </span>
          </section>
        ) : (
          <p className={d.aviso} role="alert">Este pedido no tiene un cliente enlazado: créalo primero.</p>
        )}
        {nombreDistinto && client && (
          <div className={d.campo}>
            <p className={d.aviso} role="alert" data-testid="credito-aviso-nombre">
              El pedido dice «{order.client_name?.trim()}»; el cliente enlazado es «{client.name}». Verifica antes de cerrar a crédito.
            </p>
            <label className={d.verifica}>
              <input type="checkbox" checked={verificado} onChange={e => setVerificado(e.target.checked)} data-testid="credito-verifique" />
              Verifiqué que es el mismo cliente
            </label>
          </div>
        )}
        {sinCredito && <p className={d.aviso} role="alert" data-testid="credito-sin-autorizar">Este cliente no tiene crédito autorizado: un administrador debe autorizarlo en su ficha.</p>}

        <div className={d.clienteConfirm}>
          <span>Total que queda a crédito</span>
          <strong data-testid="credito-total">{dual(order.total_usd, order.rate)}</strong>
        </div>

        <div className={d.campo}>
          <span className={d.etiqueta}>Plazo</span>
          <div className={d.plazo} role="radiogroup" aria-label="Plazo del crédito">
            {PRESETS.map(p => (
              <button key={p} type="button" role="radio" aria-checked={plazo === p} className={`${d.plazoBtn} ${plazo === p ? d.plazoBtnOn : ''}`} onClick={() => setPlazo(p)} data-testid={`credito-dias-${p}`}>
                {p} días
              </button>
            ))}
            <button type="button" role="radio" aria-checked={plazo === 'fecha'} className={`${d.plazoBtn} ${plazo === 'fecha' ? d.plazoBtnOn : ''}`} onClick={() => setPlazo('fecha')} data-testid="credito-dias-fecha">
              Otra fecha
            </button>
          </div>
          {plazo === 'fecha' && (
            <input type="date" className={d.entrada} value={fecha} onChange={e => setFecha(e.target.value)} aria-label="Fecha de vencimiento" data-testid="credito-fecha" />
          )}
        </div>

        <div className={d.campo}>
          <label className={d.etiqueta} htmlFor="credito-notas">Notas <span>(opcional)</span></label>
          <textarea id="credito-notas" className={d.texto} value={notas} onChange={e => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: paga el viernes" data-testid="credito-notas" />
        </div>

        {error && (
          <div className={d.campo}>
            <p className={d.errorInline} role="alert" data-testid="credito-error">{error.message}</p>
            {error.code === 'CLIENT_NOT_CONFIRMED' && (
              <button type="button" className={d.accionSecundaria} onClick={() => { setError(null); onReloadClient() }} data-testid="credito-recargar-cliente">
                Actualizar cliente del pedido
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
