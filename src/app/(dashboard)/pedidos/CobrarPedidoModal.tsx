'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CreditCard, Copy, Check, CheckCircle2 } from 'lucide-react'
import { ComprobanteActions } from '@/components/comprobante/ComprobanteActions'
import { ShippingActions } from '@/components/comprobante/ShippingActions'
import { ShippingEditor, CedulaAlertBadge, ShippingMethodTag } from '@/components/comprobante/ShippingEditor'
import { checkCedula } from '@/lib/cedula'
import type { CobrarPedidoData } from '@/types/pedidos'
import { ClienteResumen } from './ClienteResumen'
import { dual } from './money'
import type { PedidoClienteResumen } from './pago'
import styles from './CobrarPedidoModal.module.css'
import d from './PedidoPago.module.css'

interface PaymentMethod {
  id: number
  name: string
  type: string
  is_active: boolean
  is_financing?: boolean
}

/** Inicial recibida con un método REAL al cobrar con el método financiador; el saldo (total − inicial) queda asignado a Cashea. */
export interface InicialCobro {
  payment_method_id: number
  amount_usd:        number
  reference?:        string
}

interface CobrarPedidoModalProps {
  open: boolean
  order: CobrarPedidoData | null
  onClose: () => void
  /** Cobra el pedido y devuelve el id de la venta creada. Lanza (con el mensaje del servidor) si falla. */
  onConfirm: (paymentMethodId: number, reference: string, cedula: string | null, initial: InicialCobro | null) => Promise<number>
}

