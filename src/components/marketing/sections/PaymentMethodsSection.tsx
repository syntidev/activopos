'use client'

import { motion } from 'framer-motion'
import { Smartphone, Send, Bitcoin, Coins, CreditCard, Banknote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import styles from './PaymentMethodsSection.module.css'

/* Ícono + color semántico por método, Tipo E de DESIGN_SYSTEM.md
   (.doc/DESIGN_SYSTEM.md:239-247) -- la caja del ícono es siempre
   blanca (ver .pillIcon), el color varía solo en el ícono. Zinli/PayPal
   no están en Tipo E -- gris neutro (#6B7280, mismo tono que "Débito"
   en la tabla), asumido por ausencia de semántica definida.
   Orden: nacional primero (Ajustes-Puntuales-1). */
const METHODS: Array<{ name: string; Icon: LucideIcon; color: string }> = [
  { name: 'Pago Móvil',      Icon: Smartphone, color: '#16A34A' },
  { name: 'Efectivo Bs/USD', Icon: Banknote,   color: '#9333EA' },
  { name: 'Zelle',           Icon: Send,       color: '#2563EB' },
  { name: 'Zinli',           Icon: CreditCard, color: '#6B7280' },
  { name: 'Binance',         Icon: Bitcoin,    color: '#F59E0B' },
  { name: 'USDT',            Icon: Coins,      color: '#F59E0B' },
  { name: 'PayPal',          Icon: CreditCard, color: '#6B7280' },
]

export default function PaymentMethodsSection() {
  return (
    <section className={styles.section}>
      <motion.div
        className={styles.container}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h2 className={styles.title}>Cobra como ya le cobras a tu cliente</h2>
        <p className={styles.subtitle}>
          No somos pasarela de pago. Guardamos el dato, tu cliente lo recibe listo.
        </p>
        <div className={styles.pills}>
          {METHODS.map(({ name, Icon, color }) => (
            <span key={name} className={styles.pill}>
              <span className={styles.pillIcon} style={{ '--pm-icon': color } as CSSProperties}>
                <Icon size={18} aria-hidden="true" />
              </span>
              {name}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
