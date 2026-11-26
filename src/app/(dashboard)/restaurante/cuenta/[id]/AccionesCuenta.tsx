'use client'

import { useState } from 'react'
import { Modal, useToast } from '@/components/ui'
import { confirmAction } from '@/context/ConfirmContext'
import { callApi } from '@/lib/restaurante-client'
import type { AccountDTO, AccountSummaryDTO, DiningTableDTO } from '@/types/restaurante'
import styles from './cobro.module.css'

type Dialog = 'transferir' | 'juntar' | null
interface Props { account: AccountDTO; isAdmin: boolean; canCharge: boolean; onCharge: () => void; onAccount: (a: AccountDTO) => void }

/** Pedir cuenta, cobrar, juntar, transferir y reabrir. Cada acción la valida el servidor; aquí solo se ofrecen las que aplican. */
export function AccionesCuenta({ account, isAdmin, canCharge, onCharge, onAccount }: Props) {
  const { toast } = useToast()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [tables, setTables] = useState<DiningTableDTO[]>([])
  const [accounts, setAccounts] = useState<AccountSummaryDTO[]>([])
  const [pick, setPick] = useState(0)

  const open = account.status === 'open' || account.status === 'bill_requested'
  const live = account.items.filter(i => i.kds_status !== 'void')
  const hasDraft = live.some(i => i.kds_status === 'draft')
  const hasSales = account.sales.length > 0
  const hasPending = account.sales.some(s => s.status === 'pending')

  async function run(url: string, body?: Record<string, unknown>, ok?: string): Promise<boolean> {
    setBusy(true)
    const res = await callApi<{ account: AccountDTO }>(url, 'POST', body)
    setBusy(false)
    if (!res.ok) { toast(res.error, 'error'); return false }
    onAccount(res.data.account)
    if (ok) toast(ok, 'success')
    return true
  }

  async function show(kind: Exclude<Dialog, null>): Promise<void> {
    setPick(0); setDialog(kind)
    if (kind === 'transferir') {
      const r = await callApi<{ tables: DiningTableDTO[] }>('/api/restaurante/mesas', 'GET')
      if (r.ok) setTables(r.data.tables.filter(t => t.active && t.status === 'libre'))
    } else {
      const r = await callApi<{ accounts: AccountSummaryDTO[] }>('/api/restaurante/cuentas?status=abiertas', 'GET')
      if (r.ok) setAccounts(r.data.accounts.filter(a => a.id !== account.id))
    }
  }

  async function confirmDialog(): Promise<void> {
    const ok = dialog === 'transferir'
      ? await run(`/api/restaurante/cuentas/${account.id}/transferir`, { table_id: pick }, 'Cuenta transferida')
      : await run(`/api/restaurante/cuentas/${account.id}/juntar`, { source_id: pick }, 'Cuentas juntas')
    if (ok) setDialog(null)
  }

  async function reopen(): Promise<void> {
    const ok = await confirmAction({
      title: 'Reabrir la cuenta',
      message: hasPending ? 'Se cancelan los cobros pendientes y la cuenta vuelve a estar abierta.' : 'La cuenta vuelve a estar abierta. Si hay ventas pagadas, anúlalas primero en el POS.',
      confirmLabel: 'Reabrir cuenta',
    })
    if (ok) await run(`/api/restaurante/cuentas/${account.id}/reabrir`, {}, 'Cuenta reabierta')
  }

  const canBill = open && live.length > 0 && !hasDraft
  return (
    <section className={styles.actions} aria-label="Acciones de la cuenta">
      {canBill && account.status === 'open' && !hasSales && (
        <button type="button" className={`${styles.act} ${styles.actPay}`} disabled={busy} onClick={() => { void run(`/api/restaurante/cuentas/${account.id}/pedir-cuenta`, undefined, 'Cuenta pedida') }}>Pedir cuenta</button>
      )}
      {canCharge && canBill && <button type="button" className={`${styles.act} ${styles.actPay}`} onClick={onCharge}>Cobrar</button>}
      {open && !hasSales && <button type="button" className={styles.act} onClick={() => { void show('transferir') }}>Transferir mesa</button>}
      {open && !hasSales && <button type="button" className={styles.act} onClick={() => { void show('juntar') }}>Juntar cuentas</button>}
      {isAdmin && (account.status === 'closed' || (open && hasPending)) && <button type="button" className={`${styles.act} ${styles.actDanger}`} disabled={busy} onClick={() => { void reopen() }}>Reabrir cuenta</button>}

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialog === 'transferir' ? 'Transferir a otra mesa' : 'Juntar con otra cuenta'} size="sm">
        <div className={styles.body} data-restaurante="">
          {dialog === 'transferir' && (
            <label className={styles.field}><span>Mesa libre</span>
              <select className={styles.select} value={pick} onChange={e => setPick(Number(e.target.value))}>
                <option value={0}>Elige una mesa</option>
                {tables.map(t => <option key={t.id} value={t.id}>{t.label} · {t.area_name}</option>)}
              </select>
            </label>
          )}
          {dialog === 'juntar' && (
            <label className={styles.field}><span>Cuenta que se une a esta</span>
              <select className={styles.select} value={pick} onChange={e => setPick(Number(e.target.value))}>
                <option value={0}>Elige una cuenta</option>
                {accounts.map(a => <option key={a.id} value={a.id}>Mesa {a.table_label} · {a.order_number}</option>)}
              </select>
            </label>
          )}
          <p className={styles.hint}>{dialog === 'juntar' ? 'Los ítems pasan a esta cuenta y la otra mesa queda unida a ella.' : 'La cuenta y sus ítems se mueven a la mesa elegida.'}</p>
          <button type="button" className={styles.primary} disabled={pick === 0 || busy} onClick={() => { void confirmDialog() }}>{dialog === 'juntar' ? 'Juntar' : 'Transferir'}</button>
        </div>
      </Modal>
    </section>
  )
}
