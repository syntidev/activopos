'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Check, X, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { OnboardingState } from '../types'
import styles from '../registro.module.css'

interface StepProps {
  data:   OnboardingState
  update: (patch: Partial<OnboardingState>) => void
  onNext: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function passwordRules(password: string) {
  return [
    { ok: password.length >= 8,      label: 'Mínimo 8 caracteres' },
    { ok: /[A-Z]/.test(password),    label: 'Una mayúscula' },
    { ok: /[a-z]/.test(password),    label: 'Una minúscula' },
    { ok: /[0-9]/.test(password),    label: 'Un número' },
  ]
}

export default function Step1Cuenta({ data, update, onNext }: StepProps) {
  const [showPassword, setShowPassword] = useState(false)

  const rules   = passwordRules(data.password)
  const isValid =
    data.nombre.trim().length >= 2 &&
    EMAIL_RE.test(data.email) &&
    rules.every(r => r.ok)

  return (
    <>
      <h1 className={styles.stepTitle}>Tu información de acceso</h1>
      <p className={styles.stepSubtitle}>Crea tu cuenta de ActivoPOS</p>

      <Input
        label="Nombre completo"
        value={data.nombre}
        onChange={e => update({ nombre: e.target.value })}
        autoComplete="name"
        autoFocus
        required
      />

      <Input
        label="Correo electrónico"
        type="email"
        value={data.email}
        onChange={e => update({ email: e.target.value })}
        autoComplete="email"
        required
      />

      <div className={styles.formField}>
        <label htmlFor="password" className={styles.fieldLabel}>Contraseña</label>
        <div className={styles.passwordWrapper}>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className={styles.fieldInput}
            value={data.password}
            onChange={e => update({ password: e.target.value })}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className={styles.passwordEye}
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        </div>

        <div className={styles.passwordStrength}>
          {rules.map(rule => (
            <span
              key={rule.label}
              className={`${styles.passwordRule} ${rule.ok ? styles.passwordRuleOk : ''}`}
            >
              {rule.ok
                ? <Check className={styles.passwordRuleIcon} aria-hidden="true" />
                : <X className={styles.passwordRuleIcon} aria-hidden="true" />}
              {rule.label}
            </span>
          ))}
        </div>
      </div>

      <Button fullWidth size="lg" rightIcon={<ArrowRight size={16} />} disabled={!isValid} onClick={onNext}>
        Continuar
      </Button>

      <p className={styles.footerLink}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </>
  )
}
