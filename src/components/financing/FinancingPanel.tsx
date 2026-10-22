'use client'

import { useState } from 'react'
import type { BlockedProduct, FinancingAction, TicketFinancing } from '@/types/financing'
import { FinancingBadge } from './FinancingBadge'
import styles from './FinancingPanel.module.css'

interface FinancingPanelProps {
  financing: TicketFinancing | null
  /** Ejecuta la acción en el servidor; el error (409) lo muestra el padre en `error`. */
  onAction: (action: FinancingAction) => Promise<void>
  busy?: boolean
  /** Mensaje del servidor tal cual. */
  error?: string
  /** Productos que impiden el financiamiento (409). */
  blocked?: BlockedProduct[]
  /** Sin financiadora configurada no se ofrece pedir Cashea. */
  canRequest?: boolean
  /** Aviso visible mientras el ticket está aprobado (editar ítems exige aprobar otra vez). */
  editWarning?: string
  /** Ticket cobrado o cerrado: solo se muestra el estado. */
  readOnly?: boolean
}

interface ActionDef {
  action: FinancingAction
  label: string
  question: string
}

const REQUEST: ActionDef = { action: 'request', label: 'Pedir Cashea', question: '¿Pedir Cashea para este ticket? Se cobra al precio BCV completo.' }
const APPROVE: ActionDef = { action: 'approve', label: 'Aprobar', question: '¿Marcar Cashea como aprobado?' }
const REJECT: ActionDef = { action: 'reject', label: 'Rechazar', question: '¿Marcar Cashea como rechazado?' }
const REOPEN: ActionDef = { action: 'reopen', label: 'Solicitar de nuevo', question: '¿Volver a solicitar Cashea?' }
const CLEAR: ActionDef = { action: 'clear', label: 'Retirar', question: '¿Retirar Cashea de este ticket?' }

function actionsFor(financing: TicketFinancing | null): ActionDef[] {
  if (!financing) return [REQUEST]
  if (financing.status === 'requested') return [APPROVE, REJECT, CLEAR]
  if (financing.status === 'approved') return [REJECT, CLEAR]
  return [REOPEN, CLEAR]
}

/** Estado de Cashea del ticket + botones para cambiarlo, cada uno con confirmación. */
export function FinancingPanel({ financing, onAction, busy = false, error, blocked, canRequest = true, editWarning, readOnly = false }: FinancingPanelProps) {
  const [pending, setPending] = useState<ActionDef | null>(null)

  if (!financing && (!canRequest || readOnly)) return null

  const confirm = async () => {
    if (!pending) return
    const { action } = pending
    setPending(null)
    await onAction(action)
  }

  return (
    <section className={styles.panel} aria-label="Financiamiento Cashea" data-testid="financing-panel">
      <div className={styles.head}>
        <span className={styles.title}>Financiamiento</span>
        {financing ? <FinancingBadge financing={financing} /> : <span className={styles.none}>Sin Cashea</span>}
      </div>

      {financing?.status === 'approved' && editWarning && (
        <p className={styles.warning} role="status" data-testid="financing-edit-warning">{editWarning}</p>
      )}

      {!readOnly && !pending && (
        <div className={styles.actions}>
          {actionsFor(financing).map((def) => (
            <button
              key={def.action}
              type="button"
              className={def.action === 'clear' || def.action === 'reject' ? styles.btnQuiet : styles.btn}
              onClick={() => setPending(def)}
              disabled={busy}
            >
              {def.label}
            </button>
          ))}
        </div>
      )}

      {pending && (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirmar cambio de Cashea">
          <p className={styles.question}>{pending.question}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={() => { void confirm() }} disabled={busy}>
              Confirmar
            </button>
            <button type="button" className={styles.btnQuiet} onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert" data-testid="financing-error">
          <p className={styles.errorText}>{error}</p>
          {blocked && blocked.length > 0 && (
            <ul className={styles.blocked}>
              {blocked.map((p) => <li key={p.id}>{p.name}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
