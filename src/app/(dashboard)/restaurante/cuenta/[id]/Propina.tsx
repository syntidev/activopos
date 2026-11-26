'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui'
import { callApi } from '@/lib/restaurante-client'
import { formatBs, formatUsd } from '@/lib/restaurante'
import styles from './cobro.module.css'

const PCTS = [10, 15, 20] as const
const r2 = (n: number): number => Math.round(n * 100) / 100

interface Props {
  saleId: number
  saleTotalUsd: number
  rate: number
  methods: ReadonlyArray<{ id: number; name: string; type: string; is_financing?: boolean }>
  onDone: () => void
}

/** Propina de una venta pagada. Va aparte del total: las ventas netas no cambian; solo la de efectivo sube el efectivo esperado de caja. */
export function Propina({ saleId, saleTotalUsd, rate, methods, onDone }: Props) {
  const { toast } = useToast()
  const usable = methods.filter(m => !m.is_financing)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState(usable.find(m => m.type === 'cash')?.id ?? usable[0]?.id ?? 0)
  const [busy, setBusy] = useState(false)
  const usd = Number(amount.replace(',', '.'))
  const valid = Number.isFinite(usd) && usd > 0 && method > 0

  async function save(): Promise<void> {
    setBusy(true)
    const res = await callApi('/api/restaurante/propinas', 'POST', { sale_id: saleId, payment_method_id: method, amount_usd: r2(usd) })
    setBusy(false)
    if (!res.ok) { toast(res.error, 'error'); return }
    toast('Propina registrada', 'success')
    onDone()
  }

  return (
    <section className={styles.tip} aria-label="Propina">
      <h3 className={styles.tipTitle}>Propina</h3>
      <div className={styles.chips}>
        {PCTS.map(p => <button key={p} type="button" className={styles.chip} onClick={() => setAmount(String(r2(saleTotalUsd * p / 100)))}>{p}%</button>)}
      </div>
      <label className={styles.field}><span>Monto (USD)</span>
        <input className={styles.input} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0.00" />
      </label>
      {valid && <p className={styles.hint}>{formatUsd(usd)} · {formatBs(usd * rate)}</p>}
      <label className={styles.field}><span>Se recibió en</span>
        <select className={styles.select} value={method} onChange={e => setMethod(Number(e.target.value))}>
          {usable.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <div className={styles.row}>
        <button type="button" className={styles.ghost} onClick={onDone}>Sin propina</button>
        <button type="button" className={styles.primary} disabled={!valid || busy} onClick={() => { void save() }}>Guardar propina</button>
      </div>
    </section>
  )
}
