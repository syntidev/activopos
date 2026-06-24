'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap, Package, Globe, BarChart3, Check, Share2, MessageCircle, Menu, X } from 'lucide-react'
import { Space_Grotesk } from 'next/font/google'
import styles from './landing.module.css'

const sg = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-sg',
})

/* ── SVG: inline POS mockup ── */
function POSMockup() {
  return (
    <svg viewBox="0 0 580 410" fill="none" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="Vista del POS de ActivoPOS con productos y ticket de venta"
      className={styles.mockupWrap}>
      {/* Laptop frame */}
      <rect x="8" y="4" width="564" height="358" rx="12" fill="#162032"/>
      {/* Screen */}
      <rect x="22" y="18" width="536" height="330" rx="4" fill="#0D1B2E"/>
      {/* Header bar */}
      <rect x="22" y="18" width="536" height="44" rx="4" fill="#0EA5A4"/>
      <text x="46" y="47" fill="white" fontSize="14" fontWeight="700" fontFamily="system-ui">ActivoPOS</text>
      {/* Search bar */}
      <rect x="210" y="28" width="188" height="24" rx="12" fill="rgba(0,0,0,0.18)"/>
      <text x="228" y="45" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="system-ui">Buscar producto…</text>
      {/* User avatar */}
      <circle cx="522" cy="40" r="14" fill="rgba(255,255,255,0.18)"/>
      <text x="522" y="45" fill="white" fontSize="9" textAnchor="middle" fontFamily="system-ui">JG</text>

      {/* Category tabs */}
      <rect x="22" y="62" width="372" height="28" fill="#0A1628"/>
      <rect x="30" y="69" width="50" height="14" rx="7" fill="#0EA5A4"/>
      <text x="55" y="80" fill="white" fontSize="8" textAnchor="middle" fontFamily="system-ui">Todos</text>
      <rect x="88" y="69" width="56" height="14" rx="7" fill="rgba(255,255,255,0.07)"/>
      <text x="116" y="80" fill="rgba(255,255,255,0.45)" fontSize="8" textAnchor="middle" fontFamily="system-ui">Bebidas</text>
      <rect x="152" y="69" width="50" height="14" rx="7" fill="rgba(255,255,255,0.07)"/>
      <text x="177" y="80" fill="rgba(255,255,255,0.45)" fontSize="8" textAnchor="middle" fontFamily="system-ui">Comida</text>
      <rect x="210" y="69" width="44" height="14" rx="7" fill="rgba(255,255,255,0.07)"/>
      <text x="232" y="80" fill="rgba(255,255,255,0.45)" fontSize="8" textAnchor="middle" fontFamily="system-ui">Otros</text>

      {/* Product area background */}
      <rect x="22" y="90" width="372" height="258" fill="#091525"/>

      {/* Product cards — 3×2 */}
      {/* Row 1 */}
      {[
        { x: 30, label: 'Refresco', price: '$1.50', c: '#0EA5A4' },
        { x: 148, label: 'Pan de jamón', price: '$3.00', c: '#F97316' },
        { x: 266, label: 'Leche x litro', price: '$1.20', c: '#16A34A' },
      ].map(({ x, label, price, c }) => (
        <g key={x}>
          <rect x={x} y="98" width="110" height="74" rx="6" fill="#132035"/>
          <rect x={x} y="98" width="110" height="3" rx="2" fill={c}/>
          <circle cx={x + 55} cy={122} r="13" fill={`${c}22`}/>
          <circle cx={x + 55} cy={122} r="7" fill={c}/>
          <text x={x + 55} y={152} fill="rgba(255,255,255,0.75)" fontSize="7.5"
            textAnchor="middle" fontFamily="system-ui">{label}</text>
          <text x={x + 55} y={164} fill={c} fontSize="9" fontWeight="700"
            textAnchor="middle" fontFamily="system-ui">{price}</text>
        </g>
      ))}

      {/* Row 2 */}
      {[
        { x: 30, label: 'Chocolate 100g', price: '$2.50', c: '#0EA5A4' },
        { x: 148, label: 'Jugo Natural', price: '$2.00', c: '#F97316' },
        { x: 266, label: 'Galletas 300g', price: '$1.80', c: '#16A34A' },
      ].map(({ x, label, price, c }) => (
        <g key={`r2-${x}`}>
          <rect x={x} y="180" width="110" height="74" rx="6" fill="#132035"/>
          <rect x={x} y="180" width="110" height="3" rx="2" fill={c}/>
          <circle cx={x + 55} cy={204} r="13" fill={`${c}22`}/>
          <circle cx={x + 55} cy={204} r="7" fill={c}/>
          <text x={x + 55} y={234} fill="rgba(255,255,255,0.75)" fontSize="7.5"
            textAnchor="middle" fontFamily="system-ui">{label}</text>
          <text x={x + 55} y={246} fill={c} fontSize="9" fontWeight="700"
            textAnchor="middle" fontFamily="system-ui">{price}</text>
        </g>
      ))}

      {/* Pagination dots */}
      <circle cx="85" cy="358" r="4" fill="#0EA5A4"/>
      <circle cx="97" cy="358" r="3" fill="rgba(255,255,255,0.2)"/>
      <circle cx="109" cy="358" r="3" fill="rgba(255,255,255,0.2)"/>

      {/* Ticket panel */}
      <rect x="394" y="18" width="164" height="330" fill="#060F1C"/>
      <line x1="394" y1="18" x2="394" y2="348" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>

      {/* Ticket header */}
      <rect x="394" y="62" width="164" height="28" fill="#0A1628"/>
      <text x="476" y="80" fill="rgba(255,255,255,0.45)" fontSize="9"
        textAnchor="middle" fontFamily="system-ui">TICKET #0084</text>

      {/* Ticket items */}
      {[
        { y: 104, qty: '1×', name: 'Refresco 500ml', price: '$1.50' },
        { y: 122, qty: '2×', name: 'Pan de jamón', price: '$6.00' },
        { y: 140, qty: '3×', name: 'Leche x litro', price: '$3.60' },
        { y: 158, qty: '1×', name: 'Chocolate 100g', price: '$2.50' },
      ].map(({ y, qty, name, price }) => (
        <g key={y}>
          <text x="402" y={y} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="system-ui">{qty}</text>
          <text x="416" y={y} fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="system-ui">{name}</text>
          <text x="552" y={y} fill="white" fontSize="8" textAnchor="end" fontFamily="system-ui">{price}</text>
        </g>
      ))}

      <line x1="402" y1="170" x2="552" y2="170" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>

      {/* Totals */}
      <text x="402" y="186" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="system-ui">Subtotal</text>
      <text x="552" y="186" fill="rgba(255,255,255,0.55)" fontSize="8" textAnchor="end" fontFamily="system-ui">$13.60</text>
      <text x="402" y="200" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="system-ui">BCV: 97.80 Bs/$</text>

      <line x1="402" y1="210" x2="552" y2="210" stroke="rgba(14,165,164,0.3)" strokeWidth="1"/>

      <text x="402" y="228" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="system-ui">TOTAL</text>
      <text x="552" y="234" fill="white" fontSize="18" fontWeight="700" textAnchor="end" fontFamily="system-ui">$13.60</text>
      <text x="402" y="248" fill="rgba(255,255,255,0.35)" fontSize="7.5" fontFamily="system-ui">Bs. 1,330.08</text>

      {/* Payment chips */}
      <text x="402" y="268" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontFamily="system-ui">MÉTODO DE PAGO</text>
      <rect x="402" y="274" width="60" height="18" rx="4" fill="rgba(249,115,22,0.2)"/>
      <text x="432" y="287" fill="#F97316" fontSize="8" textAnchor="middle" fontFamily="system-ui">Efectivo</text>
      <rect x="470" y="274" width="74" height="18" rx="4" fill="rgba(255,255,255,0.06)"/>
      <text x="507" y="287" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle" fontFamily="system-ui">Transferencia</text>

      {/* Cobrar button */}
      <rect x="402" y="304" width="146" height="34" rx="8" fill="#F97316"/>
      <text x="475" y="326" fill="white" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="system-ui">Cobrar $13.60</text>

      {/* Laptop base */}
      <rect x="0" y="364" width="580" height="22" rx="6" fill="#162032"/>
      <rect x="208" y="362" width="164" height="4" rx="2" fill="#0A1220"/>
    </svg>
  )
}

