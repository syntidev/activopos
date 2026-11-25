'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import type { DiningTableDTO } from '@/types/restaurante'
import { STATUS_TEXT } from './PlanoSalon'
import styles from './salon.module.css'

export interface OpenAccountBody {
  guests: number
  waiter_id?: number
  client_name?: string
  confirm_clean: boolean
}

interface MesaDetalleProps {
  table: DiningTableDTO | null
  onClose: () => void
  /** Devuelve true si el servidor aceptó el cambio. */
  onPatch: (id: number, body: Record<string, unknown>) => Promise<boolean>
  waiters: ReadonlyArray<{ id: number; name: string }>
  currentUserId: number
  canPickWaiter: boolean
  /** Abre la cuenta y lleva a ella. Devuelve true si se abrió. */
  onOpenAccount: (tableId: number, body: OpenAccountBody) => Promise<boolean>
}

function hourValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Hoy a la hora indicada ("20:30"), en ISO. */
function todayAt(hhmm: string): string | null {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** Mesa sin cuenta: abrir la cuenta y las marcas manuales (por limpiar, reserva). Ocupada y por cobrar se derivan de la cuenta. */
export function MesaDetalle({ table, onClose, onPatch, waiters, currentUserId, canPickWaiter, onOpenAccount }: MesaDetalleProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(table?.reserved_for ?? '')
  const [phone, setPhone] = useState(table?.reserved_phone ?? '')
  const [time, setTime] = useState(hourValue(table?.reserved_at ?? null))
  const [guests, setGuests] = useState(table ? Math.min(2, table.capacity) : 2)
  const [waiterId, setWaiterId] = useState(currentUserId)
  const [client, setClient] = useState(table?.reserved_for ?? '')
  const [clean, setClean] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (table && !dlg.open) dlg.showModal()
    if (!table && dlg.open) dlg.close()
  }, [table])

  async function run(body: Record<string, unknown>): Promise<void> {
    if (!table || busy) return
    setBusy(true)
    const ok = await onPatch(table.id, body)
    setBusy(false)
    if (ok) onClose()
  }

  async function open(): Promise<void> {
    if (!table || busy) return
    setBusy(true)
    const ok = await onOpenAccount(table.id, {
      guests, confirm_clean: clean,
      ...(canPickWaiter ? { waiter_id: waiterId } : {}),
      ...(client.trim() ? { client_name: client.trim() } : {}),
    })
    setBusy(false)
    if (!ok) onClose() // el salón se volvió a leer: si otro la abrió primero, la mesa ya aparece ocupada
  }

  const editable = table && (table.status === 'libre' || table.status === 'reservada' || table.status === 'por_limpiar')
  const maxGuests = table ? table.capacity + 4 : 1
  const iso = time ? todayAt(time) : null

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="rs-detalle-titulo"
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose() }}
    >
      {table && (
        <div className={styles.sheet}>
          <header className={styles.sheetHead}>
            <div>
              <h2 id="rs-detalle-titulo" className={styles.sheetTitle}>Mesa {table.label}</h2>
              <p className={styles.sheetSub}>{table.area_name} · {table.capacity} {table.capacity === 1 ? 'persona' : 'personas'}</p>
            </div>
            <span className={`${styles.chip} ${styles[`chip_${table.status}`]}`}>{STATUS_TEXT[table.status]}</span>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
          </header>

          {editable ? (
            <div className={styles.sheetBody}>
              <fieldset className={styles.fieldset}>
                <legend className={styles.fsLegend}>Abrir cuenta</legend>
                <div className={styles.field}><span id="rs-comensales">Comensales (capacidad {table.capacity})</span>
                  <div className={styles.stepper} role="group" aria-labelledby="rs-comensales">
                    <button type="button" className={styles.stepBtn} aria-label="Menos comensales" disabled={guests <= 1} onClick={() => setGuests(g => g - 1)}><Minus size={18} aria-hidden="true" /></button>
                    <output className={styles.stepVal} aria-live="polite">{guests}</output>
                    <button type="button" className={styles.stepBtn} aria-label="Más comensales" disabled={guests >= maxGuests} onClick={() => setGuests(g => g + 1)}><Plus size={18} aria-hidden="true" /></button>
                  </div>
                </div>
                {canPickWaiter && waiters.length > 0 && (
                  <label className={styles.field}><span>Mesonero</span>
                    <select className={styles.input} value={waiterId} onChange={e => setWaiterId(Number(e.target.value))}>
                      {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </label>
                )}
                <label className={styles.field}><span>Cliente (opcional)</span>
                  <input className={styles.input} value={client} onChange={e => setClient(e.target.value)} maxLength={120} autoComplete="off" placeholder="Nombre" />
                </label>
                {table.status === 'por_limpiar' && (
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={clean} onChange={e => setClean(e.target.checked)} />
                    <span>Ya está limpia</span>
                  </label>
                )}
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || (table.status === 'por_limpiar' && !clean)} onClick={() => { void open() }}>
                  Abrir cuenta
                </button>
              </fieldset>

              {table.status === 'por_limpiar' ? (
                <button type="button" className={styles.btn} disabled={busy} onClick={() => run({ cleaning_pending: false })}>Mesa lista</button>
              ) : (
                <button type="button" className={styles.btn} disabled={busy} onClick={() => run({ cleaning_pending: true })}>Marcar por limpiar</button>
              )}

              <fieldset className={styles.fieldset}>
                <legend className={styles.fsLegend}>Reserva</legend>
                <label className={styles.field}><span>A nombre de</span>
                  <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="off" />
                </label>
                <div className={styles.fieldRow}>
                  <label className={styles.field}><span>Hora</span>
                    <input className={styles.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
                  </label>
                  <label className={styles.field}><span>Teléfono</span>
                    <input className={styles.input} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} autoComplete="off" />
                  </label>
                </div>
                <div className={styles.fieldRow}>
                  <button
                    type="button" className={styles.btn}
                    disabled={busy || name.trim().length === 0}
                    onClick={() => run({ reserved_for: name.trim(), reserved_phone: phone.trim() || null, reserved_at: iso })}
                  >
                    {table.reserved_for ? 'Actualizar reserva' : 'Guardar reserva'}
                  </button>
                  {table.reserved_for && (
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={busy} onClick={() => run({ reserved_for: null })}>Quitar reserva</button>
                  )}
                </div>
              </fieldset>
            </div>
          ) : (
            <p className={styles.sheetSub}>Esta mesa tiene una cuenta abierta.</p>
          )}
        </div>
      )}
    </dialog>
  )
}
