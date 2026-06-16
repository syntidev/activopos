'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  Settings,
  Package,
  ShoppingCart,
  PartyPopper,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import styles from './onboarding.module.css'

/* ── Constants ── */

const STORAGE_KEY = 'activopos_onboarding_step'

const STEPS = [
  {
    id: 1,
    icon: Target,
    title: 'Bienvenido a ActivoPOS',
    subtitle: 'Tu nuevo punto de venta',
    description:
      'Vamos a configurar tu negocio en 5 minutos. Sigue estos pasos para hacer tu primera venta.',
    action: null,
    pollInterval: null,
  },
  {
    id: 2,
    icon: Settings,
    title: 'Configura la Tasa BCV',
    subtitle: 'Paso 2 de 5',
    description:
      'Primero asegúrate de que la tasa BCV esté activa. Ve a Configuración → General y presiona "Guardar Tasas".',
    action: { label: 'Ir a Configuración', href: '/configuracion?tab=general' },
    pollInterval: 2000,
  },
  {
    id: 3,
    icon: Package,
    title: 'Crea tu Primer Producto',
    subtitle: 'Paso 3 de 5',
    description:
      'Ahora crea tu primer producto. Haz clic en "+ Nuevo" e ingresa nombre, costo y margen de ganancia.',
    action: { label: 'Ir a Productos', href: '/productos' },
    pollInterval: 3000,
  },
  {
    id: 4,
    icon: ShoppingCart,
    title: 'Haz tu Primera Venta',
    subtitle: 'Paso 4 de 5',
    description:
      '¡Producto listo! Búscalo en el POS, agrégalo al ticket y procesa el pago.',
    action: { label: 'Ir al POS', href: '/pos' },
    pollInterval: 3000,
  },
  {
    id: 5,
    icon: PartyPopper,
    title: '¡Tour Completado!',
    subtitle: 'Ya eres un profesional',
    description:
      'Ya dominas ActivoPOS. Si necesitas ayuda usa la sección de Ayuda o contacta soporte por WhatsApp.',
    action: null,
    pollInterval: null,
  },
] as const

/* ── Confetti ── */

interface ConfettiPiece {
  id: number
  color: string
  left: string
  delay: string
  duration: string
  size: string
}

