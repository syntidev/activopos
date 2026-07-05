'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Lock, Percent, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { BusinessConfig, IvaConfig } from '@/types'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

function pwStrength(pw: string): { level: 1 | 2 | 3; label: string } | null {
  if (!pw) return null
  if (pw.length < 8) return { level: 1, label: 'Débil' }
  const hasUpper   = /[A-Z]/.test(pw)
  const hasDigit   = /[0-9]/.test(pw)
  const hasSpecial = /[^A-Za-z0-9]/.test(pw)
  const score = [hasUpper, hasDigit, hasSpecial].filter(Boolean).length
  if (score >= 2) return { level: 3, label: 'Fuerte' }
  if (score >= 1) return { level: 2, label: 'Media' }
  return { level: 1, label: 'Débil' }
}

function PwField({
  id, label, value, onChange, show, onToggle, autoComplete,
}: {
  id: string; label: string; value: string
  onChange: (v: string) => void; show: boolean
  onToggle: () => void; autoComplete?: string
}) {
  return (
    <div className={styles.pwField}>
      <label className={styles.pwLabel} htmlFor={id}>{label}</label>
      <div className={styles.pwInputWrap}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={styles.pwInput}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className={styles.pwToggleBtn}
          onClick={onToggle}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show
            ? <EyeOff size={16} aria-hidden="true" />
            : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}

export function TabGeneral({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [config, setConfig]         = useState<BusinessConfig | null>(null)
  const [loading, setLoading]       = useState(true)
  const [rateSource, setRateSource] = useState<'bcv' | 'parallel' | 'manual'>('bcv')
  const [manualRate, setManualRate] = useState('')
  const [savingRate, setSavingRate] = useState(false)
  const [liveRate, setLiveRate]     = useState<number | null>(null)

  const [iva, setIva]           = useState<IvaConfig>({ iva_enabled: false, iva_pct: 16 })
  const [savingIva, setSavingIva] = useState(false)

  const [pins, setPins]           = useState(['', '', '', ''])
  const [savingPin, setSavingPin] = useState(false)
  const pinRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null])

  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew]         = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [savingPw, setSavingPw]   = useState(false)
  const [pwError, setPwError]     = useState('')

  const [allowOverride, setAllowOverride]     = useState(false)
  const [savingOverride, setSavingOverride]   = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)

  const [showPwCurrent,  setShowPwCurrent]  = useState(false)
  const [showPwNew,      setShowPwNew]      = useState(false)
  const [showPwConfirm,  setShowPwConfirm]  = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/config/business')
      if (!res.ok) throw new Error()
      const body = await res.json() as {
        ok:           boolean
        business:     Omit<BusinessConfig, 'current_rate'>
        current_rate: number
      }
      setConfig({ ...body.business, current_rate: body.current_rate })
      const source = body.business.rate_source
      setRateSource(source === 'parallel' || source === 'manual' ? source : 'bcv')
      setManualRate(String(body.current_rate))
      setAllowOverride(body.business.allow_cashier_price_override ?? false)
    } catch {
      toast('Error al cargar la configuración.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchIva = useCallback(async () => {
    try {
      const res  = await fetch('/api/config/iva')
      if (!res.ok) return
      const body = await res.json() as { ok: boolean; iva: IvaConfig }
      setIva(body.iva)
    } catch { /* keep defaults */ }
  }, [])

  useEffect(() => { void fetchConfig(); void fetchIva() }, [fetchConfig, fetchIva])

  /* Ticker de tasa vivo — separado de `config` a propósito: `config` alimenta
     inputs editables (nombre, dirección, etc.) y sobreescribirlo cada 30s
     borraría ediciones en curso. `liveRate` solo actualiza el número mostrado,
     usando la misma fuente que el badge del Header/Sidebar. No toca
     rateSource/manualRate para no resetear una selección de toggle sin guardar. */
  const fetchLiveRate = useCallback(async () => {
    try {
      const res = await fetch('/api/rates/bcv')
      if (!res.ok) return
      const j = await res.json() as { ok?: boolean; rate?: number }
      if (j.ok && typeof j.rate === 'number') setLiveRate(j.rate)
    } catch { /* mantiene el último valor conocido */ }
  }, [])

  useEffect(() => {
    void fetchLiveRate()
    const interval = setInterval(() => { void fetchLiveRate() }, 30_000)
    const handleFocus = () => { void fetchLiveRate() }
    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchLiveRate])

  const handleSaveIva = async () => {
    setSavingIva(true)
    try {
      const res = await fetch('/api/config/iva', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ iva_enabled: iva.iva_enabled, iva_pct: iva.iva_pct }),
      })
      if (!res.ok) throw new Error()
      toast('Configuración de IVA guardada.', 'success')
    } catch {
      toast('Error al guardar el IVA.', 'error')
    } finally {
      setSavingIva(false)
    }
  }

  const handleSaveRate = async () => {
    setSavingRate(true)
    try {
      const body: Record<string, unknown> = { rate_source: rateSource }
      if (rateSource === 'manual') {
        const r = parseFloat(manualRate)
        if (!r || r <= 0) {
          toast('Ingresa una tasa válida mayor a cero.', 'error')
          return
        }
        body.rate = r
      }
      const res = await fetch('/api/config/business', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast('Tasa actualizada correctamente.', 'success')
      await fetchConfig()
      void fetchLiveRate() // refleja el cambio en el ticker sin esperar el próximo poll de 30s
      window.dispatchEvent(new CustomEvent('rate-updated')) // refetch inmediato del badge del Header
    } catch {
      toast('Error al guardar la tasa.', 'error')
    } finally {
      setSavingRate(false)
    }
  }

  const handlePinChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next  = [...pins]
    next[index] = digit
    setPins(next)
    if (digit && index < 3) pinRefs.current[index + 1]?.focus()
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pins[index] && index > 0) {
      pinRefs.current[index - 1]?.focus()
    }
  }

  const handleSavePin = async () => {
    const pin = pins.join('')
    if (pin.length !== 4) {
      toast('Ingresa los 4 dígitos del PIN.', 'error')
      return
    }
    setSavingPin(true)
    try {
      const res = await fetch('/api/config/pin', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pin }),
      })
      if (!res.ok) throw new Error()
      setPins(['', '', '', ''])
      toast('PIN actualizado correctamente.', 'success')
    } catch {
      toast('Error al guardar el PIN.', 'error')
    } finally {
      setSavingPin(false)
    }
  }

  const handleSavePw = async () => {
    if (!pwCurrent) { setPwError('Ingresa tu contraseña actual.'); return }
    if (pwNew.length < 8) { setPwError('La nueva contraseña debe tener al menos 8 caracteres.'); return }
    if (pwNew !== pwConfirm) { setPwError('Las contraseñas no coinciden.'); return }
    setSavingPw(true); setPwError('')
    try {
      const res = await fetch('/api/users/change-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      })
      const body = await res.json() as { error?: string }
      if (!res.ok) { setPwError(body.error ?? 'Error al actualizar la contraseña.'); return }
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwSuccess(true)
      toast('¡Contraseña actualizada!', 'success')
      setTimeout(() => setPwSuccess(false), 5000)
    } catch {
      setPwError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSavingPw(false)
    }
  }

  const handleToggleOverride = async () => {
    const next = !allowOverride
    setAllowOverride(next)
    setSavingOverride(true)
    try {
      const res = await fetch('/api/config/business', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ allow_cashier_price_override: next }),
      })
      if (!res.ok) throw new Error()
      toast(
        next
          ? 'Cajeros pueden modificar precios sin PIN.'
          : 'Modificación de precios requiere PIN.',
        'success',
      )
    } catch {
      setAllowOverride(!next)
      toast('Error al guardar la configuración.', 'error')
    } finally {
      setSavingOverride(false)
    }
  }

  const ivaPreviewTotal = iva.iva_enabled ? (10 * (1 + iva.iva_pct / 100)).toFixed(2) : null
  const ivaPreviewTax   = iva.iva_enabled ? (10 * iva.iva_pct / 100).toFixed(2) : null

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <RefreshCw size={24} className={styles.spinner} aria-hidden="true" />
        <span>Cargando...</span>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>General</h2>
        <p className={styles.pageSubtitle}>Tasa de cambio BCV y PIN de seguridad</p>
      </div>

      {/* ── Tasa del Dólar ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <RefreshCw size={16} aria-hidden="true" />
          Tasa del Dólar
        </h3>

        <div className={styles.rateDisplay}>
          <span className={styles.rateValue}>
            {(liveRate ?? config?.current_rate ?? 0).toLocaleString('es-VE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className={styles.rateCurrency}>Bs / USD</span>
        </div>

        <div className={styles.formDivider} />

        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Fuente de la tasa</p>
            <p className={styles.toggleHint}>
              {rateSource === 'bcv' && 'Consulta ve.dolarapi.com (oficial BCV) cada hora automáticamente'}
              {rateSource === 'parallel' && 'Consulta ve.dolarapi.com (paralelo) cada hora automáticamente'}
              {rateSource === 'manual' && 'Ingresa la tasa manualmente, sin actualización automática'}
            </p>
          </div>
          <select
            className={styles.segmentSelect}
            value={rateSource}
            onChange={(e) => setRateSource(e.target.value as 'bcv' | 'parallel' | 'manual')}
            aria-label="Fuente de la tasa de cambio"
          >
            <option value="bcv">BCV (oficial)</option>
            <option value="parallel">Paralelo</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {rateSource === 'manual' && (
          <Input
            label="Tasa manual (Bs / USD)"
            type="number"
            step="0.01"
            min="0"
            placeholder="Ej: 36.50"
            value={manualRate}
            onChange={(e) => setManualRate(e.target.value)}
          />
        )}

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSaveRate} loading={savingRate}>
            Guardar tasa
          </Button>
        </div>
      </div>

      {/* ── IVA ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Percent size={16} aria-hidden="true" />
          Impuesto al Valor Agregado (IVA)
        </h3>

        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Cobrar IVA</p>
            <p className={styles.toggleHint}>Se suma al total del ticket al momento de cobrar</p>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${iva.iva_enabled ? styles.toggleBtnOn : ''}`}
            onClick={() => setIva(v => ({ ...v, iva_enabled: !v.iva_enabled }))}
            aria-pressed={iva.iva_enabled}
            aria-label={iva.iva_enabled ? 'Desactivar IVA' : 'Activar IVA'}
          >
            <span className={`${styles.toggleKnob} ${iva.iva_enabled ? styles.toggleKnobOn : ''}`} />
          </button>
        </div>

        {iva.iva_enabled && (
          <>
            <div className={styles.formDivider} />

            <Input
              label="Porcentaje de IVA"
              type="number"
              step="0.01"
              min="0"
              max="30"
              placeholder="16"
              value={String(iva.iva_pct)}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val >= 0 && val <= 30) setIva(v => ({ ...v, iva_pct: val }))
              }}
              hint="Venezuela: 16 % (tasa general)"
            />

            <p className={styles.ivaPreview}>
              Producto de{' '}
              <span className={styles.ivaPreviewAmount}>$10.00</span>
              {' '}→ total{' '}
              <span className={styles.ivaPreviewAmount}>${ivaPreviewTotal}</span>
              {' '}(+${ivaPreviewTax} IVA)
            </p>

            <p className={styles.ivaWarning}>
              Activar IVA modifica el monto final del ticket. Verifica con tu asesor contable antes de activar.
            </p>
          </>
        )}

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSaveIva} loading={savingIva}>
            Guardar IVA
          </Button>
        </div>
      </div>

      {/* ── PIN de Seguridad ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Lock size={16} aria-hidden="true" />
          PIN de Seguridad
        </h3>
        <p className={styles.formCardHint}>
          El PIN protege operaciones críticas: anulaciones, ajustes de inventario y cierre de caja.
          Ingresa un nuevo PIN de 4 dígitos para actualizarlo.
        </p>

        <div className={styles.pinInputs}>
          {pins.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { pinRefs.current[i] = el }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              className={styles.pinInput}
              value={digit}
              placeholder="•"
              onChange={(e) => handlePinChange(i, e.target.value)}
              onKeyDown={(e)  => handlePinKeyDown(i, e)}
              aria-label={`Dígito ${i + 1} del PIN`}
            />
          ))}
        </div>

        <div className={styles.saveRow}>
          <Button
            variant="primary"
            onClick={handleSavePin}
            loading={savingPin}
            disabled={pins.join('').length !== 4}
          >
            Guardar PIN
          </Button>
        </div>
      </div>

      {/* ── Modificación de precios ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Lock size={16} aria-hidden="true" />
          Modificación de Precios
        </h3>

        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Permitir a cajeros modificar precios sin PIN</p>
            <p className={styles.toggleHint}>Cuando está activo, los cajeros pueden cambiar el precio de cualquier ítem sin autorización de administrador</p>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${allowOverride ? styles.toggleBtnOn : ''}`}
            onClick={() => void handleToggleOverride()}
            aria-pressed={allowOverride}
            aria-label={allowOverride ? 'Desactivar modificación libre de precios' : 'Activar modificación libre de precios'}
            disabled={savingOverride}
          >
            <span className={`${styles.toggleKnob} ${allowOverride ? styles.toggleKnobOn : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Cambiar contraseña ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <KeyRound size={16} aria-hidden="true" />
          Cambiar Contraseña
        </h3>
        <p className={styles.formCardHint}>
          Usa al menos 8 caracteres, incluyendo letras mayúsculas, números o caracteres especiales.
        </p>

        <div className={styles.formFields}>
          <PwField
            id="pw-current"
            label="Contraseña actual"
            value={pwCurrent}
            onChange={setPwCurrent}
            show={showPwCurrent}
            onToggle={() => setShowPwCurrent(v => !v)}
            autoComplete="current-password"
          />
          <div>
            <PwField
              id="pw-new"
              label="Nueva contraseña"
              value={pwNew}
              onChange={(v) => { setPwNew(v); setPwError('') }}
              show={showPwNew}
              onToggle={() => setShowPwNew(v => !v)}
              autoComplete="new-password"
            />
            {pwNew && (() => {
              const s = pwStrength(pwNew)
              if (!s) return null
              return (
                <div className={styles.pwStrengthWrap} aria-label={`Fortaleza: ${s.label}`}>
                  <div className={styles.pwStrengthBars}>
                    {([1, 2, 3] as const).map((lvl) => (
                      <div
                        key={lvl}
                        className={`${styles.pwStrengthBar} ${s.level >= lvl
                          ? lvl === 1
                            ? styles.pwStrengthBarWeak
                            : lvl === 2
                              ? styles.pwStrengthBarMed
                              : styles.pwStrengthBarStrong
                          : ''}`}
                      />
                    ))}
                  </div>
                  <span className={`${styles.pwStrengthLabel} ${
                    s.level === 1 ? styles.pwStrengthLabelWeak
                    : s.level === 2 ? styles.pwStrengthLabelMed
                    : styles.pwStrengthLabelStrong
                  }`}>{s.label}</span>
                </div>
              )
            })()}
          </div>
          <PwField
            id="pw-confirm"
            label="Confirmar nueva contraseña"
            value={pwConfirm}
            onChange={(v) => { setPwConfirm(v); setPwError('') }}
            show={showPwConfirm}
            onToggle={() => setShowPwConfirm(v => !v)}
            autoComplete="new-password"
          />
        </div>

        {pwError && (
          <p className={styles.errorMsg} role="alert">{pwError}</p>
        )}
        {pwSuccess && (
          <p className={styles.pwSuccessMsg} role="status">¡Contraseña actualizada correctamente!</p>
        )}

        <div className={styles.saveRow}>
          <Button
            variant="primary"
            onClick={handleSavePw}
            loading={savingPw}
            disabled={!pwCurrent || pwNew.length < 8 || pwNew !== pwConfirm}
          >
            Actualizar contraseña
          </Button>
        </div>
      </div>
    </div>
  )
}
