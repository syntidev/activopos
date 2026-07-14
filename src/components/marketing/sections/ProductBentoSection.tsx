'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion, animate } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { DollarSign, Sun, ShoppingCart } from 'lucide-react'
import styles from './ProductBentoSection.module.css'

/* Datos de ejemplo curados a mano -- NUNCA screenshots de la cuenta demo
   (tiene utilidad negativa, fechas inválidas, tablas vacías, inservible
   para mostrar). Mismos tokens/colores/radios que el dashboard real,
   cifras ficticias positivas y coherentes entre sí (misma tasa BCV
   implícita en Cobrado, Ticket y Catálogo) solo para mostrar cómo se ve
   el producto. */
const COBRADO_USD  = 431.40
const BCV_RATE      = 36.735 // Bs.15,847.20 / $431.40 -- misma tasa reusada en Ticket y Catálogo
const MARGEN_PCT   = 42.6
/* Carrito-POS-1: reemplaza el ticket -- mismo patrón de datos, ahora con
   cantidad (paradigma qty × price sellado del proyecto). */
const CART_ITEMS = [
  { name: 'Camisa Polo Azul', qty: 2, usd: 15.00 },
  { name: 'Gorra Negra',      qty: 1, usd: 8.50 },
]
const CART_TOTAL_USD = CART_ITEMS.reduce((sum, i) => sum + i.qty * i.usd, 0)

function fmtUsd(n: number): string {
  return '$' + n.toFixed(2)
}
function fmtBs(n: number): string {
  return 'Bs. ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* Stagger 70ms entre cards -- dentro del rango 60-80ms pedido */
const gridVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const tileVariants: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

/* Count-up 0 -> target, mismo patrón ya usado en FinancialBrainSection.tsx
   (useInView + animate de framer-motion) -- no se reinventa, se reutiliza. */
function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    const controls = animate(0, target, {
      duration: 0.8,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: setValue,
    })
    return () => controls.stop()
  }, [active, target])
  return value
}

/* Línea de tendencia -- se dibuja progresivamente (pathLength) al entrar
   en viewport. pathLength de framer-motion es el equivalente moderno de
   animar stroke-dasharray a mano. */
function TrendLine({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 240 60" className={styles.trendSvg} aria-hidden="true">
      <motion.path
        d="M0,48 L21.8,44.4 L43.6,45.6 L65.5,40.8 L87.3,37.2 L109,39 L130.9,33.6 L152.7,30 L174.5,32.4 L196.4,25.2 L218.2,21.6 L240,18"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: active ? 1 : 0 }}
        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
      />
    </svg>
  )
}

export default function ProductBentoSection() {
  const gridRef      = useRef<HTMLDivElement>(null)
  const isInView      = useInView(gridRef, { once: true, amount: 0.2 })
  const reduceMotion  = useReducedMotion()
  const cobrado       = useCountUp(COBRADO_USD, isInView)
  const margen        = useCountUp(MARGEN_PCT, isInView)

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Así se ve tu negocio, todos los días.</h2>
        <p className={styles.subtitle}>
          Tu Excel, tu libreta y tu calculadora, ahora en un solo lugar.
        </p>

        <motion.div
          ref={gridRef}
          className={styles.grid}
          variants={gridVariants}
          initial={reduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Cobrado + tendencia -- recreación fiel del KPI hero de Escritorio
              (fondo --brand sólido, texto --brand-on, ícono en círculo
              --hero-chip-bg, --card-hero-shadow: los mismos tokens que
              consume escritorio.module.css, no valores inventados) */}
          <motion.div className={`${styles.tile} ${styles.tileCobrado}`} variants={tileVariants}>
            <span className={styles.heroIconCircle}><DollarSign size={18} aria-hidden="true" /></span>
            <span className={styles.kpiLabel}>Cobrado</span>
            <span className={styles.kpiValue}>{fmtUsd(cobrado)}</span>
            <span className={styles.kpiSub}>{fmtBs(cobrado * BCV_RATE)}</span>
            <TrendLine active={isInView && !reduceMotion} />
            <p className={styles.tileCopyOnColor}>Sabes qué vendiste, sin abrir un Excel.</p>
          </motion.div>

          {/* Tu Día anidada -- bloque de color sólido (ámbar) con una card
              blanca flotando encima: un componente real dentro de otro,
              mismo tono narrativo que /tu-dia (ver tu-dia.module.css) */}
          <motion.div className={`${styles.tile} ${styles.tileTudia}`} variants={tileVariants}>
            <motion.div
              className={styles.tudiaCard}
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <span className={styles.tudiaIconCircle}><Sun size={16} aria-hidden="true" /></span>
              <p className={styles.tudiaHeadline}>Hoy vendiste $431.40.</p>
              <p className={styles.tudiaBody}>Ya cubriste lo que gastaste este mes.</p>
            </motion.div>
            <p className={styles.tileCopyOnColor}>Tu negocio te habla en criollo, cada noche.</p>
          </motion.div>

          {/* Margen con barra de progreso -- el fill crece en vivo junto
              con el count-up del número, misma fuente de verdad */}
          <motion.div className={`${styles.tile} ${styles.tileMargen}`} variants={tileVariants}>
            <span className={styles.tileLabel}>Margen bruto</span>
            <span className={styles.tileBigValue}>{margen.toFixed(1)}%</span>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${Math.min(margen, 100)}%` }} />
            </div>
            <p className={styles.tileCopy}>De cada venta, sabes cuánto ganaste de verdad.</p>
          </motion.div>

          {/* Carrito -- regla dual currency sellada: USD y Bs siempre juntos.
              Paradigma qty × price (sellado): cantidad se muestra, nunca
              se ingresa un monto en Bs para calcular la cantidad. */}
          <motion.div className={`${styles.tile} ${styles.tileTicket}`} variants={tileVariants}>
            <span className={styles.tileIconBox}><ShoppingCart size={16} aria-hidden="true" /></span>
            {CART_ITEMS.map(i => (
              <div key={i.name} className={styles.ticketRow}>
                <span>{i.qty} × {i.name}</span>
                <span>{fmtUsd(i.qty * i.usd)}</span>
              </div>
            ))}
            <div className={styles.ticketDivider} />
            <div className={styles.ticketTotalRow}>
              <span>Total</span>
              <span className={styles.ticketTotalPrices}>
                <span>{fmtUsd(CART_TOTAL_USD)}</span>
                <span className={styles.ticketTotalBs}>{fmtBs(CART_TOTAL_USD * BCV_RATE)}</span>
              </span>
            </div>
            <p className={styles.tileCopy}>Tu cliente arma el carrito, tú ves el total al instante.</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
