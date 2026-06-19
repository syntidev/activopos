'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Building2,
  ShoppingBag,
  Utensils,
  Coffee,
  HeartPulse,
  Wheat,
  Wrench,
  BookOpen,
  ShoppingCart,
  Globe,
  Package,
  BarChart2,
  TrendingUp,
  Users,
  PartyPopper,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import styles from './onboarding.module.css'

/* ── Business segments ── */

const SEGMENTS = [
  { value: 'tienda',      label: 'Tienda',      Icon: ShoppingBag },
  { value: 'restaurante', label: 'Restaurante',  Icon: Utensils    },
  { value: 'cafeteria',   label: 'Cafetería',    Icon: Coffee      },
  { value: 'farmacia',    label: 'Farmacia',     Icon: HeartPulse  },
  { value: 'panaderia',   label: 'Panadería',    Icon: Wheat       },
  { value: 'servicios',   label: 'Servicios',    Icon: Wrench      },
  { value: 'libreria',    label: 'Librería',     Icon: BookOpen    },
  { value: 'otro',        label: 'Otro',         Icon: Building2   },
] as const

/* ── Feature chips (informational, step 3) ── */

const FEATURES = [
  { label: 'POS',        Icon: ShoppingCart },
  { label: 'Catálogo',   Icon: Globe        },
  { label: 'Inventario', Icon: Package      },
  { label: 'Reportes',   Icon: BarChart2    },
  { label: 'Finanzas',   Icon: TrendingUp   },
  { label: 'Clientes',   Icon: Users        },
]

const TOTAL = 4

/* ── Confetti ── */

interface ConfettiPiece {
  id:       number
  color:    string
  left:     string
  delay:    string
  duration: string
  size:     string
}

