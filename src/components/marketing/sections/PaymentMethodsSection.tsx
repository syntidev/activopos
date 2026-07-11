'use client'

import { motion } from 'framer-motion'
import { Wallet } from 'lucide-react'
import styles from './PaymentMethodsSection.module.css'

const METHODS = ['Pago Móvil', 'Zelle', 'Binance', 'USDT', 'Zinli', 'PayPal', 'Efectivo Bs/USD']

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
        <span className={styles.iconWrap}>
          <Wallet size={20} aria-hidden="true" />
        </span>
        <h2 className={styles.title}>Cobra como ya le cobras a tu cliente</h2>
        <p className={styles.subtitle}>
          No somos pasarela de pago. Guardamos el dato, tu cliente lo recibe listo.
        </p>
        <div className={styles.pills}>
          {METHODS.map(m => (
            <span key={m} className={styles.pill}>{m}</span>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
