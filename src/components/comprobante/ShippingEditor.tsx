'use client'

import { useState } from 'react'
import { AlertTriangle, Pencil, Truck } from 'lucide-react'
import { Button } from '@/components/ui'
import type { OrderShippingFields } from '@/types/pedidos'
import styles from './ShippingEditor.module.css'

interface ShippingValues {
  nombre:    string
  cedula:    string
  telefono:  string
  direccion: string
}

type FieldKey = keyof ShippingValues

const FIELD_LABEL: Record<FieldKey, string> = {
  nombre: 'Nombre', cedula: 'Cédula', telefono: 'Teléfono', direccion: 'Dirección de envío',
}

const FIELD_TO_BODY: Record<FieldKey, string> = {
  nombre: 'ship_nombre', cedula: 'ship_cedula', telefono: 'ship_telefono', direccion: 'ship_direccion',
}

interface ErrorBody { error?: string; field?: string }

/** Orden declarado: ship_* y, si no hay, los campos viejos del pedido. */
function resolveValues(o: OrderShippingFields): ShippingValues {
  return {
    nombre:    o.ship_nombre    ?? o.recipient_name   ?? o.client_name  ?? '',
    cedula:    o.ship_cedula    ?? o.client_cedula    ?? '',
    telefono:  o.ship_telefono  ?? o.client_phone     ?? '',
    direccion: o.ship_direccion ?? o.delivery_address ?? '',
  }
}

/** Aviso al operador: la cédula del pedido es de un cliente registrado con otro nombre. */
export function CedulaAlertBadge({ show }: { show: boolean | undefined }) {
  if (!show) return null
  return (
    <span className={styles.alertBadge} data-testid="cedula-alert-badge" title="Esta cédula pertenece a un cliente registrado con otro nombre">
      <AlertTriangle size={12} aria-hidden="true" />
      Cédula con otro nombre
    </span>
  )
}

/** Método de envío tal como se eligió al crear el pedido (congelado: no cambia si el negocio lo renombra o borra). */
export function ShippingMethodTag({ label }: { label: string | null | undefined }) {
  if (!label) return null
  return (
    <span className={styles.methodTag} data-testid="order-shipping-method">
      <Truck size={12} aria-hidden="true" />
      {label}
    </span>
  )
}

interface ShippingEditorProps {
  orderId: number
  order:   OrderShippingFields
}

/**
 * Edita el snapshot de envío (ship_*) de un pedido antes de imprimir la etiqueta:
 * PATCH /api/orders/[id]/shipping. Solo envía lo que el operador cambió.
 */
export function ShippingEditor({ orderId, order }: ShippingEditorProps) {
  const [saved, setSaved]   = useState<ShippingValues>(() => resolveValues(order))
  const [draft, setDraft]   = useState<ShippingValues>(saved)
  const [open, setOpen]     = useState(false)
  const [busy, setBusy]     = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const changed = (Object.keys(draft) as FieldKey[]).filter(k => draft[k].trim() !== saved[k].trim())

  const handleSave = async () => {
    if (changed.length === 0) { setOpen(false); return }
    setBusy(true)
    setStatus(null)
    try {
      const body = Object.fromEntries(changed.map(k => [FIELD_TO_BODY[k], draft[k].trim()]))
      const res = await fetch(`/api/orders/${orderId}/shipping`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null) as ErrorBody | null
        setStatus({
          ok: false,
          text: res.status === 409
            ? 'El pedido ya salió: no se puede editar el envío.'
            : err?.error ?? 'No se pudo guardar los datos de envío.',
        })
        return
      }
      setSaved(draft)
      setOpen(false)
      setStatus({ ok: true, text: 'Datos de envío guardados. La etiqueta usará estos datos.' })
    } catch {
      setStatus({ ok: false, text: 'Error de conexión. Intenta de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.root} onClick={e => e.stopPropagation()}>
      {!open ? (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Pencil size={14} aria-hidden="true" />}
          onClick={() => { setDraft(saved); setStatus(null); setOpen(true) }}
          data-testid="shipping-edit-open"
        >
          Editar datos de envío
        </Button>
      ) : (
        <div className={styles.form} data-testid="shipping-edit-form">
          {(Object.keys(FIELD_LABEL) as FieldKey[]).map(k => (
            <label key={k} className={styles.field}>
              <span className={styles.label}>{FIELD_LABEL[k]}</span>
              {k === 'direccion' ? (
                <textarea
                  className={styles.input}
                  rows={3}
                  value={draft[k]}
                  onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))}
                  disabled={busy}
                  data-testid={`shipping-edit-${k}`}
                />
              ) : (
                <input
                  className={styles.input}
                  type="text"
                  value={draft[k]}
                  onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))}
                  disabled={busy}
                  data-testid={`shipping-edit-${k}`}
                />
              )}
            </label>
          ))}
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
            <Button variant="primary" size="sm" loading={busy} onClick={() => void handleSave()} data-testid="shipping-edit-save">
              Guardar
            </Button>
          </div>
        </div>
      )}
      {status && (
        <p className={status.ok ? styles.ok : styles.error} role="status" data-testid="shipping-edit-status">{status.text}</p>
      )}
    </div>
  )
}
