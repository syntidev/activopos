'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Send, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui'
import { confirmAction } from '@/context/ConfirmContext'
import { callApi } from '@/lib/restaurante-client'
import { elapsedLabel, formatBs, formatUsd } from '@/lib/restaurante'
import type { AccountDTO, AccountItemDTO, ItemKdsStatus } from '@/types/restaurante'
import { AccionesCuenta } from './AccionesCuenta'
import { CobroMesa } from './CobroMesa'
import { SelectorProducto } from './SelectorProducto'
import styles from './cuenta.module.css'
import cobro from './cobro.module.css'

const COURSE_NAME: Record<number, string> = { 1: 'Entrada', 2: 'Fondo', 3: 'Postre' }

const POLL_MS = 4_000
const STATUS_LABEL: Record<ItemKdsStatus, string> = { draft: 'Borrador', sent: 'En cocina', preparing: 'Preparando', ready: 'Listo para servir', served: 'Servido', void: 'Anulado' }

const qtyLabel = (n: number): string => String(Number(n.toFixed(3)))

/** Cuenta de mesa del mesonero (móvil primero): ítems por curso, modificadores, notas y total en USD y Bs. */
export function CuentaMesero({ initial, canCharge, isAdmin }: { initial: AccountDTO; canCharge: boolean; isAdmin: boolean }) {
  const { toast } = useToast()
  const [account, setAccount] = useState<AccountDTO>(initial)
  const [adding, setAdding] = useState(false)
  const [busyItem, setBusyItem] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [charging, setCharging] = useState(false)

  // El estado de cocina (preparando, listo) llega por sondeo; sin polling el mesonero no se enteraría de que un plato salió.
  const accountId = initial.id
  useEffect(() => {
    const id = window.setInterval(() => {
      void callApi<{ account: AccountDTO }>(`/api/restaurante/cuentas/${accountId}`, 'GET').then(r => { if (r.ok) setAccount(r.data.account) })
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [accountId])

  const live = account.items.filter(i => i.kds_status !== 'void')
  const courses = Array.from(new Set(account.items.map(i => i.course))).sort((a, b) => a - b)
  const pay = account.status === 'bill_requested'
  const closed = account.status === 'closed'
  const money = (usd: number): { usd: string; bs: string } => ({ usd: formatUsd(usd), bs: formatBs(usd * account.rate_used) })

  const drafts = account.items.filter(i => i.kds_status === 'draft').length

  async function send(): Promise<void> {
    setSending(true)
    const res = await callApi<{ account: AccountDTO; sent: number; direct: number }>(`/api/restaurante/cuentas/${account.id}/enviar`, 'POST', {})
    setSending(false)
    if (!res.ok) { toast(res.error, 'error'); return }
    setAccount(res.data.account)
    toast(res.data.sent > 0 ? 'Enviado a cocina' : 'Listo para servir', 'success')
  }

  async function serve(item: AccountItemDTO): Promise<void> {
    setBusyItem(item.id)
    const res = await callApi<{ ok: true }>(`/api/restaurante/kds/items/${item.id}`, 'PATCH', { action: 'servido', order_id: account.id })
    setBusyItem(null)
    if (!res.ok) { toast(res.error, 'error'); return }
    const fresh = await callApi<{ account: AccountDTO }>(`/api/restaurante/cuentas/${account.id}`, 'GET')
    if (fresh.ok) setAccount(fresh.data.account)
  }

  async function remove(item: AccountItemDTO): Promise<void> {
    const ok = await confirmAction({
      title: 'Quitar ítem',
      message: `Se quita «${item.product_name}» de la cuenta. Todavía no se envió a cocina.`,
      confirmLabel: 'Quitar ítem',
    })
    if (!ok) return
    setBusyItem(item.id)
    const res = await callApi<{ account: AccountDTO }>(`/api/restaurante/cuentas/${account.id}/items/${item.id}`, 'DELETE', { reason: 'Quitado por el mesonero' })
    setBusyItem(null)
    if (!res.ok) { toast(res.error, 'error'); return }
    setAccount(res.data.account)
    toast('Ítem quitado', 'success')
  }

  return (
    <div className={styles.root}>
      <header className={styles.top}>
        <div className={styles.topRow}>
          <Link href="/restaurante/mesas" className={styles.back} aria-label="Volver al salón"><ChevronLeft size={24} aria-hidden="true" /></Link>
          <h1 className={styles.title}>Mesa {account.table_label}<small>{account.area_name}</small></h1>
          <span className={`${styles.pill} ${pay ? styles.pillPay : ''}`}>{closed ? 'Cerrada' : pay ? 'Por cobrar' : 'Ocupada'}</span>
        </div>
        <ul className={styles.meta}>
          {account.guests !== null && <li>{account.guests} {account.guests === 1 ? 'comensal' : 'comensales'}</li>}
          <li>{elapsedLabel(account.opened_at)}</li>
          {account.waiter_name && <li>{account.waiter_name}</li>}
          {account.client_name && <li>{account.client_name}</li>}
          <li>{account.order_number}</li>
        </ul>
      </header>

      <div className={styles.body}>
        {account.items.length === 0 && (
          <div className={`${styles.card} ${styles.empty}`}>
            <p className={styles.emptyTitle}>La cuenta está vacía</p>
            <p className={styles.tip}>Agrega el primer ítem con el botón de abajo.</p>
          </div>
        )}

        {courses.map(course => (
          <section key={course} className={styles.card} aria-label={`Curso ${course}`}>
            <h2 className={styles.course}>
              <span>Curso {course} · {COURSE_NAME[course] ?? ''}</span>
              <span>{account.items.filter(i => i.course === course && i.kds_status === 'draft').length > 0 ? 'sin enviar' : ''}</span>
            </h2>
            <ul className={styles.lines}>
              {account.items.filter(i => i.course === course).map(item => {
                const voided = item.kds_status === 'void'
                const m = money(item.subtotal_usd)
                return (
                  <li key={item.id} className={`${styles.line} ${voided ? styles.lineVoid : ''}`}>
                    <span className={styles.qty}>{qtyLabel(item.quantity)}×</span>
                    <div>
                      <div className={styles.nm}>{item.product_name}</div>
                      {item.modifiers.length > 0 && <p className={styles.mod}>{item.modifiers.map(x => x.option).join(' · ')}</p>}
                      {item.note && <p className={styles.note}>{item.note}</p>}
                      <span className={`${styles.tag} ${voided ? styles.tagVoid : ''}`}>{voided ? `Anulado${item.void_reason ? ` · ${item.void_reason}` : ''}` : STATUS_LABEL[item.kds_status]}</span>
                      {item.kds_status === 'ready' && (
                        <div>
                          <button type="button" className={styles.remove} disabled={busyItem === item.id} onClick={() => { void serve(item) }}>Marcar servido</button>
                        </div>
                      )}
                      {item.kds_status === 'draft' && (
                        <div>
                          <button type="button" className={styles.remove} disabled={busyItem === item.id} onClick={() => { void remove(item) }} aria-label={`Quitar ${item.product_name}`}>
                            <Trash2 size={16} aria-hidden="true" />Quitar
                          </button>
                        </div>
                      )}
                    </div>
                    <div className={styles.amt}>{m.usd}<small>{m.bs}</small></div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <section className={styles.card} aria-label="Total de la cuenta">
          <div className={styles.tot}>
            <span>Total · {live.length} {live.length === 1 ? 'ítem' : 'ítems'}</span>
            <div className={styles.totAmt}>{formatUsd(account.total_usd)}<small>{formatBs(account.total_bs)}</small></div>
          </div>
        </section>
        {account.sales.length > 0 && (
          <section className={styles.card} aria-label="Cobros de la cuenta">
            <ul className={cobro.salesList}>
              {account.sales.map(s => (
                <li key={s.id} className={cobro.saleRow}>
                  <span>{s.ticket_number}</span>
                  <span className={s.status === 'paid' ? cobro.badgePaid : ''}>{s.status === 'paid' ? 'Pagada' : 'Pendiente'} · {formatUsd(s.total_usd)}{s.tip_usd > 0 ? ` · propina ${formatUsd(s.tip_usd)}` : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <AccionesCuenta account={account} isAdmin={isAdmin} canCharge={canCharge} onCharge={() => setCharging(true)} onAccount={setAccount} />
        <p className={styles.tip}>Los montos se calculan en el servidor con el precio vigente del producto. Lo enviado a cocina solo lo anula un administrador.</p>
      </div>

      <div className={styles.bar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={closed || account.sales.length > 0} onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden="true" />Agregar ítem
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={drafts === 0 || sending} onClick={() => { void send() }}>
          <Send size={18} aria-hidden="true" />{drafts > 0 ? `Enviar a cocina (${drafts})` : 'Enviar a cocina'}
        </button>
      </div>

      {canCharge && <CobroMesa open={charging} account={account} onClose={() => setCharging(false)} onAccount={setAccount} />}

      <SelectorProducto open={adding} accountId={account.id} onClose={() => setAdding(false)} onAdded={acc => { setAccount(acc); setAdding(false) }} />
    </div>
  )
}
