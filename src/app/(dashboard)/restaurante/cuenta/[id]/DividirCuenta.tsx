'use client'

import { useState } from 'react'
import { formatBs, formatUsd } from '@/lib/restaurante'
import type { AccountDTO } from '@/types/restaurante'
import { pendingUsd } from './PreCuenta'
import styles from './cobro.module.css'

const MAX_PARTS = 10
const MAX_GROUPS = 4
const r2 = (n: number): number => Math.round(n * 100) / 100

export type SplitChoice =
  | { kind: 'items'; groups: Array<Array<{ item_id: number; quantity: number }>> }
  | { kind: 'equal'; parts: number }

interface Props { account: AccountDTO; busy: boolean; onConfirm: (choice: SplitChoice) => void }

/** Dividir la cuenta: por ítems (cada ítem a una subcuenta; N ventas) o en partes iguales (1 venta y N pagos, hasta 10). */
export function DividirCuenta({ account, busy, onConfirm }: Props) {
  const [mode, setMode] = useState<'items' | 'equal'>('items')
  const [parts, setParts] = useState(2)
  const rows = account.items.filter(i => i.kds_status !== 'void' && i.quantity - i.billed_quantity > 0.0005)
  const [assign, setAssign] = useState<Record<number, number>>(() => Object.fromEntries(rows.map(i => [i.id, 0])))
  const total = pendingUsd(account)

  const sums = Array.from({ length: MAX_GROUPS }, (_, g) =>
    r2(rows.filter(i => assign[i.id] === g).reduce((a, i) => a + (i.quantity - i.billed_quantity) * i.price_per_unit_usd, 0)))
  const used = sums.map((s, g) => ({ g, s })).filter(x => x.s > 0)
  const per = r2(total / parts)

  function confirmItems(): void {
    const groups = used.map(({ g }) => rows.filter(i => assign[i.id] === g).map(i => ({ item_id: i.id, quantity: Number((i.quantity - i.billed_quantity).toFixed(3)) })))
    onConfirm({ kind: 'items', groups })
  }

  return (
    <div className={styles.split}>
      <div className={styles.seg} role="radiogroup" aria-label="Cómo dividir">
        <button type="button" role="radio" aria-checked={mode === 'items'} className={`${styles.segBtn} ${mode === 'items' ? styles.segOn : ''}`} onClick={() => setMode('items')}>Por ítems</button>
        <button type="button" role="radio" aria-checked={mode === 'equal'} className={`${styles.segBtn} ${mode === 'equal' ? styles.segOn : ''}`} onClick={() => setMode('equal')}>Partes iguales</button>
      </div>

      {mode === 'items' ? (
        <>
          <ul className={styles.preLines}>
            {rows.map(i => (
              <li key={i.id} className={styles.splitLine}>
                <span className={styles.preName}>{Number((i.quantity - i.billed_quantity).toFixed(3))}× {i.product_name}</span>
                <select className={styles.select} aria-label={`Subcuenta de ${i.product_name}`} value={assign[i.id]} onChange={e => setAssign(a => ({ ...a, [i.id]: Number(e.target.value) }))}>
                  {Array.from({ length: MAX_GROUPS }, (_, g) => <option key={g} value={g}>Subcuenta {g + 1}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <ul className={styles.sums}>
            {used.map(({ g, s }) => <li key={g}><span>Subcuenta {g + 1}</span><strong>{formatUsd(s)}<small>{formatBs(s * account.rate_used)}</small></strong></li>)}
          </ul>
          <button type="button" className={styles.primary} disabled={busy || used.length < 2} onClick={confirmItems}>
            {used.length < 2 ? 'Asigna ítems a al menos 2 subcuentas' : `Crear ${used.length} cobros`}
          </button>
        </>
      ) : (
        <>
          <div className={styles.stepper}>
            <button type="button" className={styles.stepBtn} aria-label="Menos partes" disabled={parts <= 2} onClick={() => setParts(p => p - 1)}>−</button>
            <output className={styles.stepVal}>{parts} partes</output>
            <button type="button" className={styles.stepBtn} aria-label="Más partes" disabled={parts >= MAX_PARTS} onClick={() => setParts(p => p + 1)}>+</button>
          </div>
          <p className={styles.hint}>{formatUsd(per)} por persona · {formatBs(per * account.rate_used)}. Es una sola venta con {parts} pagos. Para más de {MAX_PARTS} comensales, divide por ítems.</p>
          <button type="button" className={styles.primary} disabled={busy} onClick={() => onConfirm({ kind: 'equal', parts })}>Cobrar en {parts} partes</button>
        </>
      )}
    </div>
  )
}
