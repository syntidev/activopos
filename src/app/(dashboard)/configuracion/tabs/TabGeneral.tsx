'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Lock, Percent } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { BusinessConfig, IvaConfig } from '@/types'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

export function TabGeneral({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [config, setConfig]         = useState<BusinessConfig | null>(null)
  const [loading, setLoading]       = useState(true)
  const [bcvAuto, setBcvAuto]       = useState(true)
  const [manualRate, setManualRate] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  const [iva, setIva]           = useState<IvaConfig>({ iva_enabled: false, iva_pct: 16 })
  const [savingIva, setSavingIva] = useState(false)

  const [pins, setPins]           = useState(['', '', '', ''])
  const [savingPin, setSavingPin] = useState(false)
  const pinRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null])

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
      setBcvAuto(body.business.rate_source === 'bcv')
      setManualRate(String(body.current_rate))
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
      const body: Record<string, unknown> = { rate_source: bcvAuto ? 'bcv' : 'manual' }
      if (!bcvAuto) {
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
            {(config?.current_rate ?? 0).toLocaleString('es-VE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className={styles.rateCurrency}>Bs / USD</span>
        </div>

        <div className={styles.formDivider} />

        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Actualización automática BCV</p>
            <p className={styles.toggleHint}>Consulta ve.dolarapi.com cada hora automáticamente</p>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${bcvAuto ? styles.toggleBtnOn : ''}`}
            onClick={() => setBcvAuto(v => !v)}
            aria-pressed={bcvAuto}
            aria-label={bcvAuto ? 'Desactivar BCV automático' : 'Activar BCV automático'}
          >
            <span className={`${styles.toggleKnob} ${bcvAuto ? styles.toggleKnobOn : ''}`} />
          </button>
        </div>

        {!bcvAuto && (
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
    </div>
  )
}
