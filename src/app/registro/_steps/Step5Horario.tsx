'use client'

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { OnboardingState } from '../types'
import styles from '../registro.module.css'

interface StepProps {
  data:   OnboardingState
  update: (patch: Partial<OnboardingState>) => void
  onNext: () => void
}

export default function Step5Horario({ data, update, onNext }: StepProps) {
  return (
    <>
      <h1 className={styles.stepTitle}>Horario</h1>
      <p className={styles.stepSubtitle}>¿Cuándo está abierto tu negocio?</p>

      <div
        className={`${styles.scheduleOption} ${data.schedule === 'always' ? styles.scheduleOptionActive : ''}`}
        onClick={() => update({ schedule: 'always' })}
        role="radio"
        aria-checked={data.schedule === 'always'}
        tabIndex={0}
      >
        <span className={`${styles.scheduleRadio} ${data.schedule === 'always' ? styles.scheduleRadioActive : ''}`}>
          {data.schedule === 'always' && <span className={styles.scheduleRadioDot} />}
        </span>
        <div>
          <div className={styles.scheduleTitle}>
            Siempre Abierto
            <span className={styles.scheduleBadge}>Recomendado</span>
          </div>
          <p className={styles.scheduleDesc}>
            Tu catálogo acepta pedidos las 24 horas. Puedes cambiarlo después en Configuración.
          </p>
        </div>
      </div>

      <div
        className={`${styles.scheduleOption} ${data.schedule === 'custom' ? styles.scheduleOptionActive : ''}`}
        onClick={() => update({ schedule: 'custom' })}
        role="radio"
        aria-checked={data.schedule === 'custom'}
        tabIndex={0}
      >
        <span className={`${styles.scheduleRadio} ${data.schedule === 'custom' ? styles.scheduleRadioActive : ''}`}>
          {data.schedule === 'custom' && <span className={styles.scheduleRadioDot} />}
        </span>
        <div>
          <div className={styles.scheduleTitle}>Configurar horario</div>
          <p className={styles.scheduleDesc}>
            Define los días y horas de atención desde Configuración una vez creada tu tienda.
          </p>
        </div>
      </div>

      <Button fullWidth size="lg" rightIcon={<ArrowRight size={16} />} onClick={onNext}>
        Confirmar y continuar
      </Button>
    </>
  )
}
