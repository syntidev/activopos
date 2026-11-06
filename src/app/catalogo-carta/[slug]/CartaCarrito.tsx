'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { optionsKeyOf, useCart, type CartItem } from '@/app/catalogo-premium/[slug]/CartContext'
import { getPulsoOrderContext } from '@/lib/pulso-client'
import { buildCartaMessage } from '@/lib/carta/whatsapp'
import { checkCedula, normalizeCedula } from '@/lib/cedula'
import { clearCheckoutMemory, loadCheckoutMemory, saveCheckoutMemory } from '@/lib/checkout-memory'
import { hasUsablePhone } from '@/lib/customer-identity'
import { CartaOpciones, elegidasDeCarrito, gruposFaltantes, opcionesDeCarrito, type Elegidas } from './CartaOpciones'
import { cx, fmtBs, fmtUsd } from './util'
import styles from './carta.module.css'
import type { CartaDish, CartaPayOption } from '@/types/carta'

interface CartaCarritoProps {
  slug:         string
  rate:         number
  payOptions:   CartaPayOption[]
  businessName: string
  /** WhatsApp del negocio (solo dígitos, formato internacional); null si no hay uno válido. */
  whatsapp:     string | null
  /** false = el negocio está cerrado o en pausa: se puede armar el pedido pero no enviarlo. */
  acepta:       boolean
  dishes:       CartaDish[]
}

type Modalidad = 'aqui' | 'llevar' | 'delivery'
const MODALIDAD_LABEL: Record<Modalidad, string> = { aqui: 'Comer aquí', llevar: 'Para llevar', delivery: 'Delivery' }
const MODALIDADES: Modalidad[] = ['aqui', 'llevar', 'delivery']

interface Hecho { numero: string | null; message: string; url: string | null; respaldo: boolean }
interface OrderErrorBody { error?: string; field?: string }

const keyOf = (i: CartItem): string => i.product_id + '|' + (i.variant_id ?? 0) + '|' + (i.note ?? '') + '|' + optionsKeyOf(i.options)
const detalleDe = (i: CartItem): string => [i.variant_label, ...(i.options ?? []).map(o => o.name), i.note ? 'Nota: ' + i.note : null].filter(Boolean).join(' · ')
const waUrl = (wa: string | null, message: string): string | null => (wa ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent(message) : null)

