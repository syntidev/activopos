'use client'

import React, { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useInView, animate } from 'framer-motion'
import { MessageCircle, LogIn, UserPlus, RefreshCw, Layers, Globe, Smartphone } from 'lucide-react'
import RotatingHeadline from '@/components/marketing/shared/RotatingHeadline'
import styles from './HeroSection.module.css'

interface Props {
  bcvRate: number
}

function fmtRate(rate: number): string {
  if (!rate) return '...'
  return rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface FloatingShapeProps {
  delay: number
  width: number
  height: number
  rotate: number
  color: string
  style: React.CSSProperties
}

function FloatingShape({ delay, width, height, rotate, color, style }: FloatingShapeProps) {
  return (
    <motion.div
      className={styles.floatingShape}
      style={style}
      initial={{ opacity: 0, y: -60, rotate: rotate - 10 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 2.2, delay, ease: [0.23, 0.86, 0.39, 0.96] }}
    >
      <motion.div
        animate={{ y: [0, 14, 0] }}
        transition={{ duration: 9 + delay * 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width, height }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${color}22 0%, transparent 70%)`,
            border: `1px solid ${color}16`,
            backdropFilter: 'blur(2px)',
          }}
        />
      </motion.div>
    </motion.div>
  )
}

const ACCENT_STYLES: Record<string, string> = {
  success: styles.posCard_success ?? '',
  brand:   styles.posCard_brand   ?? '',
  warning: styles.posCard_warning ?? '',
}

function AppMockup() {
  const products: Array<{ name: string; price: string; spec: string; stock: string; accent: string }> = [
    { name: 'Pechuga de Res',  price: '$4.80/kg', spec: 'Vendido por kg', stock: '12.5 kg',     accent: 'success' },
    { name: 'Camisa Polo',     price: '$15.00',   spec: 'M · Azul',       stock: '18 und',      accent: 'brand'   },
    { name: 'Instalación El.', price: '$25.00',   spec: 'Servicio · 2h',  stock: 'Disponible',  accent: 'warning' },
  ]

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
              {products.map((p) => (
                <div key={p.name} className={`${styles.posCard} ${ACCENT_STYLES[p.accent] ?? ''}`}>
                  <div className={styles.pcAccent} />
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

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
})

interface StatDef {
  target: number | null
  display: string
  suffix: string
  label: string
  cta: boolean
}

const STATS: StatDef[] = [
  { target: 50,   display: '50+', suffix: '+', label: 'Negocios activos',         cta: false },
  { target: null, display: 'BCV', suffix: '',  label: 'Automático en cada cobro', cta: true  },
  { target: 2,    display: '2',   suffix: '',  label: 'Planes disponibles',        cta: false },
  { target: null, display: '24h', suffix: '',  label: 'Demo garantizada',          cta: true  },
]

function CounterStat({ target, display, suffix, label, cta }: StatDef) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isInView || target === null) return
    const controls = animate(0, target, {
      duration: 1.4,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
      onUpdate: (v) => setCount(Math.round(v)),
    })
    return () => controls.stop()
  }, [isInView, target])

  const shown = target !== null ? `${count}${suffix}` : display

  return (
    <div ref={ref} className={styles.statItem}>
      <span className={`${styles.statNum}${cta ? ' ' + styles.statNumCta : ''}`}>
        {shown}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

interface MobileFeat {
  icon: React.ElementType
  text: string
  sub: string
}

const MOBILE_FEATS: MobileFeat[] = [
  { icon: RefreshCw,  text: 'BCV automático en cada cobro',  sub: 'Siempre en USD, Bs exacto al cobrar'   },
  { icon: Layers,     text: 'Especificaciones por producto',  sub: 'Tallas, kg, litros, horas de servicio' },
  { icon: Globe,      text: 'Catálogo digital con pedidos',   sub: 'WhatsApp directo, sin intermediarios'  },
  { icon: Smartphone, text: 'Pago Móvil, Zelle, Efectivo',   sub: 'Todos los métodos venezolanos'         },
]

export default function HeroSection({ bcvRate }: Props) {
  const rateDisplay = fmtRate(bcvRate)

  // Pre-computed outside JSX to avoid block-body arrow function ambiguity in JSX parser
  const mfItems = MOBILE_FEATS.map((feat) => {
    const MFIcon = feat.icon
    return (
      <div key={feat.text} className={styles.mfItem}>
        <div className={styles.mfIcon}><MFIcon size={18} /></div>
        <div>
          <div className={styles.mfText}>{feat.text}</div>
          <div className={styles.mfSub}>{feat.sub}</div>
        </div>
      </div>
    )
  })

  return (
    <section className={styles.hero}>
      {/* Gradient mesh */}
      <div className={styles.heroBg} aria-hidden />
      <div className={styles.heroDots} aria-hidden />

      {/* Color blobs */}
      <div className={`${styles.blob} ${styles.blobBrand}`} aria-hidden />
      <div className={`${styles.blob} ${styles.blobCta}`}   aria-hidden />
      <div className={`${styles.blob} ${styles.blobAccent}`} aria-hidden />

      {/* Floating geometric shapes */}
      <div className={styles.shapes} aria-hidden>
        <FloatingShape delay={0.3} width={540} height={130} rotate={12}  color="#4D7AFF"
          style={{ left: '-6%', top: '16%' }} />
        <FloatingShape delay={0.5} width={400} height={100} rotate={-14} color="#EF8E01"
          style={{ right: '-3%', bottom: '18%' }} />
        <FloatingShape delay={0.45} width={240} height={65} rotate={-8}  color="#4D7AFF"
          style={{ left: '7%', bottom: '10%' }} />
        <FloatingShape delay={0.65} width={170} height={50} rotate={22}  color="#EF8E01"
          style={{ right: '17%', top: '10%' }} />
      </div>

      <div className={styles.heroContent}>
        {/* Eyebrow */}
        <motion.div className={styles.eyebrow} {...fadeUp(0.1)}>
          <span className={styles.eyeDot} />
          POS · Hecho en Venezuela · Para Venezuela
        </motion.div>

        {/* H1 — headline rotativo (parte fija + frases en CTA) */}
        <motion.div {...fadeUp(0.2)}>
          <RotatingHeadline />
        </motion.div>

        {/* Subtitle */}
        <motion.p className={styles.subtitle} {...fadeUp(0.3)}>
          El POS venezolano con BCV automático{' '}
          <span className={styles.bcvTag}>
            <RefreshCw size={11} aria-hidden />
            Bs.&nbsp;{rateDisplay}
          </span>
          , catálogo digital y escáner de código de barras desde tu celular.
        </motion.p>

        {/* CTAs */}
        <motion.div className={styles.actions} {...fadeUp(0.4)}>
          <Link href="/registro" className={styles.btnPrimary}>
            <UserPlus size={17} aria-hidden />
            Empezar gratis
          </Link>
          <a
            href="https://wa.me/584222654827?text=Hola%2C+quiero+ver+ActivoPOS+en+acci%C3%B3n"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnGhost}
          >
            <MessageCircle size={16} aria-hidden />
            Ver demostración
          </a>
          <Link href="/login" className={styles.btnGhost}>
            <LogIn size={16} aria-hidden />
            Entrar al sistema
          </Link>
        </motion.div>

        {/* Stats — counter animado al entrar en viewport */}
        <motion.div className={styles.statsRow} {...fadeUp(0.5)}>
          {STATS.map((s, i) => (
            <React.Fragment key={s.display}>
              {i > 0 && <div className={styles.statDiv} />}
              <CounterStat {...s} />
            </React.Fragment>
          ))}
        </motion.div>

        {/* App mockup — desktop only */}
        <motion.div className={styles.mockupWrap} {...fadeUp(0.55)}>
          <div className={styles.mockupGlow} aria-hidden />
          <AppMockup />
        </motion.div>

        {/* Mobile features */}
        <div className={styles.mobileFeats}>{mfItems}</div>
      </div>
    </section>
  )
}