const REFERENCE_TYPES = new Set(['pago_movil', 'zelle', 'transfer', 'binance', 'binance_usdt'])
const toNum = (s: string): number => Number(s.trim().replace(',', '.'))

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtBs = (n: number) =>
  `Bs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000))

export function CobrarPedidoModal({ open, order, onClose, onConfirm }: CobrarPedidoModalProps) {
  const [methods, setMethods]     = useState<PaymentMethod[]>([])
  const [selected, setSelected]   = useState<number | null>(null)
  const [reference, setReference] = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadingPm, setLoadingPm] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [saleId, setSaleId]       = useState<number | null>(null)
  const [copied, setCopied]       = useState(false)
  const [cedula, setCedula]       = useState('')
  const [cedulaCopied, setCedulaCopied] = useState(false)
  const [initialMethod, setInitialMethod] = useState<number | null>(null)
  const [initialAmount, setInitialAmount] = useState('')
  const [initialRef, setInitialRef]       = useState('')
  const [client, setClient]               = useState<PedidoClienteResumen | null>(null)

  useEffect(() => {
    if (!open) {
      setSelected(null)
      setInitialMethod(null)
      setInitialAmount('')
      setInitialRef('')
      setClient(null)
      setReference('')
      setLoading(false)
      setError(null)
      setSaleId(null)
      setCopied(false)
      setCedula('')
      return
    }
    setCedula(order?.client_cedula ?? '')
    setLoadingPm(true)
    fetch('/api/payment-methods')
      .then(r => r.json() as Promise<{ methods?: PaymentMethod[] }>)
      .then(data => {
        const active = (data.methods ?? []).filter(m => m.is_active)
        setMethods(active)
        // El método es solo registro: se ofrecen TODOS los activos (Cashea no es compuerta de aprobación).
        const real = active.filter(m => !m.is_financing)
        if (active.length > 0) setSelected((real[0] ?? active[0]).id)
        if (real.length > 0) setInitialMethod(real[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingPm(false))
    // Resumen del cliente enlazado (solo lectura; si falla, el cobro sigue sin él).
    if (order) {
      fetch(`/api/orders/${order.id}`)
        .then(r => r.json() as Promise<{ order?: { client?: PedidoClienteResumen | null } }>)
        .then(j => setClient(j.order?.client ?? null))
        .catch(() => {})
    }
  }, [open])

  const visibleMethods = methods
  const realMethods    = methods.filter(m => !m.is_financing)
  const selectedMethod = visibleMethods.find(m => m.id === selected)
  const cashea   = selectedMethod?.is_financing === true
  const needsRef = cashea || (selectedMethod ? REFERENCE_TYPES.has(selectedMethod.type) : false)
  const refLabel = cashea ? 'N° de orden Cashea' : 'Referencia'

  // Cédula: obligatoria con financiadora (campo is_financing) o si el pedido es envío.
  const isDelivery  = order?.delivery_type === 'delivery'
  const financing   = selectedMethod?.is_financing ? selectedMethod : undefined
  const cedulaCheck = checkCedula(cedula, financing?.name ?? null, isDelivery)
  const cedulaRequired = !!financing || isDelivery

  const totalUsd = Number(order?.total_usd ?? 0)
  const totalBs  = Number(order?.total_bs ?? 0)
  const rate     = Number(order?.rate_used ?? 0)
  const items    = order?.items ?? []

  // Inicial y saldo a cargo de Cashea (USD y Bs): saldo = total − inicial.
  const initialUsd = toNum(initialAmount)
  const initialOk  = Number.isFinite(initialUsd) && initialUsd > 0
  const saldoUsd   = Math.max(0, Math.round((totalUsd - (initialOk ? initialUsd : 0)) * 100) / 100)
  const initialFalta = cashea && (!initialOk || initialMethod === null)

  const handleCopy = async () => {
    if (!order) return
    try {
      await navigator.clipboard.writeText(order.order_number)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('No se pudo copiar el número. Selecciónalo y cópialo a mano.')
    }
  }

  const handleCopyCedula = async () => {
    try {
      await navigator.clipboard.writeText(cedula.trim())
      setCedulaCopied(true)
      window.setTimeout(() => setCedulaCopied(false), 1800)
    } catch {
      setError('No se pudo copiar la cédula. Selecciónala y cópiala a mano.')
    }
  }

  const handleConfirm = async () => {
    if (!selected) return
    if (cedulaRequired && !cedulaCheck.ok) { setError(cedulaCheck.message); return }
    if (initialFalta) { setError('Indica la inicial recibida y el método con el que entró.'); return }
    setLoading(true)
    setError(null)
    try {
      const initial: InicialCobro | null = cashea && initialMethod !== null
        ? { payment_method_id: initialMethod, amount_usd: Math.round(initialUsd * 100) / 100, ...(initialRef.trim() ? { reference: initialRef.trim() } : {}) }
        : null
      setSaleId(await onConfirm(selected, reference.trim(), cedulaCheck.ok ? cedulaCheck.value : null, initial))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cobrar el pedido.')
    } finally {
      setLoading(false)
    }
  }

  const handleOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) onClose()
  }

  const done = saleId !== null

  return (
    <AnimatePresence>
      {open && order && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleOverlay}
          aria-modal="true"
          role="dialog"
          aria-label={`Cobrar pedido ${order.order_number}`}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={`${styles.iconWrap} ${done ? styles.iconWrapDone : ''}`} aria-hidden="true">
                  {done ? <CheckCircle2 size={18} /> : <CreditCard size={16} />}
                </div>
                <h2 className={styles.title}>{done ? 'Pedido cobrado' : 'Cobrar pedido'}</h2>
              </div>
              <button className={styles.closeBtn} onClick={onClose} disabled={loading} aria-label="Cerrar">
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.body}>
              <section className={styles.card} aria-label="Pedido">
                <div className={styles.orderRow}>
                  <span className={styles.orderNumber}>{order.order_number}</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={handleCopy}
                    aria-label={`Copiar número de pedido ${order.order_number}`}
                  >
                    {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                {(order.client_name || order.client_phone) && (
                  <p className={styles.client}>
                    {order.client_name ?? 'Sin nombre'}
                    {order.client_phone ? ` · ${order.client_phone}` : ''}
                  </p>
                )}
                {!done && <ClienteResumen client={client} fallbackPhone={order.client_phone} fallbackCedula={order.client_cedula ?? order.ship_cedula} rate={rate} />}
                <CedulaAlertBadge show={order.cedula_alert} />
                {isDelivery && <ShippingMethodTag label={order.ship_metodo_label} />}
                {!done && isDelivery && <ShippingEditor orderId={order.id} order={order} />}
                {!done && (
                  <div className={styles.cedulaRow}>
                    <label className={styles.label} htmlFor="cobrar-cedula">
                      Cédula{cedulaRequired ? <span className={styles.required}> *</span> : <span className={styles.optional}> (opcional)</span>}
                    </label>
                    <div className={styles.cedulaInputRow}>
                      <input
                        id="cobrar-cedula"
                        type="text"
                        autoComplete="off"
                        className={styles.input}
                        placeholder="V-12345678"
                        value={cedula}
                        onChange={e => { setCedula(e.target.value); setError(null) }}
                        maxLength={20}
                        aria-required={cedulaRequired}
                      />
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={handleCopyCedula}
                        disabled={!cedula.trim()}
                        aria-label="Copiar cédula"
                      >
                        {cedulaCopied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                        {cedulaCopied ? 'Copiada' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}
                <ul className={styles.lines}>
                  {items.map((it, i) => (
                    <li key={`${it.product_name}-${i}`} className={styles.line}>
                      <span className={styles.lineName}>
                        {it.product_name} <span className={styles.lineQty}>x{fmtQty(Number(it.quantity))}</span>
                      </span>
                      <span className={styles.lineAmount}>{fmtUsd(Number(it.subtotal_usd))}</span>
                    </li>
                  ))}
                </ul>
                <div className={styles.totalBlock}>
                  <span className={styles.totalUsd}>{fmtUsd(totalUsd)}</span>
                  <span className={styles.totalBs}>{fmtBs(totalBs)}</span>
                  {rate > 0 && <span className={styles.rate}>Tasa BCV {rate.toFixed(2)}</span>}
                </div>
              </section>

              {!done && (
                <>
                  <section className={styles.card} aria-label="Método de pago">
                    <p className={styles.label}>Método de pago</p>
                    {loadingPm ? (
                      <div className={styles.skeleton} />
                    ) : visibleMethods.length === 0 ? (
                      <p className={styles.emptyMethods}>Configura métodos de pago en Configuración primero.</p>
                    ) : (
                      <div className={styles.methods} role="radiogroup" aria-label="Método de pago">
                        {visibleMethods.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            role="radio"
                            aria-checked={selected === m.id}
                            className={`${styles.methodBtn} ${selected === m.id ? styles.methodBtnActive : ''}`}
                            onClick={() => { setSelected(m.id); setReference('') }}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {needsRef && (
                      <div className={styles.refField}>
                        <label className={styles.label} htmlFor="cobrar-ref">
                          {refLabel} <span className={styles.optional}>(opcional)</span>
                        </label>
                        <input
                          id="cobrar-ref"
                          type="text"
                          className={styles.input}
                          placeholder={cashea ? 'Número de orden en Cashea' : 'Nro. de confirmación'}
                          value={reference}
                          onChange={e => setReference(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                    )}
                    {cashea && (
                      <div className={d.inicial} data-testid="cobro-inicial">
                        <p className={d.inicialTitulo}>Inicial recibida</p>
                        <div className={styles.methods} role="radiogroup" aria-label="Método de la inicial">
                          {realMethods.map(m => (
                            <button key={m.id} type="button" role="radio" aria-checked={initialMethod === m.id}
                              className={`${styles.methodBtn} ${initialMethod === m.id ? styles.methodBtnActive : ''}`}
                              onClick={() => setInitialMethod(m.id)}>
                              {m.name}
                            </button>
                          ))}
                        </div>
                        <div>
                          <label className={styles.label} htmlFor="cobrar-inicial-monto">Monto de la inicial (USD)</label>
                          <input id="cobrar-inicial-monto" type="text" inputMode="decimal" autoComplete="off" className={styles.input}
                            placeholder="0.00" value={initialAmount} onChange={e => { setInitialAmount(e.target.value); setError(null) }}
                            data-testid="cobro-inicial-monto" />
                        </div>
                        <div>
                          <label className={styles.label} htmlFor="cobrar-inicial-ref">Referencia de la inicial <span className={styles.optional}>(opcional)</span></label>
                          <input id="cobrar-inicial-ref" type="text" className={styles.input} value={initialRef} onChange={e => setInitialRef(e.target.value)} maxLength={100} />
                        </div>
                        <div className={d.saldoCashea} data-testid="cobro-saldo-cashea" aria-live="polite">
                          <span>Saldo a cargo de Cashea</span>
                          <strong>{dual(saldoUsd, rate)}</strong>
                          {initialOk && <span>Inicial recibida: {dual(initialUsd, rate)}</span>}
                        </div>
                      </div>
                    )}
                  </section>

                  {error && <p className={styles.error} role="alert" data-testid="cobro-error">{error}</p>}
                </>
              )}

              {done && saleId !== null && (
                <section className={styles.card} aria-label="Comprobante">
                  <p className={styles.label}>Comprobante de venta</p>
                  <ComprobanteActions saleId={saleId} />
                  <ShippingActions saleId={saleId} />
                </section>
              )}
            </div>

            <div className={styles.footer}>
              {done ? (
                <button type="button" className={styles.confirmBtn} onClick={onClose}>Listo</button>
              ) : (
                <>
                  <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={styles.confirmBtn}
                    onClick={handleConfirm}
                    disabled={loading || !selected || loadingPm || initialFalta || (cedulaRequired && !cedulaCheck.ok)}
                  >
                    {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
                    {loading ? 'Procesando...' : 'Confirmar cobro'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