const CONFETTI_COLORS = ['#0D9488', '#1D9E75', '#D97706', '#F0B90B', '#F0F6FC']

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    setPieces(
      Array.from({ length: 60 }, (_, i) => ({
        id:       i,
        color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left:     `${Math.floor(Math.random() * 100)}%`,
        delay:    `${(Math.random() * 1.5).toFixed(2)}s`,
        duration: `${(2 + Math.random() * 2).toFixed(2)}s`,
        size:     `${Math.floor(6 + Math.random() * 9)}px`,
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

/* ── Main component ── */

export default function OnboardingPage() {
  const router        = useRouter()
  const prefersReduced = useReducedMotion()

  const [step,       setStep]       = useState(1)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [loadingBiz, setLoadingBiz] = useState(true)

  // Step 1 — business info
  const [bizName, setBizName] = useState('')
  const [phone,   setPhone]   = useState('')
  const [city,    setCity]    = useState('')

  // Step 2 — segment
  const [segment, setSegment] = useState<string | null>(null)

  const stepVariants = useMemo(() => ({
    enter:  { opacity: 0, x: prefersReduced ? 0 : 48 },
    center: { opacity: 1, x: 0 },
    exit:   { opacity: 0, x: prefersReduced ? 0 : -48 },
  }), [prefersReduced])

  /* ── Pre-fill biz info ── */
  useEffect(() => {
    fetch('/api/config/business')
      .then(r => r.json() as Promise<{
        ok: boolean
        business?: { name?: string; phone?: string; city?: string; segment?: string }
      }>)
      .then(j => {
        if (j.ok && j.business) {
          if (j.business.name)    setBizName(j.business.name)
          if (j.business.phone)   setPhone(j.business.phone)
          if (j.business.city)    setCity(j.business.city)
          if (j.business.segment) setSegment(j.business.segment)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBiz(false))
  }, [])

  /* ── Advance logic ── */

  async function advance() {
    setError('')

    if (step === 1) {
      if (!bizName.trim()) { setError('El nombre del negocio es requerido'); return }
      setSaving(true)
      try {
        const res = await fetch('/api/config/business', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            name:  bizName.trim(),
            phone: phone.trim() || undefined,
            city:  city.trim()  || undefined,
          }),
        })
        if (!res.ok) {
          const j = await res.json() as { error?: string }
          setError(j.error ?? 'Error al guardar')
          return
        }
      } catch {
        setError('Error de conexión')
        return
      } finally {
        setSaving(false)
      }
    }

    if (step === 2) {
      if (!segment) { setError('Selecciona el tipo de negocio'); return }
      // Fire-and-forget — segment is enrichment data, don't gate the user
      void fetch('/api/config/business', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ segment }),
      }).catch(() => {})
    }

    setStep(s => Math.min(s + 1, TOTAL))
  }

  async function handleComplete() {
    setSaving(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'PATCH' })
      router.push('/escritorio')
    } catch {
      setSaving(false)
    }
  }

  async function handleSkip() {
    await fetch('/api/onboarding/complete', { method: 'PATCH' })
    router.push('/escritorio')
  }

  /* ── Dots ── */
  const dots = useMemo(() =>
    Array.from({ length: TOTAL }, (_, i) => ({
      id:     i + 1,
      done:   i + 1 < step,
      active: i + 1 === step,
    })),
    [step]
  )

  const isLast = step === TOTAL

  return (
    <div className={styles.page}>
      {isLast && <Confetti />}

      <div className={styles.card}>
        {/* Progress bar */}
        <div className={styles.progressBar}>
          <span className={styles.progressLabel}>
            {isLast ? '¡Listo!' : `Paso ${step} de ${TOTAL}`}
          </span>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${(step / TOTAL) * 100}%` }}
            />
          </div>
        </div>

        {/* Step dots */}
        <div className={styles.dots} role="tablist" aria-label="Pasos de configuración">
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
            {/* Step 1 — Biz info */}
            {step === 1 && (
              <>
                <div className={styles.iconWrap}>
                  <Building2 size={28} aria-hidden="true" />
                </div>
                <h1 className={styles.stepTitle}>¿Cómo se llama tu negocio?</h1>
                <p className={styles.stepDescription}>
                  Cuéntanos un poco sobre ti para personalizar tu experiencia.
                </p>
                {loadingBiz ? (
                  <p className={styles.stepDescription}>Cargando…</p>
                ) : (
                  <form
                    id="step1-form"
                    className={styles.stepForm}
                    onSubmit={e => { e.preventDefault(); void advance() }}
                  >
                    <Input
                      label="Nombre del negocio"
                      value={bizName}
                      onChange={e => setBizName(e.target.value)}
                      placeholder="ej. Tienda La Esperanza"
                      maxLength={100}
                      required
                      autoFocus
                    />
                    <Input
                      label="Teléfono (opcional)"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="ej. +58 412 0000000"
                      maxLength={30}
                    />
                    <Input
                      label="Ciudad (opcional)"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="ej. Caracas"
                      maxLength={80}
                    />
                    {error && <p className={styles.stepError}>{error}</p>}
                  </form>
                )}
              </>
            )}

            {/* Step 2 — Segment */}
            {step === 2 && (
              <>
                <div className={styles.iconWrap}>
                  <ShoppingBag size={28} aria-hidden="true" />
                </div>
                <h1 className={styles.stepTitle}>¿Qué tipo de negocio tienes?</h1>
                <p className={styles.stepDescription}>
                  Esto nos ayuda a mostrarte lo más relevante para ti.
                </p>
                <div
                  className={styles.segmentGrid}
                  role="radiogroup"
                  aria-label="Tipo de negocio"
                >
                  {SEGMENTS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={segment === value}
                      className={`${styles.segmentOption} ${segment === value ? styles.segmentOptionActive : ''}`}
                      onClick={() => { setSegment(value); setError('') }}
                    >
                      <Icon
                        size={20}
                        className={styles.segmentIcon}
                        aria-hidden="true"
                      />
                      <span className={styles.segmentLabel}>{label}</span>
                    </button>
                  ))}
                </div>
                {error && <p className={styles.stepError}>{error}</p>}
              </>
            )}

            {/* Step 3 — Feature discovery */}
            {step === 3 && (
              <>
                <div className={styles.iconWrap}>
                  <ShoppingCart size={28} aria-hidden="true" />
                </div>
                <h1 className={styles.stepTitle}>Todo lo que necesitas, incluido</h1>
                <p className={styles.stepDescription}>
                  ActivoPOS viene con todas estas herramientas listas para usar desde el primer día.
                </p>
                <div className={styles.featureChips} role="list">
                  {FEATURES.map(({ label, Icon }) => (
                    <span key={label} className={styles.featureChip} role="listitem">
                      <Icon size={12} aria-hidden="true" />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Step 4 — Success */}
            {step === 4 && (
              <>
                <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`}>
                  <PartyPopper size={28} aria-hidden="true" />
                </div>
                <h1 className={styles.stepTitle}>
                  ¡Todo listo{bizName ? `, ${bizName}` : ''}!
                </h1>
                <p className={styles.stepDescription}>
                  Tu negocio está configurado. Haz tu primera venta ahora mismo.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className={styles.actions}>
          {isLast ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleComplete}
              loading={saving}
            >
              ¡Empieza a vender!
            </Button>
          ) : step === 1 ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              type="submit"
              form="step1-form"
              loading={saving}
              disabled={loadingBiz}
              rightIcon={<ArrowRight size={16} aria-hidden="true" />}
            >
              Continuar
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => void advance()}
              loading={saving}
              rightIcon={step < TOTAL - 1 ? <ArrowRight size={16} aria-hidden="true" /> : undefined}
            >
              {step === TOTAL - 1 ? 'Finalizar' : 'Continuar'}
            </Button>
          )}
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            type="button"
            className={styles.skipLink}
            onClick={() => void handleSkip()}
          >
            Configurar después
          </button>
        )}
      </div>
    </div>
  )
}
