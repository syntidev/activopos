'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, useToast } from '@/components/ui'
import { CobroModal } from '@/components/pos/CobroModal'
import type { SaleItemForPanel } from '@/components/pos/SuccessTicketPanel'
import type { PaymentInput, SaleResult } from '@/lib/pos'
import { callApi } from '@/lib/restaurante-client'
import { formatBs, formatUsd } from '@/lib/restaurante'
import type { AccountDTO, AccountItemDTO } from '@/types/restaurante'
import { DividirCuenta, type SplitChoice } from './DividirCuenta'
import { PreCuenta, pendingUsd } from './PreCuenta'
import { Propina } from './Propina'
import styles from './cobro.module.css'

interface Method { id: number; name: string; type: string; is_financing?: boolean }
interface SaleRef { id: number; ticket_number: string; total_usd: number; total_bs: number; rate_used: number }
interface Charged { ref: SaleRef; items: SaleItemForPanel[] }
interface ChargeResponse { sales: SaleRef[]; parts: Array<{ usd: number }> | null; account: AccountDTO }

type Step = 'resumen' | 'dividir' | 'cobro' | 'propina'

interface Props { open: boolean; account: AccountDTO; onClose: () => void; onAccount: (a: AccountDTO) => void }

const left = (i: AccountItemDTO): number => Number((i.quantity - i.billed_quantity).toFixed(3))
const toPanel = (i: AccountItemDTO, qty: number): SaleItemForPanel => ({ name: i.product_name, qty, price_usd: i.price_per_unit_usd })

/** Ítems de cada venta creada, para el comprobante: lo elegido por subcuenta, o todo lo pendiente. */
function panelItems(account: AccountDTO, choice: SplitChoice | null, count: number): SaleItemForPanel[][] {
  const byId = new Map(account.items.map(i => [i.id, i]))
  if (choice?.kind === 'items') {
    return choice.groups.map(g => g.flatMap(s => { const i = byId.get(s.item_id); return i ? [toPanel(i, s.quantity)] : [] }))
  }
  const all = account.items.filter(i => i.kds_status !== 'void' && left(i) > 0).map(i => toPanel(i, left(i)))
  return Array.from({ length: count }, () => all)
}

/**
 * Cobro de la cuenta (cajero y admin): pre-cuenta → cobrar todo o dividir → cada venta se paga con el cobro del POS
 * (PATCH /api/sales/[id]/pay, sin tocar) → propina opcional → al terminar se sincroniza y la cuenta se cierra.
 */
