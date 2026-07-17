'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, MessageCircle, ShoppingBag, Plus, Minus, CheckCircle, Loader2, MapPin } from 'lucide-react'
import { useCart } from './CartContext'
import { fmtUsd, fmtBs, isValidVePhone } from './catalogUtils'
import type { PaymentMethod } from './CatalogoGrid'
import styles from './catalogo.module.css'

interface DeliveryZone {
  nombre: string
  precio: number
}

interface DeliveryInfo {
  enabled:      boolean
  fee_default?: number
  zones?:       DeliveryZone[]
}

interface Props {
  slug:           string
  rate:           number
  paymentMethods: PaymentMethod[]
}

// EXCEPCIÓN DOCUMENTADA — Sprint 35.1 (movida desde CatalogoGrid)
// Colores de confeti para animación de celebración post-pedido.
// Uso puramente decorativo/animación — no UI funcional ni semántico.
const CONFETTI_COLORS = ['#3B82F6', '#FF6B35', '#FFD700', '#10B981', '#F472B6', '#8B5CF6', '#EF4444', '#06B6D4']

const confettiParticles = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  style: {
    left:              `${(i * 1.7 % 10) * 10}%`,
    animationDelay:    `${(i * 0.13) % 2.5}s`,
    animationDuration: `${2 + (i * 0.19) % 2}s`,
    background:        CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    width:             `${8 + (i % 6)}px`,
    height:            `${8 + (i % 4)}px`,
    borderRadius:      i % 3 === 0 ? '50%' : '3px',
  },
}))

