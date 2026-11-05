'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useCart, type CartItem } from '@/app/catalogo-premium/[slug]/CartContext'
import { fmtBs, fmtUsd } from '@/app/catalogo-premium/[slug]/catalogUtils'
import { confirmAction } from '@/context/ConfirmContext'
import { getPulsoOrderContext } from '@/lib/pulso-client'
import { buildOrderNotes, modalidadLabel, MODALIDAD_LABEL, type Modalidad } from '@/lib/carta/order-notes'
import { cx } from './util'
import styles from './carta.module.css'
import type { CartaPayOption } from '@/types/carta'

interface CartaCarritoProps {
  slug:       string
  rate:       number
  payOptions: CartaPayOption[]
}

interface Hecho {
  ticket:  string
  url:     string | null
  message: string
}

interface OrderErrorBody { error?: string; field?: string }

const MODALIDADES: Modalidad[] = ['sitio', 'llevar', 'delivery']

function decodeMessage(url: string | null): string {
  if (!url) return ''
  try { return decodeURIComponent(url.split('?text=')[1] ?? '') } catch { return '' }
}

/** Carrito y pedido: editar cantidad, quitar con confirmación, tamaño y nota visibles, y envío por POST /order + WhatsApp. */
export function CartaCarrito({ slug, rate, payOptions }: CartaCarritoProps) {
  const { cart, cartOpen, setCartOpen, subtotalUsd, updateCartQty, removeFromCart, clearCart } = useCart()
  const cerrarRef = useRef<HTMLButtonElement>(null)

  const [modalidad, setModalidad] = useState<Modalidad>('llevar')
  const [mesa, setMesa] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cedula, setCedula] = useState('')
  const [direccion, setDireccion] = useState('')
  const [pago, setPago] = useState<CartaPayOption['kind']>(payOptions[0]?.kind ?? 'bs')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<{ campo: string; mensaje: string } | null>(null)
  const [hecho, setHecho] = useState<Hecho | null>(null)

  const notes = useMemo(
    () => buildOrderNotes(modalidad, mesa, cart.map(i => ({ name: i.name, size: i.variant_label, qty: i.qty, note: i.note }))),
    [modalidad, mesa, cart],
  )

  useEffect(() => {
    if (!cartOpen) return
    cerrarRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setCartOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cartOpen, setCartOpen])

  if (!cartOpen) return null

  const quitar = async (item: CartItem): Promise<void> => {
    const ok = await confirmAction({
      title: 'Quitar del pedido', message: '¿Quitar ' + item.name + (item.variant_label ? ' (' + item.variant_label + ')' : '') + ' de tu pedido?', confirmLabel: 'Quitar',
    })
    if (ok) removeFromCart(item.product_id, item.variant_id, item.note)
  }
  const menos = (item: CartItem): void => {
    if (item.qty <= 1) { void quitar(item); return }
    updateCartQty(item.product_id, item.variant_id, -1, item.note)
  }

  const validar = (): { campo: string; mensaje: string } | null => {
    if (nombre.trim().length < 2) return { campo: 'nombre', mensaje: 'Escribe tu nombre.' }
    if (telefono.replace(/\D/g, '').length < 7) return { campo: 'telefono', mensaje: 'Escribe tu teléfono con al menos 7 números.' }
    if (cedula.trim().length < 5) return { campo: 'cedula', mensaje: 'Escribe tu cédula, por ejemplo V12345678.' }
    if (modalidad === 'delivery' && direccion.trim().length < 5) return { campo: 'direccion', mensaje: 'Escribe la dirección de entrega.' }
    return null
  }

  const enviar = async (): Promise<void> => {
    const falta = validar()
    if (falta) { setError(falta); return }
    const opcion = payOptions.find(o => o.kind === pago) ?? payOptions[0]
    setError(null)
    setEnviando(true)
    try {
      const res = await fetch('/api/catalog/' + slug + '/order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          items:              cart.map(i => ({ product_id: i.product_id, qty: i.qty, variant_id: i.variant_id })),
          customer_name:      nombre.trim(),
          customer_phone:     telefono.trim(),
          customer_reference: modalidadLabel(modalidad, mesa),
          payment_method:     opcion?.method ?? 'Bs',
          payment_kind:       opcion?.kind ?? 'bs',
          customer_cedula:    cedula.trim(),
          notes:              notes.text,
          delivery_type:      modalidad === 'delivery' ? 'delivery' : 'pickup',
          recipient_name:     modalidad === 'delivery' ? nombre.trim() : null,
          delivery_address:   modalidad === 'delivery' ? direccion.trim() : null,
          pulso:              getPulsoOrderContext() ?? undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { ticket_number: string; whatsapp_url: string | null }
        setHecho({ ticket: data.ticket_number, url: data.whatsapp_url, message: decodeMessage(data.whatsapp_url) })
        clearCart()
      } else {
        const body = await res.json().catch(() => null) as OrderErrorBody | null
        setError({ campo: body?.field ?? 'general', mensaje: body?.error ?? 'No se pudo enviar el pedido. Revisa los datos e intenta de nuevo.' })
      }
    } catch {
      setError({ campo: 'general', mensaje: 'Sin conexión. Intenta de nuevo en un momento.' })
    } finally {
      setEnviando(false)
    }
  }

  const cerrar = (): void => { setCartOpen(false); if (hecho) setHecho(null) }
  const err = (campo: string): JSX.Element | null => (error?.campo === campo ? <p className={styles.error} role="alert">{error.mensaje}</p> : null)

  return (
    <>
      <div className={styles.velo} onClick={cerrar} aria-hidden="true" />
      <div className={styles.hoja} role="dialog" aria-modal="true" aria-label="Mi pedido" data-testid="carrito">
        <div className={styles.hojaH}>
          <h2>{hecho ? 'Pedido enviado' : 'Mi pedido'}</h2>
          <button type="button" className={styles.cerrar} onClick={cerrar} ref={cerrarRef} aria-label="Cerrar mi pedido"><X size={20} aria-hidden="true" /></button>
        </div>

        {hecho ? (
          <div className={styles.centro} data-testid="confirmacion">
            <p className={styles.fichaDesc}>Lo recibimos. Abre WhatsApp para enviarnos el mensaje y confirmar.</p>
            <div className={styles.ticket} data-testid="ticket">{hecho.ticket}</div>
            {hecho.message && <div className={styles.msg} data-testid="mensaje-wa">{hecho.message}</div>}
            {hecho.url ? (
              <a className={cx(styles.btn, styles.btnWa)} href={hecho.url} target="_blank" rel="noopener noreferrer" data-testid="abrir-wa">Abrir WhatsApp</a>
            ) : (
              <p className={styles.aviso}>Tu pedido quedó registrado, pero este negocio aún no tiene WhatsApp configurado. Contáctalo directamente para coordinar.</p>
            )}
            <button type="button" className={cx(styles.btn, styles.btnAlt)} onClick={cerrar}>Volver a la carta</button>
          </div>
        ) : cart.length === 0 ? (
          <div className={styles.centro}>
            <p className={styles.fichaDesc} data-testid="carrito-vacio">Tu pedido está vacío. Agrega platos de la carta.</p>
            <button type="button" className={cx(styles.btn, styles.btnAlt)} onClick={cerrar}>Ver la carta</button>
          </div>
        ) : (
          <>
            {cart.map(i => (
              <div key={i.product_id + '-' + (i.variant_id ?? 0) + '-' + (i.note ?? '')} className={styles.linea} data-testid="linea">
                <div>
                  <div className={styles.lineaN}>{i.name}</div>
                  {i.variant_label && <div className={styles.lineaM} data-testid="linea-tamano">Tamaño: {i.variant_label}</div>}
                  {i.note && <div className={styles.lineaM} data-testid="linea-nota">Nota: {i.note}</div>}
                  <div className={styles.pasos}>
                    <button type="button" className={styles.paso} onClick={() => menos(i)} aria-label={'Quitar uno de ' + i.name}>−</button>
                    <span className={styles.cant} data-testid="linea-cant">{i.qty}</span>
                    <button type="button" className={cx(styles.paso, styles.pasoMas)} onClick={() => updateCartQty(i.product_id, i.variant_id, 1, i.note)} aria-label={'Agregar uno más de ' + i.name}>+</button>
                    <button type="button" className={styles.quitar} onClick={() => void quitar(i)} data-testid="linea-quitar">Quitar</button>
                  </div>
                </div>
                <div className={styles.lineaP}>{fmtUsd(i.price_usd * i.qty)}<div className={styles.lineaM}>{fmtBs(i.price_usd * i.qty * rate)}</div></div>
              </div>
            ))}

            <div className={styles.total}>
              <span>Total</span>
              <div>
                <div className={styles.totalBig} data-testid="carrito-total">{fmtUsd(subtotalUsd)}</div>
                <div className={styles.totalBs} data-testid="carrito-total-bs">{fmtBs(subtotalUsd * rate)}</div>
              </div>
            </div>

            <div className={styles.campo}>
              <label id="lbl-modalidad">¿Cómo lo quieres?</label>
              <div className={styles.seg} role="radiogroup" aria-labelledby="lbl-modalidad">
                {MODALIDADES.map(m => (
                  <button key={m} type="button" role="radio" aria-checked={modalidad === m} className={cx(styles.segB, modalidad === m && styles.segOn)} onClick={() => setModalidad(m)} data-testid={'modalidad-' + m}>{MODALIDAD_LABEL[m]}</button>
                ))}
              </div>
            </div>
            {modalidad === 'sitio' && (
              <div className={styles.campo}><label htmlFor="c-mesa">Mesa (opcional)</label><input id="c-mesa" className={styles.input} value={mesa} onChange={e => setMesa(e.target.value)} maxLength={20} /></div>
            )}
            <div className={styles.campo}><label htmlFor="c-nombre">Tu nombre</label><input id="c-nombre" className={styles.input} value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" />{err('nombre')}</div>
            <div className={styles.campo}><label htmlFor="c-tel">Teléfono</label><input id="c-tel" className={styles.input} value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" autoComplete="tel" />{err('telefono')}{err('customer_phone')}</div>
            <div className={styles.campo}><label htmlFor="c-ced">Cédula</label><input id="c-ced" className={styles.input} value={cedula} onChange={e => setCedula(e.target.value)} placeholder="V12345678" autoComplete="off" />{err('cedula')}{err('customer_cedula')}</div>
            {modalidad === 'delivery' && (
              <div className={styles.campo}><label htmlFor="c-dir">Dirección de entrega</label><textarea id="c-dir" className={styles.input} value={direccion} onChange={e => setDireccion(e.target.value)} />{err('direccion')}{err('delivery_address')}</div>
            )}
            <div className={styles.campo}>
              <label id="lbl-pago">¿Cómo vas a pagar?</label>
              <div className={cx(styles.seg, payOptions.length === 2 && styles.segDos)} role="radiogroup" aria-labelledby="lbl-pago">
                {payOptions.map(o => (
                  <button key={o.kind} type="button" role="radio" aria-checked={pago === o.kind} className={cx(styles.segB, pago === o.kind && styles.segOn)} onClick={() => setPago(o.kind)} data-testid={'pago-' + o.kind}>{o.label}</button>
                ))}
              </div>
            </div>
            {notes.truncated && <p className={styles.aviso} role="status" data-testid="aviso-notas">Algunas notas se recortaron para caber en el mensaje (máximo 500 caracteres).</p>}
            {err('general')}
            <div className={styles.campo}>
              <button type="button" className={cx(styles.btn, styles.btnWa)} onClick={() => void enviar()} disabled={enviando} data-testid="enviar-pedido">
                {enviando ? 'Enviando…' : 'Enviar pedido por WhatsApp'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
