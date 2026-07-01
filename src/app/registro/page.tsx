'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { STEP_META, SEEDED_PAYMENT_IDS } from './data'
import { INITIAL_STATE } from './types'
import type { OnboardingState } from './types'
import type { SubmitStatus } from './_steps/Step7Bienvenida'
import Step1Cuenta from './_steps/Step1Cuenta'
import Step2Negocio from './_steps/Step2Negocio'
import Step3Slug from './_steps/Step3Slug'
import Step4Pagos from './_steps/Step4Pagos'
import Step5Horario from './_steps/Step5Horario'
import Step6Categorias from './_steps/Step6Categorias'
import Step7Bienvenida from './_steps/Step7Bienvenida'
import styles from './registro.module.css'

const TOTAL_STEPS = 7

async function submitLogo(file: File | null): Promise<void> {
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', 'logo')

  const res = await fetch('/api/upload/image', { method: 'POST', body: formData })
  if (!res.ok) return
  const json = await res.json() as { url?: string }
  if (!json.url) return

  await fetch('/api/config/business', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logo_path: json.url }),
  })
}

async function submitPaymentExtras(data: OnboardingState): Promise<void> {
  const extras = data.paymentMethods.filter(id => !SEEDED_PAYMENT_IDS.has(id))

  await Promise.allSettled(
    extras.map(id => {
      const name = id === 'binance' ? 'Binance Pay / USDT' : 'Transferencia bancaria'
      const type = id === 'binance' ? 'binance' : 'transfer'
      return fetch('/api/config/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      })
    })
  )

  const d = data.paymentDetails
  const hasDetails = d.pagoMovilBanco || d.pagoMovilTelefono || d.pagoMovilCedula || d.zelleContacto || d.binanceId
  if (!hasDetails) return

  await fetch('/api/config/payment-methods', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pago_movil_banco:    d.pagoMovilBanco,
      pago_movil_telefono: d.pagoMovilTelefono,
      pago_movil_cedula:   d.pagoMovilCedula,
      zelle_contacto:      d.zelleContacto,
      binance_id:          d.binanceId,
    }),
  })
}

async function submitCategories(categories: string[]): Promise<void> {
  await Promise.allSettled(
    categories.map((name, i) => fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sort_order: i }),
    }))
  )
}

interface SetupError {
  error: string
  field?: 'business_slug' | 'email'
}

export default function RegistroPage() {
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData]               = useState<OnboardingState>(INITIAL_STATE)
  const [status, setStatus]           = useState<SubmitStatus>('submitting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorField, setErrorField]     = useState<'business_slug' | 'email' | null>(null)
  const [goingToDashboard, setGoingToDashboard] = useState(false)

  const update = useCallback((patch: Partial<OnboardingState>) => {
    setData(prev => ({ ...prev, ...patch }))
  }, [])

  const goNext = () => setCurrentStep(s => Math.min(s + 1, TOTAL_STEPS))
  const goBack = () => setCurrentStep(s => Math.max(s - 1, 1))

  const runSubmit = useCallback(async () => {
    setStatus('submitting')
    setErrorMessage(null)
    setErrorField(null)

    const sells_products = data.segment === 'productos' || data.segment === 'mixto'
    const sells_services = data.segment === 'servicios' || data.segment === 'mixto'
    const sells_food     = data.segment === 'comida'
    const business_type  = data.subSegment === 'otro' ? data.subSegmentOther : data.subSegment

    try {
      const res = await fetch('/api/onboarding/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name:    data.nombre,
          business_name: data.businessName,
          business_slug: data.slug,
          email:         data.email,
          password:      data.password,
          business_type,
          sells_products,
          sells_services,
          sells_food,
          city: data.city,
        }),
      })

      if (!res.ok) {
        const json = await res.json() as SetupError
        setErrorMessage(json.error ?? 'Error al crear la tienda')
        setErrorField(json.field ?? null)
        setStatus('error')
        return
      }

      // Sesión ya autenticada por /setup — mejores esfuerzos, no bloquean el éxito
      await Promise.allSettled([
        submitLogo(data.logoFile),
        submitPaymentExtras(data),
        submitCategories(data.categories),
      ])

      setStatus('success')
    } catch {
      setErrorMessage('Error de conexión. Intenta de nuevo.')
      setStatus('error')
    }
  }, [data])

  const handleFinish = () => {
    setCurrentStep(TOTAL_STEPS)
    void runSubmit()
  }

  const handleRetry = () => {
    if (errorField === 'email') setCurrentStep(1)
    else if (errorField === 'business_slug') setCurrentStep(3)
    else void runSubmit()
  }

  const handleGoDashboard = async () => {
    setGoingToDashboard(true)
    router.push('/escritorio')
    router.refresh()
  }

  const progressPct = Math.round(((currentStep - 1) / (TOTAL_STEPS - 1)) * 100)

  return (
    <div className={styles.root}>
      <header className={styles.wizardHeader}>
        <div className={styles.headerInner}>
          <div className={styles.wizardBrand}>
            <span className={styles.wizardBrandName}>ActivoPOS</span>
          </div>
          <p className={styles.wizardTitle}>
            Nueva Tienda · Paso {Math.min(currentStep, TOTAL_STEPS)} de {TOTAL_STEPS}
          </p>
          <div className={styles.progressBar}>
            <div className={styles.progressTrack} role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <motion.div
                className={styles.progressFill}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
          <div className={styles.stepDots}>
            {STEP_META.map((meta, i) => {
              const stepNum = i + 1
              const Icon    = meta.icon
              const done    = stepNum < currentStep
              const active  = stepNum === currentStep
              return (
                <span
                  key={meta.key}
                  className={`${styles.stepDot} ${done ? styles.stepDotDone : ''} ${active ? styles.stepDotActive : ''}`}
                  title={meta.label}
                >
                  {done ? <Check size={14} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
                </span>
              )
            })}
          </div>
        </div>
      </header>

      <div className={styles.stepContent}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {currentStep === 1 && <Step1Cuenta data={data} update={update} onNext={goNext} />}
            {currentStep === 2 && <Step2Negocio data={data} update={update} onNext={goNext} />}
            {currentStep === 3 && <Step3Slug data={data} update={update} onNext={goNext} />}
            {currentStep === 4 && <Step4Pagos data={data} update={update} onNext={goNext} />}
            {currentStep === 5 && <Step5Horario data={data} update={update} onNext={goNext} />}
            {currentStep === 6 && <Step6Categorias data={data} update={update} onNext={handleFinish} />}
            {currentStep === 7 && (
              <Step7Bienvenida
                businessName={data.businessName}
                slug={data.slug}
                status={status}
                errorMessage={errorMessage}
                onRetry={handleRetry}
                onGoDashboard={() => void handleGoDashboard()}
                loadingGo={goingToDashboard}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {currentStep > 1 && currentStep < 7 && (
          <button type="button" className={styles.wizardExit} onClick={goBack} style={{ marginTop: 'var(--space-4)' }}>
            ← Atrás
          </button>
        )}
      </div>
    </div>
  )
}