// Drawer del carrito + checkout multipaso — compartido por las 3 rutas del
// catálogo (home, /productos, /p/[id]) vía CartContext.
export function CartDrawer({ slug, rate, paymentMethods }: Props) {
  const {
    cart, totalItems, subtotalUsd,
    cartOpen, setCartOpen,
    checkoutOpen, setCheckoutOpen,
    updateCartQty, clearCart,
  } = useCart()

  const [cName,          setCName]          = useState('')
  const [cPhone,         setCPhone]         = useState('')
  const [phoneError,     setPhoneError]     = useState(false)
  const [cRef,           setCRef]           = useState('')
  const [cPayment,       setCPayment]       = useState(paymentMethods[0]?.name ?? '')
  const [checkoutStep,    setCheckoutStep]    = useState<1 | 2 | 3>(1)
  const [deliveryType,    setDeliveryType]    = useState<'pickup' | 'delivery'>('pickup')
  const [recipientName,   setRecipientName]   = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [delivery,       setDelivery]       = useState<DeliveryInfo | null>(null)
  const [zoneIdx,        setZoneIdx]        = useState(-1)
  const [gpsLoading,     setGpsLoading]     = useState(false)
  const [gpsError,       setGpsError]       = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [submitted,      setSubmitted]      = useState(false)
  // Sin esto, un pedido que falla (stock, 422, red) no mostraba NADA -- el botón
  // "Enviar" parecía no hacer nada (fachada de éxito). Ver handleCheckout.
  const [checkoutError,  setCheckoutError]  = useState<string | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)

  const subtotalBs = subtotalUsd * rate

  const hasZones    = !!delivery?.enabled && (delivery.zones?.length ?? 0) > 0
  const hasFreeZone = !!delivery?.enabled && (delivery.zones?.length ?? 0) === 0
  const deliveryCost = deliveryType !== 'delivery'
    ? 0
    : hasZones
      ? (zoneIdx >= 0 ? delivery!.zones![zoneIdx].precio : 0)
      : hasFreeZone
        ? (delivery!.fee_default ?? 0)
        : 0
  const checkoutTotalUsd = subtotalUsd + deliveryCost

  // Scroll lock — cart drawer y checkout modal viven encima de cualquier página.
  useEffect(() => {
    const locked = cartOpen || checkoutOpen
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen, checkoutOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (checkoutOpen && !submitting) { setCheckoutOpen(false); return }
      if (cartOpen) setCartOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [cartOpen, checkoutOpen, submitting, setCartOpen, setCheckoutOpen])

  useEffect(() => {
    if (!checkoutOpen) return
    const t = setTimeout(() => nameRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [checkoutOpen])

  // Zona de delivery — se consulta cada vez que se abre "Antes de enviar"
  useEffect(() => {
    if (!checkoutOpen) return
    fetch(`/api/public/delivery/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then((j: DeliveryInfo | null) => { if (j) setDelivery(j) })
      .catch(() => {})
  }, [checkoutOpen, slug])

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Tu navegador no soporta geolocalización.')
      return
    }
    setGpsError('')
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          )
          if (!res.ok) throw new Error()
          const data = await res.json() as { display_name?: string }
          if (data.display_name) setDeliveryAddress(data.display_name)
          else setGpsError('No se pudo determinar la dirección.')
        } catch {
          setGpsError('No se pudo obtener la dirección. Intenta escribirla.')
        } finally {
          setGpsLoading(false)
        }
      },
      () => {
        setGpsError('No se pudo acceder a tu ubicación. Revisa los permisos.')
        setGpsLoading(false)
      },
    )
  }

  const handleCheckout = async () => {
    if (!cName.trim() || !cPhone.trim() || !cPayment.trim() || cart.length === 0) return
    if (!isValidVePhone(cPhone)) { setPhoneError(true); return }
    if (deliveryType === 'delivery' && hasZones && zoneIdx < 0) return
    setSubmitting(true)
    setCheckoutError(null)
    try {
      const baseRef = cRef.trim() || 'Sin especificar'
      const referenceWithZone = deliveryType !== 'delivery'
        ? baseRef
        : hasZones
          ? `${baseRef} · Zona: ${delivery!.zones![zoneIdx].nombre} · Costo delivery: ${fmtUsd(delivery!.zones![zoneIdx].precio)}`
          : hasFreeZone
            ? `${baseRef}${deliveryAddress.trim() ? ` · Dirección: ${deliveryAddress.trim()}` : ''} · Costo delivery: ${fmtUsd(delivery!.fee_default ?? 0)}`
            : baseRef

      const res = await fetch(`/api/catalog/${slug}/order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          items:              cart.map(i => ({ product_id: i.product_id, qty: i.qty, variant_id: i.variant_id })),
          customer_name:      cName.trim(),
          customer_phone:     cPhone.trim(),
          customer_reference: referenceWithZone,
          payment_method:     cPayment,
          delivery_type:      deliveryType,
          recipient_name:     recipientName.trim() || null,
          delivery_address:   deliveryAddress.trim() || null,
        }),
      })

      if (res.ok) {
        const data = await res.json() as { whatsapp_url: string | null }
        if (!data.whatsapp_url) {
          // Pedido creado pero el negocio no tiene WhatsApp configurado -> sin este aviso
          // el cliente creía que "no pasó nada". Se le da su número de pedido igual.
          setCheckoutError('Tu pedido se registró, pero este negocio aún no tiene WhatsApp configurado. Contáctalo directamente para coordinar.')
          clearCart()
          return
        }
        setSubmitted(true)
        window.open(data.whatsapp_url, '_blank', 'noopener,noreferrer')
        clearCart()
        setTimeout(() => {
          setSubmitted(false)
          setCheckoutOpen(false)
          setCartOpen(false)
          setCName(''); setCPhone(''); setCRef('')
          setCPayment(paymentMethods[0]?.name ?? '')
          setZoneIdx(-1)
          setCheckoutStep(1); setDeliveryType('pickup'); setRecipientName(''); setDeliveryAddress('')
        }, 3000)
      } else {
        // 409 stock, 422 validación, 429 rate limit, 404... antes se tragaba en silencio.
        const data = await res.json().catch(() => null) as { error?: string } | null
        setCheckoutError(data?.error ?? 'No se pudo enviar el pedido. Revisa los datos e intenta de nuevo.')
      }
    } catch {
      setCheckoutError('Error de conexión. Revisa tu internet e intenta de nuevo.')
    }
    finally { setSubmitting(false) }
  }

  return (
    <>
      {/* ── Cart drawer backdrop ────────────────────────────────── */}
      {cartOpen && (
        <div
          className={styles.drawerBackdrop}
          aria-hidden="true"
          onClick={() => { if (!checkoutOpen) setCartOpen(false) }}
        />
      )}

      {/* ── Cart drawer ─────────────────────────────────────────── */}
      {cartOpen && (
        <div className={styles.drawer} role="dialog" aria-modal="true" aria-label="Mi Pedido">
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitleGroup}>
              <h2 className={styles.drawerTitle}>Mi Pedido</h2>
              <span className={styles.drawerSubtitle}>Shopping Bag</span>
            </div>
            <button
              type="button"
              className={styles.drawerClose}
              onClick={() => setCartOpen(false)}
              aria-label="Cerrar carrito"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.drawerItems}>
            {cart.length === 0 ? (
              <div className={styles.drawerEmpty}>
                <ShoppingBag size={40} strokeWidth={1.25} aria-hidden="true" />
                <p className={styles.drawerEmptyText}>
                  Tu carrito está vacío.<br />Agrega productos para ordenar.
                </p>
              </div>
            ) : (
              cart.map(item => (
                <div key={`${item.product_id}-${item.variant_id ?? 'base'}`} className={styles.drawerItem}>
                  <div className={styles.drawerItemThumb}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} />
                    ) : (
                      <div className={`${styles.drawerItemThumbFallback} ${styles.gradDefault}`}>
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={styles.drawerItemInfo}>
                    <span className={styles.drawerItemName}>{item.name}</span>
                    {item.variant_label && (
                      <span className={styles.drawerItemVariant}>{item.variant_label}</span>
                    )}
                    <span className={styles.drawerItemPrice}>{fmtUsd(item.price_usd)} c/u</span>
                    <span className={styles.drawerItemPriceBs}>{fmtBs(item.price_usd * rate)} c/u</span>
                    <span className={styles.drawerItemSubtotal}>{fmtUsd(item.qty * item.price_usd)}</span>
                  </div>
                  <div className={styles.drawerQtyCtrl}>
                    <button
                      type="button"
                      className={styles.drawerQtyBtn}
                      onClick={() => updateCartQty(item.product_id, item.variant_id, -1)}
                      aria-label={`Reducir cantidad de ${item.name}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className={styles.drawerQtyNum}>{item.qty}</span>
                    <button
                      type="button"
                      className={styles.drawerQtyBtn}
                      onClick={() => updateCartQty(item.product_id, item.variant_id, 1)}
                      aria-label={`Aumentar cantidad de ${item.name}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className={styles.drawerFooter}>
              <div className={styles.drawerTotals}>
                <div className={styles.drawerTotalRow}>
                  <span className={styles.drawerTotalLabel}>Subtotal</span>
                  <span className={styles.drawerTotalUsd}>{fmtUsd(subtotalUsd)}</span>
                </div>
                <div className={styles.drawerTotalRow}>
                  <span className={styles.drawerTotalLabel}>Equivalente Bs.</span>
                  <span className={styles.drawerTotalBs}>{fmtBs(subtotalBs)}</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.drawerWaBtn}
                onClick={() => setCheckoutOpen(true)}
              >
                <MessageCircle size={18} aria-hidden="true" />
                Finalizar por WhatsApp
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Checkout modal — multipaso ──────────────────────────── */}
      {checkoutOpen && !submitted && (
        <div
          className={styles.checkoutOverlay}
          onClick={e => { if (e.target === e.currentTarget && !submitting) setCheckoutOpen(false) }}
        >
          <div className={styles.checkoutModal} role="dialog" aria-modal="true" aria-label="Completar pedido">

            {/* Stepper */}
            <div className={styles.checkoutStepper}>
              {([
                { n: 1, label: 'Contacto' },
                { n: 2, label: 'Entrega'  },
                { n: 3, label: 'Pago'     },
              ] as { n: 1|2|3; label: string }[]).map(({ n, label }, idx) => (
                <div key={n} className={styles.stepperItem}>
                  {idx > 0 && (
                    <div className={`${styles.stepperLine} ${checkoutStep > idx ? styles.done : ''}`} />
                  )}
                  <div className={styles.stepperDotWrapper}>
                    <div className={`${styles.stepperDot} ${
                      checkoutStep === n ? styles.stepperDotActive :
                      checkoutStep > n  ? styles.stepperDotDone   :
                                          styles.stepperDotPending
                    }`}>
                      {checkoutStep > n ? '✓' : n}
                    </div>
                    <span className={`${styles.stepperLabel} ${checkoutStep === n ? styles.stepperLabelActive : ''}`}>
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* PASO 1 — Contacto */}
            {checkoutStep === 1 && (
              <>
                <p className={styles.checkoutStepLabel}>Paso 1</p>
                <h3 className={styles.checkoutStepTitle}>Contacto</h3>
                <div className={styles.checkoutFields}>
                  <div className={styles.checkoutFieldGroup}>
                    <label className={styles.checkoutLabel} htmlFor="co-name">
                      Nombre <span className={styles.checkoutRequired}>*</span>
                    </label>
                    <input
                      ref={nameRef}
                      id="co-name"
                      type="text"
                      className={styles.checkoutInput}
                      value={cName}
                      onChange={e => setCName(e.target.value)}
                      placeholder="Tu nombre completo"
                      disabled={submitting}
                    />
                  </div>
                  <div className={styles.checkoutFieldGroup}>
                    <label className={styles.checkoutLabel} htmlFor="co-phone">
                      WhatsApp <span className={styles.checkoutRequired}>*</span>
                    </label>
                    <input
                      id="co-phone"
                      type="tel"
                      inputMode="numeric"
                      className={`${styles.checkoutInput} ${phoneError ? styles.checkoutInputError : ''}`}
                      value={cPhone}
                      onChange={e => { setCPhone(e.target.value); if (phoneError) setPhoneError(false) }}
                      placeholder="0412XXXXXXX"
                      aria-invalid={phoneError}
                      disabled={submitting}
                    />
                    {phoneError && (
                      <span className={styles.checkoutFieldError}>
                        Número inválido. Usa un celular venezolano (0412, 0414, 0416, 0424, 0426).
                      </span>
                    )}
                  </div>
                  <div className={styles.checkoutFieldGroup}>
                    <label className={styles.checkoutLabel} htmlFor="co-ref">
                      Referencia / Sector <span className={styles.checkoutOptional}>(opcional)</span>
                    </label>
                    <input
                      id="co-ref"
                      type="text"
                      className={styles.checkoutInput}
                      value={cRef}
                      onChange={e => setCRef(e.target.value)}
                      placeholder="Ej: El Paraíso, piso 2"
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className={styles.checkoutNavRow}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => {
                      setCheckoutOpen(false)
                      setCheckoutStep(1); setDeliveryType('pickup'); setRecipientName(''); setDeliveryAddress('')
                    }}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={styles.btnNext}
                    disabled={!cName.trim() || !cPhone.trim()}
                    onClick={() => {
                      if (!isValidVePhone(cPhone)) { setPhoneError(true); return }
                      setCheckoutStep(2)
                    }}
                  >
                    Continuar →
                  </button>
                </div>
              </>
            )}

            {/* PASO 2 — Entrega */}
            {checkoutStep === 2 && (
              <>
                <p className={styles.checkoutStepLabel}>Paso 2</p>
                <h3 className={styles.checkoutStepTitle}>¿Cómo recibes tu pedido?</h3>
                <div className={styles.deliveryOptions}>
                  <button
                    type="button"
                    className={`${styles.deliveryOption} ${deliveryType === 'pickup' ? styles.deliveryOptionActive : ''}`}
                    onClick={() => setDeliveryType('pickup')}
                  >
                    <p className={styles.deliveryOptionTitle}>Retirar en tienda</p>
                    <p className={styles.deliveryOptionDesc}>Pasas a buscar tu pedido directamente en el local.</p>
                  </button>
                  <button
                    type="button"
                    className={`${styles.deliveryOption} ${deliveryType === 'delivery' ? styles.deliveryOptionActive : ''}`}
                    onClick={() => setDeliveryType('delivery')}
                  >
                    <p className={styles.deliveryOptionTitle}>Envío a domicilio</p>
                    <p className={styles.deliveryOptionDesc}>Te llevamos el pedido a tu dirección.</p>
                  </button>
                </div>

                {deliveryType === 'delivery' && (
                  <div className={styles.deliveryFields}>
                    <div className={styles.checkoutFieldGroup}>
                      <label className={styles.checkoutLabel} htmlFor="co-recipient">
                        Nombre de quien recibe
                      </label>
                      <input
                        id="co-recipient"
                        type="text"
                        className={styles.checkoutInput}
                        value={recipientName}
                        onChange={e => setRecipientName(e.target.value)}
                        placeholder="Nombre y apellido"
                        disabled={submitting}
                      />
                    </div>

                    {hasZones ? (
                      <div className={styles.checkoutFieldGroup}>
                        <label className={styles.checkoutLabel} htmlFor="co-zone">
                          Zona de entrega <span className={styles.checkoutRequired}>*</span>
                        </label>
                        <select
                          id="co-zone"
                          className={styles.checkoutSelect}
                          value={zoneIdx}
                          onChange={e => setZoneIdx(Number(e.target.value))}
                          disabled={submitting}
                        >
                          <option value={-1} disabled>Selecciona tu zona…</option>
                          {delivery!.zones!.map((z, i) => (
                            <option key={z.nombre} value={i}>{z.nombre} — {fmtUsd(z.precio)}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className={styles.checkoutFieldGroup}>
                        <label className={styles.checkoutLabel} htmlFor="co-address">
                          Dirección completa
                        </label>
                        <input
                          id="co-address"
                          type="text"
                          className={styles.checkoutInput}
                          value={deliveryAddress}
                          onChange={e => setDeliveryAddress(e.target.value)}
                          placeholder="Calle, edificio, referencia"
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          className={styles.gpsBtn}
                          onClick={handleUseMyLocation}
                          disabled={submitting || gpsLoading}
                        >
                          {gpsLoading
                            ? <Loader2 size={14} className={styles.gpsSpinner} aria-hidden="true" />
                            : <MapPin size={14} aria-hidden="true" />}
                          {gpsLoading ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
                        </button>
                        {gpsError && <span className={styles.gpsError}>{gpsError}</span>}
                      </div>
                    )}

                    {(hasZones || hasFreeZone) && (
                      <div className={styles.checkoutTotalRow}>
                        <span className={styles.checkoutTotalLabel}>Total con delivery</span>
                        <span className={styles.checkoutTotalValue}>{fmtUsd(checkoutTotalUsd)}</span>
                      </div>
                    )}
                  </div>
                )}

                {deliveryType === 'delivery' && (
                  <div className={styles.deliveryNotice}>
                    <span className={styles.deliveryNoticeIcon}>ℹ️</span>
                    <p className={styles.deliveryNoticeText}>
                      El costo de envío puede variar según tu zona.
                      Te contactamos por WhatsApp para coordinarlo antes de confirmar.
                    </p>
                  </div>
                )}

                <div className={styles.checkoutNavRow}>
                  <button type="button" className={styles.btnBack} onClick={() => setCheckoutStep(1)}>
                    ← Volver
                  </button>
                  <button
                    type="button"
                    className={styles.btnNext}
                    disabled={deliveryType === 'delivery' && hasZones && zoneIdx < 0}
                    onClick={() => setCheckoutStep(3)}
                  >
                    Continuar →
                  </button>
                </div>
              </>
            )}

            {/* PASO 3 — Pago y confirmación */}
            {checkoutStep === 3 && (
              <>
                <p className={styles.checkoutStepLabel}>Paso 3</p>
                <h3 className={styles.checkoutStepTitle}>Método de pago</h3>

                {paymentMethods.length > 0 && (
                  <div className={styles.paymentCards}>
                    {paymentMethods.map(pm => (
                      <button
                        key={pm.id}
                        type="button"
                        className={`${styles.paymentCard} ${cPayment === pm.name ? styles.paymentCardActive : ''}`}
                        onClick={() => setCPayment(pm.name)}
                        disabled={submitting}
                      >
                        <p className={styles.paymentCardName}>{pm.name}</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Resumen antes de confirmar */}
                <div className={styles.checkoutSummaryBox}>
                  <div className={styles.checkoutSummaryRow}>
                    <span className={styles.checkoutSummaryLabel}>Entrega</span>
                    <span className={styles.checkoutSummaryValue}>
                      {deliveryType === 'pickup' ? 'Retirar en tienda' : 'Envío a domicilio'}
                    </span>
                  </div>
                  <div className={styles.checkoutSummaryRow}>
                    <span className={styles.checkoutSummaryLabel}>Contacto</span>
                    <span className={styles.checkoutSummaryValue}>{cName} · {cPhone}</span>
                  </div>
                  {deliveryType === 'delivery' && deliveryAddress && (
                    <div className={styles.checkoutSummaryRow}>
                      <span className={styles.checkoutSummaryLabel}>Dirección</span>
                      <span className={styles.checkoutSummaryValue}>{deliveryAddress}</span>
                    </div>
                  )}
                  {deliveryType === 'delivery' && hasZones && zoneIdx >= 0 && (
                    <div className={styles.checkoutSummaryRow}>
                      <span className={styles.checkoutSummaryLabel}>Zona</span>
                      <span className={styles.checkoutSummaryValue}>{delivery!.zones![zoneIdx].nombre}</span>
                    </div>
                  )}
                  <div className={styles.checkoutSummaryRow}>
                    <span className={styles.checkoutSummaryLabel}>Total</span>
                    <span className={styles.checkoutSummaryValue}>
                      {fmtUsd(checkoutTotalUsd)} · {fmtBs(checkoutTotalUsd * rate)}
                    </span>
                  </div>
                </div>

                {checkoutError && (
                  <p className={styles.checkoutError} role="alert">{checkoutError}</p>
                )}

                <div className={styles.checkoutNavRow}>
                  <button type="button" className={styles.btnBack} onClick={() => setCheckoutStep(2)} disabled={submitting}>
                    ← Volver
                  </button>
                  <button
                    type="button"
                    className={styles.sendBtn}
                    onClick={handleCheckout}
                    disabled={submitting || !cPayment || cart.length === 0}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    {submitting ? 'Enviando…' : 'Enviar por WhatsApp'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ── Celebration overlay ─────────────────────────────────── */}
      {submitted && (
        <div className={styles.celebrationOverlay}>
          <div className={styles.confettiWrap} aria-hidden="true">
            {confettiParticles.map(p => (
              <div key={p.id} className={styles.confettiPiece} style={p.style} />
            ))}
          </div>
          <motion.div
            className={styles.celebrationCard}
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          >
            <div className={styles.celebrationIconWrap}>
              <CheckCircle size={48} aria-hidden="true" />
            </div>
            <h2 className={styles.celebrationTitle}>¡Gracias por tu compra!</h2>
            <p className={styles.celebrationSubtitle}>
              Tu pedido fue enviado por WhatsApp.<br />El negocio lo recibirá en breve.
            </p>
            <button
              type="button"
              className={styles.celebrationBtn}
              onClick={() => { setSubmitted(false); setCheckoutOpen(false) }}
            >
              Seguir comprando
            </button>
          </motion.div>
        </div>
      )}
    </>
  )
}
