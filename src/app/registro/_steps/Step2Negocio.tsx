'use client'

import { useRef, useState } from 'react'
import { ArrowRight, Upload } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { BUSINESS_TYPES, SUB_SEGMENTS } from '../data'
import type { OnboardingState } from '../types'
import styles from '../registro.module.css'

interface StepProps {
  data:   OnboardingState
  update: (patch: Partial<OnboardingState>) => void
  onNext: () => void
}

export default function Step2Negocio({ data, update, onNext }: StepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showValidationHint, setShowValidationHint] = useState(false)

  const subSegments = data.segment ? SUB_SEGMENTS[data.segment] ?? [] : []
  const needsOther   = data.subSegment === 'otro'

  function handleLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    update({ logoFile: file, logoPreviewUrl: URL.createObjectURL(file) })
  }

  const isValid =
    data.businessName.trim().length >= 2 &&
    data.city.trim().length > 0 &&
    data.segment !== '' &&
    data.subSegment !== '' &&
    (!needsOther || data.subSegmentOther.trim().length > 0)

  // Solo para el mensaje de feedback — no participa en isValid
  const missingLabels: string[] = []
  if (data.businessName.trim().length < 2) missingLabels.push('Nombre del negocio')
  if (data.city.trim().length === 0) missingLabels.push('Ciudad')
  if (data.segment === '') missingLabels.push('Tipo de negocio')
  if (data.segment !== '' && data.subSegment === '') missingLabels.push('Sub-segmento')
  if (needsOther && data.subSegmentOther.trim().length === 0) missingLabels.push('Detalle del segmento')

  return (
    <>
      <h1 className={styles.stepTitle}>Tu Negocio</h1>
      <p className={styles.stepSubtitle}>Datos e imagen de tu empresa</p>

      <div className={styles.logoUpload}>
        <button
          type="button"
          className={styles.logoDrop}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Subir logo"
        >
          {data.logoPreviewUrl
            ? <img src={data.logoPreviewUrl} alt="" />
            : <Upload size={22} aria-hidden="true" />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={handleLogoPick}
        />
        <span className={styles.logoHint}>Subir logo (opcional)</span>
      </div>

      <Input
        label="Nombre del negocio"
        value={data.businessName}
        onChange={e => update({ businessName: e.target.value })}
        required
      />

      <Input
        label="Ciudad"
        value={data.city}
        onChange={e => update({ city: e.target.value })}
        required
      />

      <div className={styles.formField}>
        <label className={styles.fieldLabel}>¿Qué tipo de negocio tienes?</label>
        <div className={styles.typeGrid}>
          {BUSINESS_TYPES.map(type => {
            const Icon = type.icon
            const active = data.segment === type.id
            return (
              <button
                key={type.id}
                type="button"
                className={`${styles.typeCard} ${active ? styles.typeCardActive : ''}`}
                onClick={() => update({ segment: type.id, subSegment: '', subSegmentOther: '' })}
                aria-pressed={active}
              >
                <span className={styles.typeCardIcon}><Icon size={20} aria-hidden="true" /></span>
                <span className={styles.typeCardLabel}>{type.label}</span>
                <span className={styles.typeCardDesc}>{type.desc}</span>
              </button>
            )
          })}
        </div>

        {subSegments.length > 0 && (
          <div className={styles.subSegmentGrid}>
            {subSegments.map(sub => {
              const active = data.subSegment === sub.id
              return (
                <button
                  key={sub.id}
                  type="button"
                  className={`${styles.subSegmentCard} ${active ? styles.subSegmentCardActive : ''}`}
                  onClick={() => update({ subSegment: sub.id })}
                  aria-pressed={active}
                >
                  <span className={styles.subSegmentEmoji}>{sub.emoji}</span>
                  <span className={styles.subSegmentLabel}>{sub.label}</span>
                  <span className={styles.subSegmentDesc}>{sub.desc}</span>
                </button>
              )
            })}
          </div>
        )}

        {needsOther && (
          <Input
            label="¿Cuál es tu segmento?"
            value={data.subSegmentOther}
            onChange={e => update({ subSegmentOther: e.target.value })}
          />
        )}
      </div>

      <div className={styles.continueWrap}>
        <Button fullWidth size="lg" rightIcon={<ArrowRight size={16} />} disabled={!isValid} onClick={onNext}>
          Continuar
        </Button>
        {/* Botón nativo disabled no emite click — esta capa intercepta el toque para mostrar el feedback */}
        {!isValid && (
          <div
            className={styles.disabledOverlay}
            onClick={() => setShowValidationHint(true)}
            aria-hidden="true"
          />
        )}
      </div>

      {showValidationHint && !isValid && missingLabels.length > 0 && (
        <p className={styles.fieldError} role="alert">
          Completa: {missingLabels.join(', ')}
        </p>
      )}
    </>
  )
}