export function CobroMesa({ open, account, onClose, onAccount }: Props) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('resumen')
  const [busy, setBusy] = useState(false)
  const [methods, setMethods] = useState<Method[]>([])
  const [rate, setRate] = useState(account.rate_used)
  const [businessName, setBusinessName] = useState('')
  const [queue, setQueue] = useState<Charged[]>([])
  const [idx, setIdx] = useState(0)
  const [parts, setParts] = useState<Array<{ usd: number }> | null>(null)
  const [showCobro, setShowCobro] = useState(false)
  const paid = useRef(false)

  useEffect(() => {
    if (!open) return
    setStep('resumen'); setQueue([]); setIdx(0); setParts(null)
    void Promise.all([
      callApi<{ methods: Method[] }>('/api/payment-methods', 'GET'),
      callApi<{ rate: number }>('/api/rates/bcv', 'GET'),
      callApi<{ business?: { name?: string } }>('/api/config/business', 'GET'),
    ]).then(([m, r, b]) => {
      // Crédito (fiado) no aplica a la mesa: /pay no lo maneja.
      if (m.ok) setMethods(m.data.methods.filter(x => x.type !== 'credit'))
      if (r.ok && Number(r.data.rate) > 0) setRate(Number(r.data.rate))
      if (b.ok && b.data.business?.name) setBusinessName(b.data.business.name)
    })
  }, [open])

  const start = useCallback(async (choice: SplitChoice | null): Promise<void> => {
    setBusy(true)
    const res = await callApi<ChargeResponse>(`/api/restaurante/cuentas/${account.id}/${choice === null ? 'cobrar' : 'dividir'}`, 'POST', choice ?? undefined)
    setBusy(false)
    if (!res.ok) { toast(res.error, 'error'); return }
    const panels = panelItems(account, choice, res.data.sales.length)
    setQueue(res.data.sales.map((ref, i) => ({ ref, items: panels[i] ?? [] })))
    setParts(res.data.parts); setIdx(0); setStep('cobro'); onAccount(res.data.account)
  }, [account, onAccount, toast])

  const current = queue[idx]

  const pay = useCallback(async (payments: PaymentInput[], cedula?: string | null): Promise<SaleResult> => {
    if (!current) throw new Error('No hay venta por cobrar')
    const res = await callApi<{ sale: { id: number; ticket_number: string; total_usd: number | string; total_bs: number | string } }>(
      `/api/sales/${current.ref.id}/pay`, 'PATCH', { payments, ...(cedula ? { client_cedula: cedula } : {}) })
    if (!res.ok) throw new Error(res.error)
    paid.current = true
    const s = res.data.sale
    return { id: s.id, ticket_number: s.ticket_number, status: 'paid', total_usd: Number(s.total_usd), total_bs: Number(s.total_bs) }
  }, [current])

  const finish = useCallback(async (): Promise<void> => {
    const res = await callApi<{ closed: boolean; account: AccountDTO }>(`/api/restaurante/cuentas/${account.id}/sincronizar`, 'POST')
    if (!res.ok) { toast(res.error, 'error'); return }
    onAccount(res.data.account)
    toast(res.data.closed ? 'Cuenta cerrada' : 'Cobro registrado', 'success')
    onClose()
  }, [account.id, onAccount, onClose, toast])

  const next = useCallback(() => {
    if (idx + 1 < queue.length) { setIdx(idx + 1); setStep('cobro') } else void finish()
  }, [idx, queue.length, finish])

  function closeCobro(): void {
    setShowCobro(false)
    if (paid.current) { paid.current = false; setStep('propina') }
  }

  const total = pendingUsd(account)
  const titles: Record<Step, string> = { resumen: 'Cobrar la cuenta', dividir: 'Dividir la cuenta', cobro: `Cobro ${idx + 1} de ${queue.length}`, propina: 'Propina' }

  return (
    <>
      <Modal open={open && !showCobro} onClose={onClose} title={titles[step]} size="md">
        <div className={styles.body} data-restaurante="">
          {step === 'resumen' && (
            <>
              <PreCuenta account={account} />
              <div className={styles.row}>
                <button type="button" className={styles.ghost} onClick={() => setStep('dividir')}>Dividir</button>
                <button type="button" className={styles.primary} disabled={busy || total <= 0} onClick={() => { void start(null) }}>Cobrar todo</button>
              </div>
            </>
          )}
          {step === 'dividir' && (
            <>
              <DividirCuenta account={account} busy={busy} onConfirm={choice => { void start(choice) }} />
              <button type="button" className={styles.ghost} onClick={() => setStep('resumen')}>Volver</button>
            </>
          )}
          {step === 'cobro' && current && (
            <>
              <div className={styles.saleCard}>
                <span>Ticket {current.ref.ticket_number}</span>
                <strong>{formatUsd(current.ref.total_usd)}<small>{formatBs(current.ref.total_bs)}</small></strong>
              </div>
              {parts && (
                <p className={styles.hint}>Partes iguales: {parts.map((p, i) => `${i + 1}) ${formatUsd(p.usd)}`).join(' · ')}. Registra cada pago como pago mixto.</p>
              )}
              <button type="button" className={styles.primary} onClick={() => setShowCobro(true)}>Cobrar {formatUsd(current.ref.total_usd)}</button>
            </>
          )}
          {step === 'propina' && current && (
            <Propina saleId={current.ref.id} saleTotalUsd={current.ref.total_usd} rate={current.ref.rate_used} methods={methods} onDone={next} />
          )}
        </div>
      </Modal>

      {current && (
        <CobroModal
          open={showCobro} onClose={closeCobro} rate={current.ref.rate_used || rate} paymentMethods={methods} items={current.items} businessName={businessName || 'ActivoPOS'}
          totals={{ subtotal_usd: current.ref.total_usd, discount_usd: 0, cargo_usd: 0, iva_usd: 0, total_usd: current.ref.total_usd, total_bs: current.ref.total_bs }}
          onConfirm={pay}
        />
      )}
    </>
  )
}
