'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Building2, Package, CreditCard, ShoppingCart, Globe,
  Check, CheckCircle2, ArrowRight, PartyPopper,
} from 'lucide-react'
import styles from './onboarding.module.css'

/* ── Types ── */

interface StepState {
  key:  string
  done: boolean
}

interface OnboardingData {
  steps:        StepState[]
  all_complete: boolean
  progress_pct: number
}

/* ── Step config ── */

const STEP_CONFIG = [
  {
    key:  'business',
    label: 'Configura tu negocio',
    desc:  'Agrega nombre, teléfono, logo y ciudad de tu negocio.',
    cta:   'Configurar mi negocio',
    href:  '/configuracion',
    icon:  Building2,
  },
  {
    key:  'product',
    label: 'Crea tu primer producto',
    desc:  'Registra al menos un producto o servicio en tu catálogo.',
    cta:   'Crear primer producto',
    href:  '/productos',
    icon:  Package,
  },
  {
    key:  'payment',
    label: 'Configura métodos de pago',
    desc:  'Activa efectivo, transferencia, Zelle u otros métodos.',
    cta:   'Configurar pagos',
    href:  '/configuracion#pagos',
    icon:  CreditCard,
  },
  {
    key:  'sale',
    label: 'Realiza tu primera venta',
    desc:  'Abre el punto de venta y procesa tu primera transacción.',
    cta:   'Ir al POS',
    href:  '/pos',
    icon:  ShoppingCart,
  },
  {
    key:  'catalog',
    label: 'Activa tu catálogo digital',
    desc:  'Comparte tu catálogo en línea con tus clientes.',
    cta:   'Activar catálogo',
    href:  '/catalogo-digital',
    icon:  Globe,
  },
] as const

/* ── Confetti ── */

interface ConfettiPiece {
  id:       number
  color:    string
  left:     string
  delay:    string
  duration: string
  size:     string
}

