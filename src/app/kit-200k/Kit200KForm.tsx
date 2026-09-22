'use client'

import { useState, useRef, useEffect } from 'react'
import { CatalogHeader } from '../catalogo-premium/[slug]/CatalogHeader'
import { CatalogFooter } from '../catalogo-premium/[slug]/CatalogFooter'
import styles from './kit200k.module.css'

const TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] as const
const TALLAS_NINOS = ['4', '6', '8', '10', '12', '14'] as const
// Mismo patrón que createReservaSchema (src/lib/reservas.ts) -- validación
// visual aquí, la real (fuente de verdad) es la del servidor.
const CEDULA_RE = /^[VEve]-\d{6,9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Extra {
  nombre: string
  cantidad: number
  talla: string | null
}

interface Props {
  slug:             string
  kitId:            number
  businessName:     string
  businessLogo:     string | null
  businessCity:     string | null
  catalogDesc:      string | null
  rif:              string | null
  address:          string | null
  location:         string
  waPhone:          string
  phone:            string | null
  catalogInstagram: string | null
  catalogHours:     string | null
}

function TallaChips({
  tallas,
  value,
  onChange,
}: {
  tallas: readonly string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className={styles.tallaGrid}>
      {tallas.map(t => (
        <button
          key={t}
          type="button"
          className={`${styles.tallaChip} ${value === t ? styles.tallaChipActive : ''}`}
          aria-pressed={value === t}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className={styles.stepperRow}>
      <button type="button" className={styles.stepBtn} aria-label="Disminuir cantidad" onClick={() => onChange(Math.max(1, value - 1))}>−</button>
      <span className={styles.stepValue}>{value}</span>
      <button type="button" className={styles.stepBtn} aria-label="Aumentar cantidad" onClick={() => onChange(Math.min(20, value + 1))}>+</button>
    </div>
  )
}

export function Kit200KForm({
  slug, kitId, businessName, businessLogo, businessCity,
  catalogDesc, rif, address, location, waPhone, phone, catalogInstagram, catalogHours,
}: Props) {
  const headerRef = useRef<HTMLElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  // .page es el scroller real (mismo patrón que .root en CatalogoGrid) --
  // overflow-x:hidden por sí solo vuelve sticky inerte sin un scroller con
  // alto fijo (ver comentario en kit200k.module.css .page), por eso .page
  // scrollea, no window.
  useEffect(() => {
    const scroller = headerRef.current?.parentElement
    if (!scroller) return
    const onScroll = () => setIsScrolled(scroller.scrollTop > 8)
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  const [maillotTalla, setMaillotTalla] = useState('L')
  const [franelaTalla, setFranelaTalla] = useState('S')

  const [damasTalla, setDamasTalla] = useState('XS')
  const [damasQty, setDamasQty] = useState(1)
  const [caballerosTalla, setCaballerosTalla] = useState('M')
  const [caballerosQty, setCaballerosQty] = useState(1)
  const [ninosTalla, setNinosTalla] = useState('10')
  const [ninosQty, setNinosQty] = useState(1)
  const [maillotExtraTalla, setMaillotExtraTalla] = useState('M')
  const [maillotExtraQty, setMaillotExtraQty] = useState(1)

  const [extras, setExtras] = useState<Extra[]>([])

  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteCedula, setClienteCedula] = useState('')
  const [clienteCorreo, setClienteCorreo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState<string | null>(null)
  // Asistente de 3 pasos (mismo patrón visual que el checkout del catálogo
  // general: Contacto -> revisión -> confirmar). Contenido propio: Kit 200K
  // es preventa, sin entrega ni cobro ("pagas al retirar"), así que los
  // pasos 2/3 no son Entrega/Pago -- son Revisar tu kit / Confirmar.
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1)

  const addExtra = (nombre: string, cantidad: number, talla: string | null) => {
    setExtras(prev => [...prev, { nombre, cantidad, talla }])
  }
  const removeExtra = (idx: number) => {
    setExtras(prev => prev.filter((_, i) => i !== idx))
  }

  // Talla independiente por componente -- schema real (componentes_tallas),
  // ya no el workaround de extras[]. No se muestra como línea propia en el
  // resumen: el mockup no la itemiza, va implícita en "Kit 200K".
  const visibleExtras: Extra[] = [
    { nombre: 'Medalla Finalista', cantidad: 1, talla: null },
    ...extras,
  ]

  const handleSubmit = async () => {
    if (!clienteNombre.trim() || !clienteTelefono.trim() || !CEDULA_RE.test(clienteCedula.trim()) || !EMAIL_RE.test(clienteCorreo.trim()) || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/public/reservas/${slug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nombre:   clienteNombre.trim(),
          cliente_telefono: clienteTelefono.trim(),
          cliente_cedula:   clienteCedula.trim(),
          cliente_correo:   clienteCorreo.trim(),
          kit_id:           kitId,
          talla:            maillotTalla,
          componentes_tallas: { maillot: maillotTalla, franela: franelaTalla },
          cantidad:         1,
          extras:           visibleExtras,
        }),
      })
      const data: { ok: boolean; reserva?: { ticket_number: string }; error?: string } = await res.json()
      if (!res.ok || !data.ok || !data.reserva) {
        setError(data.error ?? 'No se pudo confirmar la reserva. Intenta de nuevo.')
        return
      }
      setTicket(data.reserva.ticket_number)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (ticket) {
    return (
      <div className={styles.page}>
        <div className={styles.confirmWrap}>
          <div className={styles.confirmCard}>
            <div className={styles.disp} style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>¡Reserva confirmada!</div>
            <p style={{ fontSize: 32, fontWeight: 700, color: '#0B4FCC', margin: '8px 0' }}>{ticket}</p>
            <p style={{ fontSize: 14, color: '#666' }}>Recibirás tu número de ticket por WhatsApp. Preséntalo al retirar tu kit.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Header real del catálogo (compartido con /catalogo-premium/onbike) --
          showIconCluster=false: esta página no tiene búsqueda de productos ni
          carrito (no es CatalogoGrid), mostrar esos botones sería un botón sin
          función real. */}
      <CatalogHeader
        ref={headerRef}
        slug={slug}
        businessName={businessName}
        businessLogo={businessLogo}
        businessCity={businessCity}
        isScrolled={isScrolled}
        showIconCluster={false}
      />

      {/* 1. Hero */}
      <div className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kit-200k/hero.jpg" alt="Kit Oficial 200K sobre maniquí" className={styles.heroImg} />
        <div className={styles.heroScrim} aria-hidden="true" />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>GRAN FONDO VIRGEN DEL VALLE — 8 SEPTIEMBRE 2027</div>
          <div className={`${styles.disp} ${styles.heroTitle}`}>Kit Oficial 200K</div>
          <div className={styles.heroDesc}>
            Maillot + Medias oficiales del evento. Reserva ahora — la fábrica
            arma el pedido con el número exacto de reservas confirmadas.
          </div>
          <a href="#reserva" className={styles.btnPrimary}>Reservar mi kit</a>
        </div>
      </div>

      {/* 2. Un solo kit */}
      <div className={styles.section}>
        <div className={`${styles.disp} ${styles.sectionTitle}`}>Tu Kit 200K incluye</div>
        <div className={styles.sectionSubtitle}>Pagas al retirar — esto es tu reserva</div>

        <div className={styles.grid4}>
          <div className={styles.compCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit-200k/maillot.png" alt="Maillot Oficial" className={styles.compImg} />
            <div className={styles.compBody}>
              <div className={styles.compName}>Maillot Oficial</div>
              <div className={styles.compSub}>Tallas XS - 4XL</div>
            </div>
          </div>
          <div className={styles.compCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit-200k/medias.png" alt="Medias Oficiales" className={styles.compImg} />
            <div className={styles.compBody}>
              <div className={styles.compName}>Medias Oficiales</div>
              <div className={styles.compSub}>Talla única</div>
            </div>
          </div>
          <div className={styles.compCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit-200k/medalla.png" alt="Medalla Finalista" className={styles.compImg} />
            <div className={styles.compBody}>
              <div className={styles.compName}>Medalla Finalista</div>
              <div className={styles.compSub}>Incluida en tu kit</div>
            </div>
          </div>
          <div className={styles.compCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit-200k/franela.png" alt="Franela Oficial" className={styles.compImg} />
            <div className={styles.compBody}>
              <div className={styles.compName}>Franela Oficial</div>
              <div className={styles.compSub}>Incluida en tu kit</div>
            </div>
          </div>
        </div>

        <div className={styles.tallaCols}>
          <div className={styles.tallaCol}>
            <div className={styles.tallaLabel}>TALLA MAILLOT</div>
            <TallaChips tallas={TALLAS_ROPA} value={maillotTalla} onChange={setMaillotTalla} />
          </div>
          <div className={styles.tallaCol}>
            <div className={styles.tallaLabel}>TALLA FRANELA (del kit)</div>
            <TallaChips tallas={TALLAS_ROPA} value={franelaTalla} onChange={setFranelaTalla} />
          </div>
        </div>
        <div className={styles.tallaNote}>Cada talla es independiente — puedes combinar Maillot y Franela en tallas distintas</div>
      </div>

      {/* 3. Showroom */}
      <div className={styles.showroom}>
        <div className={styles.showroomBadgeWrap}>
          <span className={styles.showroomBadge}>TIENDA DENTRO DE LA TIENDA</span>
        </div>
        <div className={`${styles.disp} ${styles.sectionTitle}`}>Tu kit ya trae una franela — suma más si necesitas</div>
        <div className={styles.showroomDesc}>
          Para tu equipo, familia o acompañantes que no llevan kit completo —
          elige categoría, talla y cantidad de franelas extra.
        </div>

        <div className={styles.grid3}>
          <div className={styles.shopCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit-200k/franela.png" alt="Franela Damas" className={styles.shopImg} />
            <div className={styles.shopBody}>
              <div className={styles.shopName}>Franela Damas</div>
              <div className={styles.shopPrice}>$5.00 c/u</div>
              <div className={styles.tallaLabelSm}>TALLA</div>
              <TallaChips tallas={TALLAS_ROPA} value={damasTalla} onChange={setDamasTalla} />
              <div className={styles.shopFooter}>
                <Stepper value={damasQty} onChange={setDamasQty} />
                <button type="button" className={styles.btnDark} onClick={() => addExtra('Franela Damas', damasQty, damasTalla)}>Agregar</button>
              </div>
            </div>
          </div>

          <div className={styles.shopCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit-200k/franela.png" alt="Franela Caballeros" className={styles.shopImg} />
            <div className={styles.shopBody}>
              <div className={styles.shopName}>Franela Caballeros</div>
              <div className={styles.shopPrice}>$5.00 c/u</div>
              <div className={styles.tallaLabelSm}>TALLA</div>
              <TallaChips tallas={TALLAS_ROPA} value={caballerosTalla} onChange={setCaballerosTalla} />
              <div className={styles.shopFooter}>
                <Stepper value={caballerosQty} onChange={setCaballerosQty} />
                <button type="button" className={styles.btnDark} onClick={() => addExtra('Franela Caballeros', caballerosQty, caballerosTalla)}>Agregar</button>
              </div>
            </div>
          </div>

          <div className={styles.shopCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit-200k/franela.png" alt="Franela Niños" className={styles.shopImg} />
            <div className={styles.shopBody}>
              <div className={styles.shopName}>Franela Niños</div>
              <div className={styles.shopPrice}>$4.00 c/u</div>
              <div className={styles.tallaLabelSm}>TALLA</div>
              <TallaChips tallas={TALLAS_NINOS} value={ninosTalla} onChange={setNinosTalla} />
              <div className={styles.shopFooter}>
                <Stepper value={ninosQty} onChange={setNinosQty} />
                <button type="button" className={styles.btnDark} onClick={() => addExtra('Franela Niños', ninosQty, ninosTalla)}>Agregar</button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.maillotExtraRow}>
          <div className={styles.maillotExtraLeft}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit-200k/maillot.png" alt="Maillot extra" className={styles.maillotExtraImg} />
            <div>
              <div className={styles.compName}>Maillot extra</div>
              <div className={styles.compSub}>Mismo diseño oficial — pide uno extra si tu kit ya trae uno</div>
            </div>
          </div>
          <div className={styles.maillotExtraRight}>
            <select
              className={styles.tallaSelect}
              value={maillotExtraTalla}
              onChange={e => setMaillotExtraTalla(e.target.value)}
              aria-label="Talla del maillot extra"
            >
              {TALLAS_ROPA.map(t => <option key={t} value={t}>Talla {t}</option>)}
            </select>
            <Stepper value={maillotExtraQty} onChange={setMaillotExtraQty} />
            <button type="button" className={styles.btnPrimarySm} onClick={() => addExtra('Maillot extra', maillotExtraQty, maillotExtraTalla)}>Agregar</button>
          </div>
        </div>
      </div>

      {/* 4. Asistente de reserva — 3 pasos: Contacto / Revisar tu kit / Confirmar */}
      <div className={styles.reservaSection} id="reserva">
        <div className={styles.reservaCard}>
          <div className={styles.checkoutStepper}>
            {([
              { n: 1, label: 'Contacto' },
              { n: 2, label: 'Revisar tu kit' },
              { n: 3, label: 'Confirmar' },
            ] as { n: 1 | 2 | 3; label: string }[]).map(({ n, label }, idx) => (
              <div key={n} className={styles.stepperItem}>
                {idx > 0 && (
                  <div className={`${styles.stepperLine} ${checkoutStep > idx ? styles.stepperLineDone : ''}`} />
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

          {/* Paso 1 — Contacto */}
          {checkoutStep === 1 && (
            <>
              <p className={styles.checkoutStepLabel}>Paso 1</p>
              <h3 className={`${styles.disp} ${styles.reservaTitle}`}>Contacto</h3>
              <div className={styles.reservaFormGrid}>
                <input
                  className={styles.textInput}
                  placeholder="Tu nombre"
                  value={clienteNombre}
                  onChange={e => setClienteNombre(e.target.value)}
                  maxLength={120}
                />
                <input
                  className={styles.textInput}
                  placeholder="WhatsApp"
                  value={clienteTelefono}
                  onChange={e => setClienteTelefono(e.target.value)}
                  maxLength={30}
                />
                <input
                  className={styles.textInput}
                  placeholder="Cédula (V-12345678)"
                  value={clienteCedula}
                  onChange={e => setClienteCedula(e.target.value)}
                  maxLength={15}
                />
                <input
                  className={styles.textInput}
                  type="email"
                  placeholder="Correo electrónico"
                  value={clienteCorreo}
                  onChange={e => setClienteCorreo(e.target.value)}
                  maxLength={160}
                />
              </div>
              <div className={styles.checkoutNavRow}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={!clienteNombre.trim() || !clienteTelefono.trim() || !CEDULA_RE.test(clienteCedula.trim()) || !EMAIL_RE.test(clienteCorreo.trim())}
                  onClick={() => setCheckoutStep(2)}
                >
                  Continuar →
                </button>
              </div>
            </>
          )}

          {/* Paso 2 — Revisar tu kit */}
          {checkoutStep === 2 && (
            <>
              <p className={styles.checkoutStepLabel}>Paso 2</p>
              <h3 className={`${styles.disp} ${styles.reservaTitle}`}>Revisar tu kit</h3>
              <div className={styles.reservaSummary}>
                <div className={styles.summaryRowMain}>
                  <span>Kit 200K (Maillot + Medias)</span>
                  <span className={styles.summaryHighlight}>Talla {maillotTalla}</span>
                </div>
                {visibleExtras.map((e, i) => {
                  const isRemovable = i >= 1
                  return (
                    <div key={`${e.nombre}-${i}`} className={styles.summaryRow}>
                      <span>+ {e.cantidad > 1 ? `${e.cantidad} ` : ''}{e.nombre}</span>
                      <span className={styles.summaryRowRight}>
                        {e.talla ? `Talla ${e.talla}` : 'Incluida'}
                        {isRemovable && (
                          <button
                            type="button"
                            className={styles.summaryRemove}
                            aria-label={`Quitar ${e.nombre}`}
                            onClick={() => removeExtra(i - 1)}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    </div>
                  )
                })}
                <div className={styles.summaryFootnote}>Precio se confirma al retirar — kit sin definir todavía</div>
              </div>
              <div className={styles.checkoutNavRow}>
                <button type="button" className={styles.btnBack} onClick={() => setCheckoutStep(1)}>
                  ← Volver
                </button>
                <button type="button" className={styles.btnPrimary} onClick={() => setCheckoutStep(3)}>
                  Continuar →
                </button>
              </div>
            </>
          )}

          {/* Paso 3 — Confirmar */}
          {checkoutStep === 3 && (
            <>
              <p className={styles.checkoutStepLabel}>Paso 3</p>
              <h3 className={`${styles.disp} ${styles.reservaTitle}`}>Confirmar reserva</h3>
              <div className={styles.reservaSummary}>
                <div className={styles.summaryRow}>
                  <span>Contacto</span>
                  <span className={styles.summaryRowRight}>{clienteNombre} · {clienteTelefono}</span>
                </div>
                <div className={styles.summaryRowMain}>
                  <span>Kit 200K (Maillot + Medias)</span>
                  <span className={styles.summaryHighlight}>Talla {maillotTalla}</span>
                </div>
                {visibleExtras.map((e, i) => (
                  <div key={`${e.nombre}-${i}`} className={styles.summaryRow}>
                    <span>+ {e.cantidad > 1 ? `${e.cantidad} ` : ''}{e.nombre}</span>
                    <span className={styles.summaryRowRight}>{e.talla ? `Talla ${e.talla}` : 'Incluida'}</span>
                  </div>
                ))}
                <div className={styles.summaryFootnote}>Precio se confirma al retirar — kit sin definir todavía</div>
              </div>
              {error && <p className={styles.errorMsg} role="alert">{error}</p>}
              <div className={styles.checkoutNavRow}>
                <button type="button" className={styles.btnBack} onClick={() => setCheckoutStep(2)} disabled={submitting}>
                  ← Volver
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Confirmando…' : 'Confirmar reserva'}
                </button>
              </div>
              <div className={styles.reservaHint}>Recibirás tu número de ticket por WhatsApp</div>
            </>
          )}
        </div>
      </div>

      <CatalogFooter
        slug={slug}
        displayTitle={businessName}
        logoPath={businessLogo}
        catalogDesc={catalogDesc}
        rif={rif}
        address={address}
        location={location}
        waPhone={waPhone}
        phone={phone}
        catalogInstagram={catalogInstagram}
        catalogHours={catalogHours}
      />
    </div>
  )
}
