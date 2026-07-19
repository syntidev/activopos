'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PartyPopper, Loader2, AlertTriangle, ArrowRight, Package, Share2, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import styles from '../registro.module.css'

// Mismos 3 próximos pasos que ofrece el checklist de bienvenida del dashboard
// (escritorio/page.tsx) — íconos ya usados en el proyecto para el mismo concepto:
// Package = producto (TabModulos 'inventory'), Calculator = caja (TabModulos 'caja').
// Share2 no tiene precedente exacto para "compartir catálogo" — Globe ya identifica
// el paso "URL" del wizard (STEP_META), así que Share2 evita ambigüedad visual.
const NEXT_STEPS = [
  { icon: Package,    label: 'Sube tu primer producto', tone: styles.checklistIconBrand },
  { icon: Share2,     label: 'Comparte tu catálogo',    tone: styles.checklistIconSuccess },
  { icon: Calculator, label: 'Configura tu caja',       tone: styles.checklistIconViolet },
]

export type SubmitStatus = 'submitting' | 'success' | 'error'

interface StepProps {
  businessName: string
  slug:         string
  status:       SubmitStatus
  errorMessage: string | null
  warnings:     string[]
  onRetry:      () => void
  onGoDashboard: () => void
  loadingGo:    boolean
}

const CONFETTI_COLORS = ['#0038BD', '#EF8E01', '#16A34A', '#F0B90B', '#7C3AED']

interface ConfettiPiece {
  id: number
  color: string
  left: string
  delay: string
  duration: string
  size: string
}

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    setPieces(
      Array.from({ length: 50 }, (_, i) => ({
        id:       i,
        color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left:     `${(i * 1.9 + 3) % 100}%`,
        delay:    `${((i * 0.07) % 1.5).toFixed(2)}s`,
        duration: `${(2.4 + (i % 5) * 0.4).toFixed(2)}s`,
        size:     `${6 + (i % 4) * 2}px`,
      }))
    )
  }, [])

  return (
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className={styles.confettiPiece}
          style={{
            left: p.left,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  )
}

export default function Step7Bienvenida({
  businessName, slug, status, errorMessage, warnings, onRetry, onGoDashboard, loadingGo,
}: StepProps) {
  if (status === 'submitting') {
    return (
      <div className={styles.celebrateWrap}>
        <Loader2 size={32} className="spin" aria-hidden="true" />
        <p className={styles.stepSubtitle} style={{ marginTop: 'var(--space-4)' }}>
          Creando tu tienda…
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.celebrateWrap}>
        <div className={styles.celebrateIcon} style={{ background: 'var(--color-danger-subtle)', color: 'var(--color-danger-text)' }}>
          <AlertTriangle size={28} aria-hidden="true" />
        </div>
        <h1 className={styles.celebrateTitle}>No pudimos crear tu tienda</h1>
        <p className={styles.stepSubtitle}>{errorMessage ?? 'Ocurrió un error inesperado.'}</p>
        <Button fullWidth size="lg" onClick={onRetry}>Reintentar</Button>
      </div>
    )
  }

  return (
    <>
      <Confetti />
      <motion.div
        className={styles.celebrateWrap}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className={styles.celebrateIcon}
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <PartyPopper size={32} aria-hidden="true" />
        </motion.div>

        <h1 className={styles.celebrateTitle}>¡Todo listo!</h1>
        <p className={styles.celebrateBiz}>{businessName}</p>
        <p className={styles.celebrateUrl}>activopos.com/catalogo/{slug}</p>

        {warnings.length > 0 && (
          <div className={styles.setupWarning}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              Algunos datos no se guardaron ({warnings.join(', ')}).
              Puedes completarlos en Configuración.
            </span>
          </div>
        )}

        <div className={styles.checklist}>
          {NEXT_STEPS.map((step, i) => (
            <motion.div
              key={step.label}
              className={styles.checklistItem}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.06, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className={`${styles.checklistIcon} ${step.tone}`}>
                <step.icon size={15} aria-hidden="true" />
              </span>
              {step.label}
            </motion.div>
          ))}
        </div>

        <div className={styles.celebrateActions}>
          <Button
            variant="cta"
            fullWidth
            size="lg"
            rightIcon={<ArrowRight size={16} />}
            loading={loadingGo}
            onClick={onGoDashboard}
          >
            Ir a mi dashboard
          </Button>
        </div>
      </motion.div>
    </>
  )
}