const CONFETTI_COLORS = ['#2563EB', '#1D9E75', '#D97706', '#F0B90B', '#F0F6FC']

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    setPieces(
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: `${Math.floor(Math.random() * 100)}%`,
        delay: `${(Math.random() * 1.5).toFixed(2)}s`,
        duration: `${(2 + Math.random() * 2).toFixed(2)}s`,
        size: `${Math.floor(6 + Math.random() * 9)}px`,
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

/* ── Poll functions ── */

async function checkStep2(): Promise<boolean> {
  try {
    const res = await fetch('/api/dashboard/kpis')
    if (!res.ok) return false
    const data = await res.json()
    return data.ok === true
  } catch { return false }
}

async function checkStep3(): Promise<boolean> {
  try {
    const res = await fetch('/api/products?limit=1')
    if (!res.ok) return false
    const data = await res.json()
    return (data.pagination?.total ?? data.products?.length ?? 0) > 0
  } catch { return false }
}

async function checkStep4(): Promise<boolean> {
  try {
    const res = await fetch('/api/reports/sales?status=paid&limit=1')
    if (!res.ok) return false
    const data = await res.json()
    return (data.pagination?.total ?? data.sales?.length ?? 0) > 0
  } catch { return false }
}

const POLL_FNS: Partial<Record<number, () => Promise<boolean>>> = {
  2: checkStep2,
  3: checkStep3,
  4: checkStep4,
}

/* ── Variants ── */

const stepVariants = {
  enter: { opacity: 0, x: 48 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -48 },
}

/* ── Main component ── */

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    return Number(localStorage.getItem(STORAGE_KEY) ?? '1')
  })

  const [completing, setCompleting] = useState(false)
  const [detected, setDetected] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const current = STEPS[step - 1]
  const isLast = step === 5

  /* ── Persist step ── */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(step))
    setDetected(false)
  }, [step])

  /* ── Polling ── */
  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    stopPoll()
    const pollFn = POLL_FNS[step]
    if (!pollFn) return

    pollRef.current = setInterval(async () => {
      const ok = await pollFn()
      if (ok) {
        stopPoll()
        setDetected(true)
        // Small delay so user sees the success state before advancing
        setTimeout(() => setStep((s) => Math.min(s + 1, 5)), 1200)
      }
    }, STEPS[step - 1].pollInterval ?? 3000)

    return stopPoll
  }, [step, stopPoll])

  /* ── Complete handler ── */
  const handleComplete = async () => {
    setCompleting(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'PATCH' })
      localStorage.removeItem(STORAGE_KEY)
      router.push('/escritorio')
    } catch {
      setCompleting(false)
    }
  }

  /* ── Skip ── */
  const handleSkip = async () => {
    stopPoll()
    await fetch('/api/onboarding/complete', { method: 'PATCH' })
    localStorage.removeItem(STORAGE_KEY)
    router.push('/escritorio')
  }

  /* ── Step dots ── */
  const dots = useMemo(() =>
    STEPS.map((s) => ({
      id: s.id,
      done: s.id < step,
      active: s.id === step,
    })), [step])

  const Icon = current.icon

  return (
    <div className={styles.page}>
      {isLast && <Confetti />}

      <div className={styles.card}>
        {/* Progress header */}
        <div className={styles.progressBar}>
          <span className={styles.progressLabel}>
            {isLast ? '¡Completado!' : `Paso ${step} de 5`}
          </span>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${((step - 1) / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Step dots */}
        <div className={styles.dots} role="tablist" aria-label="Pasos del tour">
          {dots.map((d) => (
            <span
              key={d.id}
              role="tab"
              aria-selected={d.active}
              aria-label={`Paso ${d.id}`}
              className={`${styles.dot} ${d.done ? styles.dotDone : ''} ${d.active ? styles.dotActive : ''}`}
            >
              {d.done && <CheckCircle2 size={10} aria-hidden="true" />}
            </span>
          ))}
        </div>

        {/* Animated step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={styles.stepContent}
          >
            {/* Icon */}
            <div className={`${styles.iconWrap} ${isLast ? styles.iconWrapSuccess : ''}`}>
              <Icon size={28} aria-hidden="true" />
            </div>

            <p className={styles.stepSubtitle}>{current.subtitle}</p>
            <h1 className={styles.stepTitle}>{current.title}</h1>
            <p className={styles.stepDescription}>{current.description}</p>

            {/* Detected badge */}
            {detected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={styles.detectedBadge}
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                ¡Detectado! Avanzando...
              </motion.div>
            )}

            {/* Polling indicator */}
            {!detected && current.pollInterval && (
              <p className={styles.pollingHint}>
                <span className={styles.pollingDot} aria-hidden="true" />
                Esperando detección automática...
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className={styles.actions}>
          {current.action && (
            <a
              href={current.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkBtn}
            >
              {current.action.label}
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}

          {isLast ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleComplete}
              loading={completing}
            >
              ¡Empieza a usar ActivoPOS!
            </Button>
          ) : step === 1 ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              rightIcon={<ArrowRight size={16} aria-hidden="true" />}
              onClick={() => setStep(2)}
            >
              ¡Empezar!
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ArrowRight size={14} aria-hidden="true" />}
              onClick={() => setStep((s) => Math.min(s + 1, 5))}
            >
              Saltar este paso
            </Button>
          )}
        </div>

        {/* Skip tour */}
        {!isLast && (
          <button className={styles.skipLink} onClick={handleSkip}>
            Omitir tour completo
          </button>
        )}
      </div>
    </div>
  )
}