/** Carrito y pedido: editar cantidad, opciones y nota, quitar con confirmación, y envío por POST /order + WhatsApp (mensaje del contrato). */
export function CartaCarrito({ slug, rate, payOptions, businessName, whatsapp, acepta, dishes }: CartaCarritoProps) {
  const { cart, cartOpen, setCartOpen, subtotalUsd, updateCartQty, removeFromCart, replaceLine, clearCart } = useCart()
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const dishById = useMemo(() => new Map(dishes.map(d => [d.id, d])), [dishes])

  const [modalidad, setModalidad] = useState<Modalidad>('llevar')
  const [mesa, setMesa] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cedula, setCedula] = useState('')
  const [direccion, setDireccion] = useState('')
  const [zona, setZona] = useState('')
  const [referencia, setReferencia] = useState('')
  const [memoria, setMemoria] = useState(false) // aviso "Usamos tus datos del último pedido"
  const [pago, setPago] = useState<CartaPayOption['kind']>(payOptions[0]?.kind ?? 'bs')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<{ campo: string; mensaje: string } | null>(null)
  const [hecho, setHecho] = useState<Hecho | null>(null)
  const [quitando, setQuitando] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [edElegidas, setEdElegidas] = useState<Elegidas>({})
  const [edNota, setEdNota] = useState('')

  useEffect(() => {
    if (!cartOpen) return
    cerrarRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setCartOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cartOpen, setCartOpen])

  // Mismo dispositivo: precarga los datos del último pedido (solo localStorage; "No soy yo" los borra).
  useEffect(() => {
    if (!cartOpen) return
    const m = loadCheckoutMemory(slug)
    if (!m) return
    setNombre(prev => prev || m.name)
    setTelefono(prev => prev || m.phone)
    setCedula(prev => prev || m.cedula)
    setDireccion(prev => prev || m.address)
    setMemoria(true)
  }, [cartOpen, slug])

  // Dispositivo nuevo: con cédula Y teléfono del mismo cliente el servidor devuelve nombre y dirección (con solo la cédula, nada).
  useEffect(() => {
    const ced = normalizeCedula(cedula)
    if (!cartOpen || !ced || !hasUsablePhone(telefono)) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch('/api/catalog/' + slug + '/saved-address', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ customer_cedula: ced, customer_phone: telefono.trim() }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then((j: { prefill?: { name: string; address: string | null } } | null) => {
          const prefill = j?.prefill
          if (!prefill) return
          setNombre(prev => prev || prefill.name)
          if (prefill.address) setDireccion(prev => prev || (prefill.address ?? ''))
        })
        .catch(() => undefined)
    }, 400)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [cartOpen, slug, cedula, telefono])

  if (!cartOpen) return null

  const noSoyYo = (): void => {
    clearCheckoutMemory(slug)
    setNombre(''); setTelefono(''); setCedula(''); setDireccion(''); setZona(''); setReferencia(''); setMemoria(false)
  }

  const label = MODALIDAD_LABEL[modalidad] + (modalidad === 'aqui' && mesa.trim() ? ' · Mesa ' + mesa.trim() : '')
  const opcion = payOptions.find(o => o.kind === pago) ?? payOptions[0]

  const menos = (i: CartItem): void => {
    if (i.qty <= 1) { setQuitando(keyOf(i)); return }
    updateCartQty(i.product_id, i.variant_id, -1, i.note, optionsKeyOf(i.options))
  }

  const abrirEditor = (i: CartItem): void => {
    const d = dishById.get(i.product_id)
    setEditando(keyOf(i))
    setEdElegidas(elegidasDeCarrito(d?.groups ?? [], i.options))
    setEdNota(i.note ?? '')
  }

  const guardarEdicion = (i: CartItem): void => {
    const d = dishById.get(i.product_id)
    const groups = d?.groups ?? []
    const options = opcionesDeCarrito(groups, edElegidas)
    const extraViejo = (i.options ?? []).reduce((s, o) => s + o.price_usd, 0)
    const extraNuevo = options.reduce((s, o) => s + o.price_usd, 0)
    const nota = edNota.trim()
    replaceLine(i, {
      ...i,
      price_usd: Math.round((i.price_usd - extraViejo + extraNuevo) * 100) / 100,
      options:   options.length > 0 ? options : undefined,
      note:      nota ? nota : undefined,
    })
    setEditando(null)
  }

  const validar = (): { campo: string; mensaje: string } | null => {
    // Solo bloquean nombre (cualquier texto) y teléfono (10-11 dígitos). La cédula la exige únicamente Cashea; el delivery nunca bloquea.
    if (nombre.trim().length < 1) return { campo: 'nombre', mensaje: 'Escribe tu nombre.' }
    if (!hasUsablePhone(telefono)) return { campo: 'telefono', mensaje: 'Escribe tu teléfono con 10 u 11 dígitos, por ejemplo 04241234567.' }
    if (pago === 'cashea') {
      const ced = checkCedula(cedula, 'Cashea', false)
      if (!ced.ok) return { campo: 'cedula', mensaje: ced.message }
    }
    return null
  }

  // Delivery = zona + dirección + referencia (todo opcional: nada bloquea; lo que falte lo confirma el negocio por WhatsApp).
  const direccionCompleta = [zona.trim(), direccion.trim(), referencia.trim() ? 'Ref: ' + referencia.trim() : ''].filter(Boolean).join(' · ')

  const mensaje = (numero: string | null): string => buildCartaMessage({
    orderNumber: numero, business: businessName, modalidad: label, address: modalidad === 'delivery' ? direccionCompleta : undefined, client: nombre.trim(), phone: telefono.trim(), pago: opcion?.label ?? '', rate,
    lines: cart.map(i => ({
      qty: i.qty, name: i.name, detail: [i.variant_label, ...(i.options ?? []).map(o => o.name)].filter(Boolean).join(', ') || undefined,
      subtotalUsd: Math.round(i.price_usd * i.qty * 100) / 100, note: i.note,
    })),
  })

  const terminar = (numero: string | null, respaldo: boolean): void => {
    const message = mensaje(numero)
    const url = waUrl(whatsapp, message)
    setHecho({ numero, message, url, respaldo })
    clearCart()
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const enviar = async (): Promise<void> => {
    const falta = validar()
    if (falta) { setError(falta); return }
    setError(null)
    setEnviando(true)
    try {
      const res = await fetch('/api/catalog/' + slug + '/order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          items: cart.map(i => ({
            product_id: i.product_id, qty: i.qty, variant_id: i.variant_id,
            ...(i.options && i.options.length > 0 ? { options: i.options.map(o => o.id) } : {}),
            ...(i.note ? { note: i.note } : {}),
          })),
          customer_name:      nombre.trim(),
          customer_phone:     telefono.trim(),
          customer_reference: label,
          payment_method:     opcion?.method ?? 'Bs',
          payment_kind:       opcion?.kind ?? 'bs',
          customer_cedula:    cedula.trim() || null,
          delivery_type:      modalidad === 'delivery' ? 'delivery' : 'pickup',
          recipient_name:     modalidad === 'delivery' ? nombre.trim() : null,
          delivery_address:   modalidad === 'delivery' ? (direccionCompleta || null) : null,
          pulso:              getPulsoOrderContext() ?? undefined,
        }),
      })
      if (res.ok) {
        saveCheckoutMemory(slug, { name: nombre.trim(), cedula: cedula.trim(), phone: telefono.trim(), methodId: null, branchOffice: '', address: direccion.trim() })
        const data = await res.json() as { ticket_number: string }
        terminar(data.ticket_number, false)
      } else if (res.status >= 500) {
        terminar(null, true) // el registro falló: el mensaje se envía igual, sin número, y se avisa
      } else {
        const body = await res.json().catch(() => null) as OrderErrorBody | null
        setError({ campo: body?.field ?? 'general', mensaje: body?.error ?? 'No se pudo enviar el pedido. Revisa los datos e intenta de nuevo.' })
      }
    } catch {
      terminar(null, true)
    } finally {
      setEnviando(false)
    }
  }

  const cerrar = (): void => { setCartOpen(false); if (hecho) setHecho(null) }
  const err = (campo: string): JSX.Element | null => (error?.campo === campo ? <p className={styles.error} role="alert">{error.mensaje}</p> : null)

  return (
    <>
      <div className={styles.velo} onClick={cerrar} aria-hidden="true" />
      <div className={styles.hoja} role="dialog" aria-modal="true" aria-label="Mi pedido" data-testid="carta-carrito">
        <div className={styles.hojaH}>
          <h2>{hecho ? 'Pedido enviado' : 'Mi pedido'}</h2>
          <button type="button" className={styles.cerrar} onClick={cerrar} ref={cerrarRef} aria-label="Cerrar mi pedido"><X size={20} aria-hidden="true" /></button>
        </div>

        {hecho ? (
          <div className={styles.centro} data-testid="carta-confirmacion">
            <p className={styles.fichaDesc}>Abre WhatsApp para enviarnos el mensaje y confirmar tu pedido.</p>
            {hecho.numero && <div className={styles.ticket} data-testid="carta-numero-pedido">{hecho.numero}</div>}
            {hecho.respaldo && <p className={styles.aviso} data-testid="carta-aviso-respaldo" role="status">No pudimos registrar tu pedido en el sistema, pero el mensaje está listo: envíalo por WhatsApp y te atendemos igual.</p>}
            <div className={styles.msg} data-testid="carta-mensaje-wa">{hecho.message}</div>
            {hecho.url ? (
              <a className={cx(styles.btn, styles.btnWa)} href={hecho.url} target="_blank" rel="noopener noreferrer" data-testid="carta-abrir-wa">Abrir WhatsApp</a>
            ) : (
              <p className={styles.aviso}>Este negocio aún no tiene un WhatsApp válido configurado. Contáctalo directamente para coordinar.</p>
            )}
            <button type="button" className={cx(styles.btn, styles.btnAlt)} onClick={cerrar}>Volver a la carta</button>
          </div>
        ) : cart.length === 0 ? (
          <div className={styles.centro}>
            <p className={styles.fichaDesc} data-testid="carta-carrito-vacio">Tu pedido está vacío. Agrega platos de la carta.</p>
            <button type="button" className={cx(styles.btn, styles.btnAlt)} onClick={cerrar}>Ver la carta</button>
          </div>
        ) : (
          <>
            {cart.map(i => {
              const k = keyOf(i)
              const d = dishById.get(i.product_id)
              const faltan = editando === k ? gruposFaltantes(d?.groups ?? [], edElegidas) : []
              return (
                <div key={k} className={styles.lineaBloque} data-testid="carta-linea">
                  <div className={styles.linea}>
                    <div>
                      <div className={styles.lineaN}>{i.name}</div>
                      {detalleDe(i) && <div className={styles.lineaM} data-testid="carta-linea-detalle">{detalleDe(i)}</div>}
                      <div className={styles.pasos}>
                        <button type="button" className={styles.paso} onClick={() => menos(i)} aria-label={'Quitar uno de ' + i.name} data-testid="carta-linea-menos">−</button>
                        <span className={styles.cant} data-testid="carta-linea-cantidad">{i.qty}</span>
                        <button type="button" className={cx(styles.paso, styles.pasoMas)} onClick={() => updateCartQty(i.product_id, i.variant_id, 1, i.note, optionsKeyOf(i.options))} aria-label={'Agregar uno más de ' + i.name} data-testid="carta-linea-mas">+</button>
                        <button type="button" className={styles.quitar} onClick={() => (editando === k ? setEditando(null) : abrirEditor(i))} data-testid="carta-linea-editar">{editando === k ? 'Cerrar' : 'Editar'}</button>
                        <button type="button" className={styles.quitar} onClick={() => setQuitando(k)} data-testid="carta-linea-quitar">Quitar</button>
                      </div>
                    </div>
                    <div className={styles.lineaP}><span data-testid="carta-linea-total">{fmtUsd(i.price_usd * i.qty)}</span><div className={styles.lineaM}>{fmtBs(i.price_usd * i.qty * rate)}</div></div>
                  </div>

                  {quitando === k && (
                    <div className={styles.confirmar} role="alertdialog" aria-label={'Quitar ' + i.name} data-testid="carta-quitar-dialogo">
                      <p>¿Quitar {i.name} de tu pedido?</p>
                      <div className={styles.confirmarBtns}>
                        <button type="button" className={cx(styles.btn, styles.btnAlt)} onClick={() => setQuitando(null)} data-testid="carta-quitar-cancelar">Cancelar</button>
                        <button type="button" className={styles.btn} onClick={() => { removeFromCart(i.product_id, i.variant_id, i.note, optionsKeyOf(i.options)); setQuitando(null) }} data-testid="carta-quitar-confirmar">Quitar</button>
                      </div>
                    </div>
                  )}

                  {editando === k && (
                    <div className={styles.editor} data-testid="carta-linea-editor">
                      <CartaOpciones groups={d?.groups ?? []} elegidas={edElegidas} onChange={setEdElegidas} />
                      <div className={styles.campo}>
                        <label htmlFor={'nota-' + k}>Nota para la cocina</label>
                        <textarea id={'nota-' + k} className={styles.input} maxLength={140} value={edNota} onChange={e => setEdNota(e.target.value)} data-testid="carta-linea-nota" />
                      </div>
                      {faltan.length > 0 && <p className={styles.aviso} role="status">Elige {faltan.map(g => g.name).join(' y ')} para guardar.</p>}
                      <button type="button" className={styles.btn} onClick={() => guardarEdicion(i)} disabled={faltan.length > 0} data-testid="carta-linea-guardar">Guardar cambios</button>
                    </div>
                  )}
                </div>
              )
            })}

            <div className={styles.total}>
              <span>Total</span>
              <div>
                <div className={styles.totalBig} data-testid="carta-total-usd">{fmtUsd(subtotalUsd)}</div>
                <div className={styles.totalBs} data-testid="carta-total-bs">{fmtBs(subtotalUsd * rate)}</div>
              </div>
            </div>

            {memoria && (
              <p className={styles.aviso} role="status" data-testid="carta-memoria">
                Usamos tus datos del último pedido ·{' '}
                <button type="button" className={styles.quitar} onClick={() => setMemoria(false)}>Cambiar</button>{' '}·{' '}
                <button type="button" className={styles.quitar} data-testid="carta-no-soy-yo" onClick={noSoyYo}>No soy yo</button>
              </p>
            )}
            <div className={styles.campo}>
              <label id="lbl-modalidad">¿Cómo lo quieres?</label>
              <div className={styles.seg} role="radiogroup" aria-labelledby="lbl-modalidad">
                {MODALIDADES.map(m => (
                  <button key={m} type="button" role="radio" aria-checked={modalidad === m} className={cx(styles.segB, modalidad === m && styles.segOn)} onClick={() => setModalidad(m)} data-testid={'carta-modalidad-' + m}>{MODALIDAD_LABEL[m]}</button>
                ))}
              </div>
            </div>
            {modalidad === 'aqui' && (
              <div className={styles.campo}><label htmlFor="c-mesa">Mesa (opcional)</label><input id="c-mesa" className={styles.input} value={mesa} onChange={e => setMesa(e.target.value)} maxLength={20} data-testid="carta-mesa" /></div>
            )}
            <div className={styles.campo}><label htmlFor="c-nombre">Tu nombre</label><input id="c-nombre" className={styles.input} value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" data-testid="carta-nombre-cliente" />{err('nombre')}</div>
            <div className={styles.campo}><label htmlFor="c-tel">Teléfono</label><input id="c-tel" className={styles.input} value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" autoComplete="tel" data-testid="carta-telefono" />{err('telefono')}{err('customer_phone')}</div>
            <div className={styles.campo}><label htmlFor="c-ced">Cédula (opcional)</label><input id="c-ced" className={styles.input} value={cedula} onChange={e => setCedula(e.target.value)} placeholder="21222819" inputMode="numeric" autoComplete="off" data-testid="carta-cedula" />{err('cedula')}{err('customer_cedula')}</div>
            {modalidad === 'delivery' && (
              <>
                <div className={styles.campo}><label htmlFor="c-zona">Zona (opcional)</label><input id="c-zona" className={styles.input} value={zona} onChange={e => setZona(e.target.value)} maxLength={60} data-testid="carta-zona" /></div>
                <div className={styles.campo}><label htmlFor="c-dir">Dirección de entrega (opcional)</label><textarea id="c-dir" className={styles.input} value={direccion} onChange={e => setDireccion(e.target.value)} data-testid="carta-direccion" />{err('delivery_address')}</div>
                <div className={styles.campo}><label htmlFor="c-ref">Punto de referencia (opcional)</label><input id="c-ref" className={styles.input} value={referencia} onChange={e => setReferencia(e.target.value)} maxLength={80} data-testid="carta-referencia" /></div>
              </>
            )}
            <div className={styles.campo}>
              <label id="lbl-pago">¿Cómo vas a pagar?</label>
              <div className={cx(styles.seg, payOptions.length === 2 && styles.segDos, payOptions.length === 1 && styles.segUno)} role="radiogroup" aria-labelledby="lbl-pago">
                {payOptions.map(o => (
                  <button key={o.kind} type="button" role="radio" aria-checked={pago === o.kind} className={cx(styles.segB, pago === o.kind && styles.segOn)} onClick={() => setPago(o.kind)} data-testid={'carta-pago-' + o.kind}>{o.label}</button>
                ))}
              </div>
            </div>
            {err('general')}{err('items')}{err('options')}
            {!acepta && (
              <div className={styles.cerradoAviso} role="status" data-testid="carta-aviso-cerrado">
                <p>Estamos cerrados ahora: puedes armar tu pedido, pero solo lo recibimos cuando estemos abiertos.</p>
                {whatsapp && <a className={cx(styles.btn, styles.btnAlt)} href={waUrl(whatsapp, 'Hola, ' + businessName + '. Avísame cuando abran para hacer mi pedido.') ?? '#'} target="_blank" rel="noopener noreferrer" data-testid="carta-avisame">Avísame por WhatsApp</a>}
              </div>
            )}
            <div className={styles.campo}>
              <button type="button" className={cx(styles.btn, styles.btnWa)} onClick={() => void enviar()} disabled={enviando || !acepta} data-testid="carta-enviar">
                {enviando ? 'Enviando…' : 'Enviar pedido por WhatsApp'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
