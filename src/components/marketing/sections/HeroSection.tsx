import Link from 'next/link'
import { MessageCircle, LogIn, CheckCircle, Layers, Globe, Smartphone, RefreshCw } from 'lucide-react'
import styles from './HeroSection.module.css'

interface Props {
  bcvRate: number
}

function fmtRate(rate: number): string {
  if (!rate) return '...'
  return rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AppMockup() {
  return (
    <div className={styles.appFrame} aria-label="Vista del POS de ActivoPOS" role="img">
      {/* Sidebar */}
      <div className={styles.appSidebar}>
        <div className={styles.sbLogo}>
          <span className={styles.sbDot} />
          <span className={styles.sba}>Activo</span>
          <span className={styles.sbp}>POS</span>
        </div>
        <div className={styles.sbSec}>Principal</div>
        <div className={styles.sbItem}><span>Escritorio</span></div>
        <div className={styles.sbSec}>Ventas</div>
        <div className={`${styles.sbItem} ${styles.sbItemOn}`}>
          <span>Punto de Venta</span>
          <span className={styles.sbBadge}>LIVE</span>
        </div>
        <div className={styles.sbItem}><span>Cotizaciones</span></div>
        <div className={styles.sbItem}><span>Pedidos</span></div>
        <div className={styles.sbSec}>Inventario</div>
        <div className={styles.sbItem}><span>Productos</span></div>
        <div className={styles.sbSec}>Finanzas</div>
        <div className={styles.sbItem}><span>Caja</span></div>
        <div className={styles.sbItem}><span>Reportes</span></div>
      </div>

      {/* Content */}
      <div className={styles.appContent}>
        <div className={styles.appTopbar}>
          <span className={styles.topbarTitle}>Punto de Venta</span>
          <div className={styles.topbarBcv}>
            <span className={styles.bcvDot} />
            BCV activo
          </div>
        </div>
        <div className={styles.appMain}>
          {/* Product grid */}
          <div className={styles.posArea}>
            <div className={styles.posTabs}>
              <button className={`${styles.posTab} ${styles.posTabOn}`}>Todos</button>
              <button className={styles.posTab}>Carnes</button>
              <button className={styles.posTab}>Ropa</button>
              <button className={styles.posTab}>Servicios</button>
            </div>
            <div className={styles.posGrid}>
              {[
                { name: 'Pechuga de Res', price: '$4.80/kg', spec: 'Vendido por kg', stock: '12.5 kg', accent: 'success' },
                { name: 'Camisa Polo', price: '$15.00', spec: 'M · Azul', stock: '18 und', accent: 'brand' },
                { name: 'Instalación Eléct.', price: '$25.00', spec: 'Servicio · 2h', stock: 'Disponible', accent: 'warning' },
              ].map((p) => (
                <div key={p.name} className={`${styles.posCard} ${styles[`posCard_${p.accent}`]}`}>
                  <div className={styles.pcAccent} data-accent={p.accent} />
                  <div className={styles.pcName}>{p.name}</div>
                  <div className={styles.pcPrice}>{p.price}</div>
                  <div className={styles.pcSpec}>{p.spec}</div>
                  <div className={styles.pcStock}>{p.stock}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Order panel */}
          <div className={styles.orderPanel}>
            <div className={styles.opTitle}>Ticket · ACT-0047</div>
            <div className={styles.opItems}>
              <div className={styles.opItem}><span>Pechuga 0.8kg</span><span className={styles.opVal}>$3.84</span></div>
              <div className={styles.opItem}><span>Polo M · Azul</span><span className={styles.opVal}>$15.00</span></div>
              <div className={styles.opItem}><span>Instalación 2h</span><span className={styles.opVal}>$50.00</span></div>
            </div>
            <div className={styles.opDiv} />
            <div className={styles.opTotal}><span>Total</span><span className={styles.opTv}>$68.84</span></div>
            <div className={styles.opBs}>Bs. calculando...</div>
            <button className={styles.opBtn}>Cobrar →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HeroSection({ bcvRate }: Props) {
  const rateDisplay = fmtRate(bcvRate)

  return (
    <section className={styles.hero}>
      {/* Gradient mesh */}
      <div className={styles.heroBg} aria-hidden />
      <div className={styles.heroGrid} aria-hidden />

      <div className={styles.heroContent}>
        {/* Eyebrow */}
        <div className={styles.eyebrow} data-reveal>
          <span className={styles.eyeDot} />
          POS · Hecho en Venezuela · Para Venezuela
        </div>

        {/* H1 */}
        <h1 className={styles.h1} data-reveal data-reveal-delay="1">
          El dinero entra.{' '}
          <span className={styles.h1Accent}>Tú lo controlas.</span>
        </h1>

        {/* Subtitle */}
        <p className={styles.subtitle} data-reveal data-reveal-delay="2">
          POS táctil, BCV automático{' '}
          <span className={styles.bcvTag}>
            <RefreshCw size={11} aria-hidden />
            Bs.&nbsp;{rateDisplay}
          </span>
          , catálogo digital con pedidos por WhatsApp, variantes por talla·peso·color y cotización de servicios.
        </p>

        {/* CTAs */}
        <div className={styles.actions} data-reveal data-reveal-delay="3">
          <a
            href="https://wa.me/584222654827?text=Hola%2C+quiero+ver+ActivoPOS+en+acci%C3%B3n"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnPrimary}
          >
            <MessageCircle size={17} aria-hidden />
            Ver demostración
          </a>
          <Link href="/login" className={styles.btnGhost}>
            <LogIn size={16} aria-hidden />
            Entrar al sistema
          </Link>
        </div>

        {/* App mockup — desktop only */}
        <div className={styles.mockupWrap} data-reveal data-reveal-delay="3">
          <AppMockup />
        </div>

        {/* Mobile features */}
        <div className={styles.mobileFeats}>
          {[
            { icon: RefreshCw, text: 'BCV automático en cada cobro', sub: 'Siempre en USD, Bs exacto al cobrar' },
            { icon: Layers, text: 'Especificaciones por producto', sub: 'Tallas, kg, litros, horas de servicio' },
            { icon: Globe, text: 'Catálogo digital con pedidos', sub: 'WhatsApp directo, sin intermediarios' },
            { icon: Smartphone, text: 'Pago Móvil, Zelle, Efectivo, USDT', sub: 'Todos los métodos venezolanos' },
          ].map(({ icon: Icon, text, sub }) => (
            <div key={text} className={styles.mfItem}>
              <div className={styles.mfIcon}><Icon size={18} aria-hidden /></div>
              <div>
                <div className={styles.mfText}>{text}</div>
                <div className={styles.mfSub}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
