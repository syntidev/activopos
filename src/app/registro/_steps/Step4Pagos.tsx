'use client'

import { ArrowRight, Check, Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PAYMENT_METHOD_DEFS, BANCOS_VENEZUELA, OPTION_TONES } from '../data'
import type { OnboardingState, PaymentMethodDetails } from '../types'
import styles from '../registro.module.css'

interface StepProps {
  data:   OnboardingState
  update: (patch: Partial<OnboardingState>) => void
  onNext: () => void
}

export default function Step4Pagos({ data, update, onNext }: StepProps) {
  function toggleMethod(id: string) {
    const active = data.paymentMethods.includes(id)
    update({
      paymentMethods: active
        ? data.paymentMethods.filter(m => m !== id)
        : [...data.paymentMethods, id],
    })
  }

  function setDetail(patch: Partial<PaymentMethodDetails>) {
    update({ paymentDetails: { ...data.paymentDetails, ...patch } })
  }

  const isValid = data.paymentMethods.length > 0

  return (
    <>
      <h1 className={styles.stepTitle}>Métodos de Pago</h1>
      <p className={styles.stepSubtitle}>¿Cómo recibirás pagos?</p>

      {PAYMENT_METHOD_DEFS.map((method, i) => {
        const active = data.paymentMethods.includes(method.id)
        const Icon = method.icon
        const tone = styles[OPTION_TONES[i % OPTION_TONES.length]]
        return (
          <div
            key={method.id}
            className={`${styles.paymentOption} ${active ? styles.paymentOptionActive : ''}`}
          >
            <button
              type="button"
              className={styles.paymentOptionHead}
              onClick={() => toggleMethod(method.id)}
              aria-pressed={active}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span className={`${styles.paymentIconWrap} ${tone}`}><Icon size={16} aria-hidden="true" /></span>
              <span>
                <div className={styles.paymentLabel}>{method.label}</div>
                <div className={styles.paymentDesc}>{method.desc}</div>
              </span>
              <span className={`${styles.paymentCheck} ${active ? styles.paymentCheckActive : ''}`}>
                {active && <Check size={12} aria-hidden="true" />}
              </span>
            </button>

            {active && method.id === 'pago_movil' && (
              <div className={styles.paymentDetails}>
                <select
                  className={styles.paymentSelect}
                  value={data.paymentDetails.pagoMovilBanco ?? ''}
                  onChange={e => setDetail({ pagoMovilBanco: e.target.value })}
                >
                  <option value="">Banco receptor</option>
                  {BANCOS_VENEZUELA.map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
                <input
                  className={styles.fieldInput}
                  placeholder="Número de teléfono"
                  value={data.paymentDetails.pagoMovilTelefono ?? ''}
                  onChange={e => setDetail({ pagoMovilTelefono: e.target.value })}
                />
                <input
                  className={styles.fieldInput}
                  placeholder="Cédula del titular (recomendado)"
                  value={data.paymentDetails.pagoMovilCedula ?? ''}
                  onChange={e => setDetail({ pagoMovilCedula: e.target.value })}
                />
                <p className={styles.tip}>
                  <Info size={14} aria-hidden="true" />
                  <span>
                    Recuerda completar tus datos bancarios en Configuración → Datos
                    para Cobrar para que aparezcan en el mensaje de WhatsApp a tus
                    clientes.
                  </span>
                </p>
              </div>
            )}

            {active && method.id === 'zelle' && (
              <div className={styles.paymentDetails}>
                <input
                  className={styles.fieldInput}
                  placeholder="Email o número de Zelle"
                  value={data.paymentDetails.zelleContacto ?? ''}
                  onChange={e => setDetail({ zelleContacto: e.target.value })}
                />
              </div>
            )}

            {active && method.id === 'binance' && (
              <div className={styles.paymentDetails}>
                <input
                  className={styles.fieldInput}
                  placeholder="ID de Binance o dirección USDT (TRC20)"
                  value={data.paymentDetails.binanceId ?? ''}
                  onChange={e => setDetail({ binanceId: e.target.value })}
                />
              </div>
            )}
          </div>
        )
      })}

      <Button
        fullWidth
        size="lg"
        rightIcon={<ArrowRight size={16} />}
        disabled={!isValid}
        onClick={onNext}
        style={{ marginTop: 'var(--space-4)' }}
      >
        Guardar y continuar
      </Button>
    </>
  )
}
