'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import styles from './RotatingHeadline.module.css'

const PHRASES = [
  'Vendés en el mostrador.',
  'Tu catálogo vende por WhatsApp.',
  'El BCV se actualiza solo.',
  'La caja cuadra en segundos.',
  'Cobrás en dólares y bolívares.',
]

const ROTATE_MS = 2800

export default function RotatingHeadline() {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % PHRASES.length)
    }, ROTATE_MS)
    return () => clearInterval(timer)
  }, [])

  // Reduced motion: se conserva el cambio de frase (es contenido) pero sin
  // desplazamiento — solo un crossfade suave.
  const variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: '100%', opacity: 0 },
        animate: { y: '0%',   opacity: 1 },
        exit:    { y: '-100%', opacity: 0 },
      }

  return (
    <h1 className={styles.headline}>
      <span className={styles.fixed}>Tu negocio activo.</span>
      <span className={styles.rotatingWrap}>
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            className={styles.rotating}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ duration: reduceMotion ? 0.25 : 0.45, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {PHRASES[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </h1>
  )
}