const CONFETTI_COLORS = ['#0038BD', '#EF8E01', '#16A34A', '#F0B90B', '#7C3AED']

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    setPieces(
      Array.from({ length: 60 }, (_, i) => ({
        id:       i,
        color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left:     `${(i * 1.7 + 3) % 100}%`,
        delay:    `${((i * 0.07) % 1.5).toFixed(2)}s`,
        duration: `${(2.4 + (i % 5) * 0.4).toFixed(2)}s`,
        size:     `${6 + (i % 4) * 2}px`,
      }))
    )
  }, [])

  return (
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={styles.confettiPiece}
          style={{
            left:              p.left,
            backgroundColor:   p.color,
            width:             p.size,
            height:            p.size,
            animationDelay:    p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  )
}

/* ── Celebration screen ── */

function CelebrationScreen({ onGo, loading }: { onGo: () => void; loading: boolean }) {
  return (
    <>
      <Confetti />
      <motion.div
        className={`${styles.trackerCard} ${styles.celebrateCard}`}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        role="main"
        aria-live="polite"
      >
        <motion.div
          className={`${styles.iconWrap} ${styles.iconWrapSuccess}`}
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <PartyPopper size={32} aria-hidden="true" />
        </motion.div>

        <motion.h1
          className={styles.celebrateTitle}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          ¡Tu negocio está activo!
        </motion.h1>

        <motion.p
          className={styles.celebrateDesc}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          Completaste todos los pasos de configuración. Ahora tienes todo lo que necesitas para vender.
        </motion.p>

        <motion.button
          className={styles.celebrateBtn}
          onClick={onGo}
          disabled={loading}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {loading ? 'Redirigiendo…' : 'Ir al escritorio'}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </motion.button>
      </motion.div>
    </>
  )
}

/* ── Main page ── */

export default function OnboardingPage() {
  const router = useRouter()

  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null)
  const [loading,        setLoading]         = useState(true)
  const [completing,     setCompleting]      = useState(false)

  const fetchSteps = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/steps')
      if (res.ok) {
        const data = await res.json() as OnboardingData
        setOnboardingData(data)
      }
    } catch {
      /* non-critical — keep previous state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSteps()
    const interval = setInterval(() => { void fetchSteps() }, 30_000)
    return () => clearInterval(interval)
  }, [fetchSteps])

  const handleGoToDashboard = async () => {
    setCompleting(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'PATCH' })
    } finally {
      router.push('/escritorio')
    }
  }

  const handleSkip = async () => {
    await fetch('/api/onboarding/complete', { method: 'PATCH' }).catch(() => {})
    router.push('/escritorio')
  }

  /* ── Derived state ── */

  const stepMap    = new Map(onboardingData?.steps.map(s => [s.key, s.done]) ?? [])
  const activeIndex = STEP_CONFIG.findIndex(s => !stepMap.get(s.key))
  const progressPct = Math.round(onboardingData?.progress_pct ?? 0)
  const allComplete = onboardingData?.all_complete ?? false

  /* ── Loading skeleton ── */

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.trackerCard}>
          <div className={styles.trackerSkeleton}>
            {[0, 1, 2].map(i => <div key={i} className={styles.skeletonStep} />)}
          </div>
        </div>
      </div>
    )
  }

  /* ── All done → celebration ── */

  if (allComplete) {
    return (
      <div className={styles.page}>
        <CelebrationScreen onGo={() => void handleGoToDashboard()} loading={completing} />
      </div>
    )
  }

  /* ── Progress tracker ── */

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.trackerCard}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className={styles.trackerHeader}>
          <h1 className={styles.trackerTitle}>Configura tu negocio</h1>
          <p className={styles.trackerSubtitle}>
            Completa estos pasos para empezar a vender con ActivoPOS.
          </p>

          {/* Progress bar */}
          <div className={styles.progressBar}>
            <div className={styles.progressMeta}>
              <span className={styles.progressLabel}>Progreso</span>
              <span className={styles.progressPct}>{progressPct}% completado</span>
            </div>
            <div className={styles.progressTrack} role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <motion.div
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Step cards */}
        <ol className={styles.stepsList} aria-label="Pasos de configuración">
          <AnimatePresence initial={false}>
            {STEP_CONFIG.map((config, i) => {
              const isDone   = stepMap.get(config.key) ?? false
              const isActive = i === activeIndex
              const isFuture = !isDone && !isActive
              const Icon = config.icon

              return (
                <motion.li
                  key={config.key}
                  className={`${styles.stepCard} ${isDone ? styles.stepCardDone : ''} ${isActive ? styles.stepCardActive : ''} ${isFuture ? styles.stepCardFuture : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.05, ease: 'easeOut' }}
                >
                  {/* Icon circle */}
                  <div
                    className={`${styles.stepIconCircle} ${isDone ? styles.stepIconDone : isActive ? styles.stepIconActive : styles.stepIconFuture}`}
                    aria-hidden="true"
                  >
                    {isDone ? <Check size={15} strokeWidth={2.5} /> : <Icon size={17} strokeWidth={1.75} />}
                  </div>

                  {/* Text */}
                  <div className={styles.stepInfo}>
                    <span className={styles.stepLabel}>{config.label}</span>
                    {(isActive || isDone) && (
                      <span className={styles.stepDesc}>{config.desc}</span>
                    )}
                    {/* CTA on active card */}
                    {isActive && (
                      <Link href={config.href} className={styles.stepCtaBtn}>
                        {config.cta}
                        <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    )}
                  </div>

                  {/* Done badge */}
                  {isDone && (
                    <CheckCircle2
                      size={20}
                      className={styles.stepDoneIcon}
                      aria-label="Completado"
                    />
                  )}
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>

        {/* Skip */}
        <button
          type="button"
          className={styles.skipLink}
          onClick={() => void handleSkip()}
        >
          Configurar después
        </button>
      </motion.div>
    </div>
  )
}
