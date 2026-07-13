'use client'

import { motion, useReducedMotion } from 'framer-motion'
import styles from './FeatureMarquee.module.css'

const FEATURES = [
  'BCV automático en cada cobro',
  'Escanea con tu celular',
  'Catálogo digital 24/7',
  'Pago Móvil',
  'Zelle',
  'Binance',
  'USDT también',
  'Variantes sin costo extra',
  'Cotizaciones en un clic',
  'Devoluciones sin dolor de cabeza',
  'Venta por kilo o por unidad',
  'PIN de cajero para cada descuento',
  'Cierre de caja en segundos',
  'Reporte del mes directo a tu correo',
  'Pedidos con WhatsApp',
  'Ticket térmico al instante',
  'Tu día, en criollo',
  'Sin contratos',
  'Sin tarjeta de crédito',
  'Soporte en español, de verdad',
]

const MARQUEE_TEXT = FEATURES.join(' ✦ ') + ' ✦ '

// Duración escalada por longitud de texto (~495 chars vs ~151 antes,
// ratio ~3.28x) para mantener la MISMA velocidad px/s -- no medido en
// píxeles reales (sin browser tool en este entorno), estimado por
// conteo de caracteres.
const MARQUEE_DURATION = 92

export default function FeatureMarquee() {
  const reduceMotion = useReducedMotion()

  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.rotated}>
        <motion.div
          className={styles.track}
          animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
          transition={reduceMotion ? undefined : { duration: MARQUEE_DURATION, repeat: Infinity, ease: 'linear' }}
        >
          <span className={styles.item}>{MARQUEE_TEXT}</span>
          <span className={styles.item}>{MARQUEE_TEXT}</span>
        </motion.div>
      </div>
    </div>
  )
}
