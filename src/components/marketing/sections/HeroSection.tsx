'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { motion, useInView, animate } from 'framer-motion'
import { Store, UserPlus, TrendingUp } from 'lucide-react'
import styles from './HeroSection.module.css'

interface Props {
  bcvRate: number
}

function fmtRate(rate: number): string {
  if (!rate) return '...'
  return rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const VENTA_HOY_USD = 284.5

export default function HeroSection({ bcvRate }: Props) {
  const rateDisplay = fmtRate(bcvRate)
  const cardRef      = useRef<HTMLDivElement>(null)
  const isInView      = useInView(cardRef, { once: true })
  const [ventaHoyUsd, setVentaHoyUsd] = useState(0)

  useEffect(() => {
    if (!isInView) return
    const controls = animate(0, VENTA_HOY_USD, {
      duration: 1.2,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: v => setVentaHoyUsd(v),
    })
    return () => controls.stop()
  }, [isInView])

  const ventaHoyBs = ventaHoyUsd * bcvRate

  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.copy}>
          <h1 className={styles.headline}>Tu negocio te cuenta cómo le fue hoy.</h1>
          <p className={styles.subhead}>
            Cada venta se guarda sola. Cada bolívar se calcula solo, con la tasa BCV del día.
            Tú solo revisas.
          </p>
          <div className={styles.actions}>
            <Link href="/registro" className={styles.btnPrimary}>
              <UserPlus size={17} aria-hidden="true" />
              Empezar gratis
            </Link>
            <Link href="/catalogo/multi-demo" className={styles.btnGhost}>
              <Store size={16} aria-hidden="true" />
              Ver catálogo en vivo
            </Link>
          </div>
        </div>

        {/* Tarjeta firma "Tu día" — fan de profundidad + único elemento animado al cargar (§7) */}
        <div className={styles.cardWrap} ref={cardRef}>
          <div className={styles.halo} aria-hidden="true" />
          <motion.div
            className={`${styles.dayCard} ${styles.dayCardBack}`}
            style={{ rotate: -4 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05, ease: 'easeOut' }}
            aria-hidden="true"
          />
          <motion.div
            className={`${styles.dayCard} ${styles.dayCardBack}`}
            style={{ rotate: 4 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
            aria-hidden="true"
          />
          <motion.div
            className={styles.dayCard}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className={styles.dayCardHead}>
              <span className={styles.dayCardDot} aria-hidden="true" />
              Tu día · Hoy
            </div>
            <div className={styles.dayCardTotal}>
              <span className={styles.dayCardUsd}>${ventaHoyUsd.toFixed(2)}</span>
              <span className={styles.dayCardBs}>
                Bs.&nbsp;{ventaHoyBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className={styles.dayCardLabel}>Vendido hasta ahora</p>
            <div className={styles.dayCardConfirm}>
              <TrendingUp size={14} aria-hidden="true" />
              Ya cubriste lo que gastaste hoy
            </div>
            <div className={styles.dayCardMeta}>
              <span>BCV Bs. {rateDisplay}</span>
              <span aria-hidden="true">·</span>
              <span>Actualizado ahora</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Curva de transición navy → base — único otro uso, cierra en CTA final (§1, §7) */}
      <svg className={styles.curve} viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,0 C480,110 960,110 1440,0 L1440,110 L0,110 Z" fill="var(--mkt-bg)" />
      </svg>
    </section>
  )
}