/* ── SVG avatar with initials ── */
function Avatar({ initials, bg }: { initials: string; bg: string }) {
  return (
    <svg viewBox="0 0 48 48" className={styles.avatar} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill={bg}/>
      <text x="24" y="30" fontSize="14" fontWeight="700" textAnchor="middle" fill="white"
        fontFamily="system-ui">{initials}</text>
    </svg>
  )
}

/* ── Plan feature item ── */
function PlanFeat({ children, featured }: { children: string; featured?: boolean }) {
  return (
    <li className={styles.planFeat}>
      <Check size={14} className={styles.planFeatCheck} aria-hidden="true"/>
      <span>{children}</span>
    </li>
  )
}

/* ── Main landing page ── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 480)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`${styles.landing} ${sg.variable}`}>

      {/* ── NAV ── */}
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}
        aria-label="Navegación principal">
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo} aria-label="ActivoPOS — inicio">
            ActivoPOS
          </Link>
          <div className={styles.navLinks} role="list">
            <Link href="#planes" className={styles.navLink}>Planes</Link>
            <Link href="#testimonios" className={styles.navLink}>Clientes</Link>
            <Link href="mailto:hola@activopos.com" className={styles.navLink}>Contacto</Link>
          </div>
          <Link href="/login" className={styles.navCta}>Empieza gratis</Link>
          <button className={styles.navToggle} onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen} aria-label="Abrir menú">
            {menuOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
        {/* Mobile menu */}
        <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}
          role="navigation" aria-label="Menú móvil">
          <Link href="#planes" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Planes</Link>
          <Link href="#testimonios" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Clientes</Link>
          <Link href="mailto:hola@activopos.com" className={styles.mobileLink}>Contacto</Link>
          <Link href="/login" className={styles.mobileCta} onClick={() => setMenuOpen(false)}>
            Empieza gratis 14 días
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero} id="inicio" aria-labelledby="hero-heading">
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <h1 id="hero-heading" className={styles.heroHeading}>
              Sabe qué vendiste.<br/>Sabe qué te queda.
            </h1>
            <p className={styles.heroSub}>
              El sistema que controla tu mostrador en tiempo real. Ventas en
              dólares y bolívares. BCV integrado. Sin complicaciones.
            </p>
            <div className={styles.heroActions}>
              <Link href="/login" className={styles.btnMain}>
                Empieza gratis 14 días
              </Link>
              <Link href="#planes" className={styles.btnGhost}>
                Ver planes
              </Link>
            </div>
            <div className={styles.heroTrust}>
              <span>Sin tarjeta de crédito</span>
              <span>Cancela cuando quieras</span>
              <span>BCV automático</span>
            </div>
          </div>
          <div className={styles.heroVisual} aria-hidden="true">
            <POSMockup/>
          </div>
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section className={styles.problema} aria-labelledby="problema-heading">
        <div className={styles.wrap}>
          <div className={styles.problemaHead}>
            <h2 id="problema-heading" className={styles.problemaHeading}>
              ¿Cuánto perdiste hoy sin saberlo?
            </h2>
          </div>
          <div className={styles.painRow}>
            <div className={styles.painItem}>
              <span className={styles.painNum}>01</span>
              <h3 className={styles.painHead}>No sabes lo que tienes hasta que se acaba.</h3>
              <p className={styles.painBody}>
                El cliente pide algo, no hay — y la venta se va a la competencia.
                El inventario desordenado te cuesta más plata de lo que crees.
              </p>
            </div>
            <div className={styles.painItem}>
              <span className={styles.painNum}>02</span>
              <h3 className={styles.painHead}>El cierre del día te come dos horas y no cuadra.</h3>
              <p className={styles.painBody}>
                Contando en papel o en Excel, siempre falta o sobra algo.
                Y eso que tienes que hacerlo solo, cansado, al final de la jornada.
              </p>
            </div>
            <div className={styles.painItem}>
              <span className={styles.painNum}>03</span>
              <h3 className={styles.painHead}>No sabes qué producto te está dando plata.</h3>
              <p className={styles.painBody}>
                Vendes mucho pero no sabes de qué. Los productos que no mueven
                siguen en el estante mientras el capital duerme.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOLUCIÓN ── */}
      <section className={styles.solucion} aria-labelledby="solucion-heading">
        <div className={styles.wrap}>
          <div className={styles.solucionHead}>
            <h2 id="solucion-heading" className={`${styles.sectionTitle} ${styles.problemaHeading}`}>
              ActivoPOS lo resuelve mientras tú atiendes
            </h2>
          </div>
          <div className={styles.featGrid}>
            <div className={styles.featItem}>
              <Zap size={28} className={styles.featIcon} aria-hidden="true"/>
              <h3 className={styles.featTitle}>Vende en segundos</h3>
              <p className={styles.featBody}>
                Busca por nombre, barcode o cámara. Cobra en efectivo, transferencia,
                pago móvil o Zelle. En dólares y bolívares, al mismo tiempo.
              </p>
            </div>
            <div className={styles.featItem}>
              <Package size={28} className={styles.featIcon} aria-hidden="true"/>
              <h3 className={styles.featTitle}>Tu inventario, siempre al día</h3>
              <p className={styles.featBody}>
                Cada venta descuenta el stock sola. Sabes lo que tienes
                sin ponerte a contar a mano ni al abrir ni al cerrar.
              </p>
            </div>
            <div className={styles.featItem}>
              <Globe size={28} className={styles.featIcon} aria-hidden="true"/>
              <h3 className={styles.featTitle}>Tu negocio abierto las 24 horas</h3>
              <p className={styles.featBody}>
                Publica tus productos en un catálogo web con código QR.
                Recibe pedidos por WhatsApp mientras duermes.
              </p>
            </div>
            <div className={styles.featItem}>
              <BarChart3 size={28} className={styles.featIcon} aria-hidden="true"/>
              <h3 className={styles.featTitle}>Tus números, claros y en tiempo real</h3>
              <p className={styles.featBody}>
                Cierra el día en minutos. Ve cuánto vendiste, qué te queda
                y qué debes — todo en una pantalla, sin cuadrar a mano.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEGMENTOS ── */}
      <section className={styles.segmentos} aria-labelledby="segmentos-heading">
        <div className={styles.wrap}>
          <div className={styles.segHead}>
            <h2 id="segmentos-heading" className={styles.sectionTitle}>
              ActivoPOS se adapta a tu negocio
            </h2>
          </div>
          <div className={styles.segGrid}>
            {[
              { icon: '🛒', label: 'Bodega' },
              { icon: '🥩', label: 'Carnicería' },
              { icon: '👗', label: 'Boutique' },
              { icon: '☕', label: 'Café' },
              { icon: '💊', label: 'Farmacia' },
              { icon: '🔧', label: 'Ferretería' },
              { icon: '🍽️', label: 'Restaurante' },
              { icon: '🏪', label: 'Minimarket' },
            ].map(({ icon, label }) => (
              <div key={label} className={styles.segChip}>
                <span className={styles.segChipIcon} aria-hidden="true">{icon}</span>
                {label}
              </div>
            ))}
          </div>
          <p className={styles.segFrase}>Si vendes algo, ActivoPOS te funciona.</p>
        </div>
      </section>

      {/* ── DIFERENCIADOR ── */}
      <section className={styles.diferenciador} aria-labelledby="dif-heading">
        <div className={styles.difInner}>
          <p className={styles.difLabel}>Lo que ningún otro sistema tiene</p>
          <h2 id="dif-heading" className={styles.difHeading}>
            Tu catálogo en el celular de tu cliente.
          </h2>
          <p className={styles.difStatement}>
            Tus productos en línea, con precios actualizados en bolívares
            al momento.{' '}
            <span className={styles.difAccent}>Sin apps. Sin técnicos. Sin costos extra.</span>
            {' '}El cliente escanea el QR y ya puede ver, elegir y pedirte por WhatsApp.
          </p>
          <div className={styles.difComps}>
            <span className={styles.difComp}>Fina Partner no lo tiene</span>
            <span className={styles.difComp}>Negotiale no lo tiene</span>
            <span className={styles.difComp}>Excel tampoco</span>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section className={styles.testimonios} id="testimonios" aria-labelledby="testi-heading">
        <div className={styles.wrap}>
          <div className={styles.testiHead}>
            <h2 id="testi-heading" className={styles.sectionTitle}>
              Lo que dicen los negocios activos
            </h2>
          </div>
          <div className={styles.testiGrid}>
            <div className={styles.testiCard}>
              <p className={styles.testiQuote}>
                "Antes terminaba el día sin saber cuánto había vendido. Con ActivoPOS
                el cierre me toma diez minutos. Y sé exactamente cuánto quedó en caja."
              </p>
              <div className={styles.testiFooter}>
                <Avatar initials="RS" bg="#0EA5A4"/>
                <div>
                  <p className={styles.testiName}>Ricardo Sánchez</p>
                  <p className={styles.testiBiz}>Bodega La Victoria · Caracas</p>
                </div>
              </div>
            </div>
            <div className={`${styles.testiCard} ${styles.testiCardFeatured}`}>
              <p className={styles.testiQuote}>
                "Mis clientas me pedían productos por WhatsApp. Ahora les mando el link
                del catálogo y ellas solas hacen el pedido. No tengo que estar pendiente."
              </p>
              <div className={styles.testiFooter}>
                <Avatar initials="MG" bg="rgba(255,255,255,0.25)"/>
                <div>
                  <p className={styles.testiName}>María González</p>
                  <p className={styles.testiBiz}>Boutique Azul · Valencia</p>
                </div>
              </div>
            </div>
            <div className={styles.testiCard}>
              <p className={styles.testiQuote}>
                "El inventario me mataba. Ahora cada vez que vendo un kilo, el sistema
                lo descuenta solo. Sin contar. Menos errores y más tiempo pa' atender."
              </p>
              <div className={styles.testiFooter}>
                <Avatar initials="JB" bg="#1E3A5F"/>
                <div>
                  <p className={styles.testiName}>José Barrios</p>
                  <p className={styles.testiBiz}>Carnicería El Corral · Maracaibo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section className={styles.precios} id="planes" aria-labelledby="precios-heading">
        <div className={styles.wrap}>
          <div className={styles.preciosHead}>
            <h2 id="precios-heading" className={styles.sectionTitle}>
              Elige cómo quieres estar activo
            </h2>
          </div>
          <div className={styles.planRow}>

            {/* Plan Mostrador */}
            <div className={styles.planCard}>
              <div>
                <p className={styles.planName}>Mostrador</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>$15</span>
                  <span className={styles.planPeriod}>/mes</span>
                </div>
              </div>
              <p className={styles.planDesc}>Para el negocio que quiere dominar su mostrador.</p>
              <ul className={styles.planFeatures} aria-label="Incluye">
                <PlanFeat>POS completo</PlanFeat>
                <PlanFeat>Inventario automático</PlanFeat>
                <PlanFeat>Cierre de caja</PlanFeat>
                <PlanFeat>Gestión de clientes</PlanFeat>
                <PlanFeat>Reportes diarios</PlanFeat>
                <PlanFeat>2 usuarios</PlanFeat>
              </ul>
              <Link href="/login" className={styles.planBtn}>
                Empezar con Mostrador
              </Link>
            </div>

            {/* Plan Catálogo Activo — highlighted */}
            <div className={`${styles.planCard} ${styles.planFeatured}`}>
              <span className={styles.planBadge}>El más elegido</span>
              <div>
                <p className={styles.planName}>Catálogo Activo</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>$25</span>
                  <span className={styles.planPeriod}>/mes</span>
                </div>
              </div>
              <p className={styles.planDesc}>Para el negocio que quiere vender online sin esfuerzo.</p>
              <ul className={styles.planFeatures} aria-label="Incluye">
                <PlanFeat featured>Todo el Plan Mostrador</PlanFeat>
                <PlanFeat featured>Vitrina web sincronizada</PlanFeat>
                <PlanFeat featured>Pedidos por WhatsApp</PlanFeat>
                <PlanFeat featured>Código QR para tu negocio</PlanFeat>
                <PlanFeat featured>5 usuarios</PlanFeat>
              </ul>
              <Link href="/login" className={styles.planBtn}>
                Empezar con Catálogo
              </Link>
            </div>

            {/* Plan Pulso */}
            <div className={styles.planCard}>
              <div>
                <p className={styles.planName}>Pulso</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>$35</span>
                  <span className={styles.planPeriod}>/mes</span>
                </div>
              </div>
              <p className={styles.planDesc}>Para el negocio que quiere saber qué vender mañana.</p>
              <ul className={styles.planFeatures} aria-label="Incluye">
                <PlanFeat>Todo el Plan Catálogo</PlanFeat>
                <PlanFeat>Analytics de productos</PlanFeat>
                <PlanFeat>Señales frío/caliente</PlanFeat>
                <PlanFeat>Usuarios ilimitados</PlanFeat>
                <PlanFeat>Soporte prioritario</PlanFeat>
              </ul>
              <Link href="/login" className={styles.planBtn}>
                Empezar con Pulso
              </Link>
            </div>
          </div>
          <p className={styles.preciosFootnote}>
            Sin contratos. Sin costos ocultos. Cancela cuando quieras.
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className={styles.ctaFinal} aria-labelledby="cta-heading">
        <div className={styles.ctaFinalInner}>
          <h2 id="cta-heading" className={styles.ctaFinalTitle}>
            Tu negocio merece estar activo.
          </h2>
          <p className={styles.ctaFinalSub}>14 días gratis. Sin tarjeta de crédito.</p>
          <Link href="/login" className={styles.ctaFinalBtn}>
            Activa tu negocio ahora
          </Link>
          <p className={styles.ctaFinalTrust}>
            Únete a los negocios venezolanos que ya controlan su mostrador
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div>
              <Link href="/" className={styles.footerLogo}>ActivoPOS</Link>
              <p className={styles.footerSlogan}>El POS para negocios que andan activos.</p>
            </div>
            <nav aria-label="Links del footer">
              <p className={styles.footerNavTitle}>Navegación</p>
              <ul className={styles.footerNavList}>
                <li><Link href="#inicio" className={styles.footerNavLink}>Inicio</Link></li>
                <li><Link href="#planes" className={styles.footerNavLink}>Planes</Link></li>
                <li><Link href="#testimonios" className={styles.footerNavLink}>Clientes</Link></li>
                <li><Link href="mailto:hola@activopos.com" className={styles.footerNavLink}>Contacto</Link></li>
              </ul>
            </nav>
            <div>
              <p className={styles.footerNavTitle}>Síguenos</p>
              <div className={styles.footerSocial}>
                <a href="https://instagram.com/activopos" className={styles.footerSocialLink}
                  target="_blank" rel="noopener noreferrer" aria-label="Instagram de ActivoPOS">
                  <Share2 size={14} aria-hidden="true"/>
                  Instagram
                </a>
                <a href="https://wa.me/584121234567" className={styles.footerSocialLink}
                  target="_blank" rel="noopener noreferrer" aria-label="WhatsApp de ActivoPOS">
                  <MessageCircle size={14} aria-hidden="true"/>
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p className={styles.footerLegal}>
              ActivoPOS es tu sistema de control de ventas e inventario.
              No reemplaza tu facturación SENIAT — la complementa.
            </p>
            <p className={styles.footerCopy}>© 2026 ActivoPOS · SYNTIdev</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
