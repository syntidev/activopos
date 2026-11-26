'use client'

import { formatBs, formatUsd } from '@/lib/restaurante'
import type { AccountDTO } from '@/types/restaurante'
import styles from './cobro.module.css'

const r2 = (n: number): number => Math.round(n * 100) / 100

/** Lo que todavía falta cobrar de una línea (cantidad no cubierta por ventas) en USD. */
export function pendingUsd(account: AccountDTO): number {
  return r2(account.items.filter(i => i.kds_status !== 'void').reduce((a, i) => a + r2((i.quantity - i.billed_quantity) * i.price_per_unit_usd), 0))
}

/** Pre-cuenta: lo que se debe, línea por línea, en USD y Bs. Los montos son los del servidor (precio vigente + modificadores). */
export function PreCuenta({ account }: { account: AccountDTO }) {
  const rows = account.items.filter(i => i.kds_status !== 'void' && i.quantity - i.billed_quantity > 0.0005)
  const total = pendingUsd(account)
  return (
    <section className={styles.pre} aria-label="Pre-cuenta">
      <ul className={styles.preLines}>
        {rows.map(i => {
          const qty = Number((i.quantity - i.billed_quantity).toFixed(3))
          const usd = r2(qty * i.price_per_unit_usd)
          return (
            <li key={i.id} className={styles.preLine}>
              <span className={styles.preQty}>{qty}×</span>
              <span className={styles.preName}>{i.product_name}{i.modifiers.length > 0 && <small>{i.modifiers.map(m => m.option).join(' · ')}</small>}</span>
              <span className={styles.preAmt}>{formatUsd(usd)}<small>{formatBs(usd * account.rate_used)}</small></span>
            </li>
          )
        })}
      </ul>
      <div className={styles.preTotal}>
        <span>Por cobrar</span>
        <strong>{formatUsd(total)}<small>{formatBs(total * account.rate_used)}</small></strong>
      </div>
    </section>
  )
}
