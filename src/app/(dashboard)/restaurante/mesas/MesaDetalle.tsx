'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { DiningTableDTO } from '@/types/restaurante'
import { STATUS_TEXT } from './PlanoSalon'
import styles from './salon.module.css'

interface MesaDetalleProps {
  table: DiningTableDTO | null
  onClose: () => void
  /** Devuelve true si el servidor aceptó el cambio. */
  onPatch: (id: number, body: Record<string, unknown>) => Promise<boolean>
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

/** Marcas manuales de una mesa: por limpiar y reserva. Ocupada y por cobrar se derivan de la cuenta (R2). */
export function MesaDetalle({ table, onClose, onPatch }: MesaDetalleProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(table?.reserved_for ?? '')
  const [phone, setPhone] = useState(table?.reserved_phone ?? '')
  const [time, setTime] = useState(hourValue(table?.reserved_at ?? null))
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

  const editable = table && (table.status === 'libre' || table.status === 'reservada' || table.status === 'por_limpiar')
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
              {table.status === 'por_limpiar' ? (
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={() => run({ cleaning_pending: false })}>Mesa lista</button>
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
                    type="button" className={`${styles.btn} ${styles.btnPrimary}`}
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
