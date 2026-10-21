'use client'

import { useEffect, useState } from 'react'
import { ImageUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ImageField } from '@/components/ui/ImageField'
import { useToast } from '@/components/ui/Toast'
import { CASHEA_PRESET, FINANCING_NAME_MAX, FINANCING_PHRASE_MAX } from '@/lib/financing'
import type { FinancingConfig as FinancingSettings, FinancingMode } from '@/lib/financing'
import styles from '../configuracion.module.css'

type FieldName = 'provider_name' | 'phrase' | 'logo_url'

interface ModeOption {
  key:   FinancingMode
  title: string
  hint:  string
}

const MODES: ReadonlyArray<ModeOption> = [
  { key: 'cashea', title: 'Cashea',               hint: 'Usa el nombre y logo oficiales de Cashea' },
  { key: 'other',  title: 'Otra empresa',         hint: 'Tu proveedor, con su nombre y su logo' },
  { key: 'own',    title: 'Financiamiento propio', hint: 'Solo una frase, sin logo' },
]

const EMPTY: FinancingSettings = { enabled: false, mode: 'cashea', provider_name: null, phrase: null, logo_url: null }

/** Al salir del preset Cashea no se arrastran su nombre, frase ni logo al otro modo. */
function withoutPreset(cfg: FinancingSettings, mode: FinancingMode): Partial<FinancingSettings> {
  return {
    mode,
    provider_name: cfg.provider_name === CASHEA_PRESET.provider_name ? null : cfg.provider_name,
    phrase:        cfg.phrase === CASHEA_PRESET.phrase ? null : cfg.phrase,
    logo_url:      mode === 'other' && cfg.logo_url !== CASHEA_PRESET.logo_url ? cfg.logo_url : null,
  }
}

const isField = (v: unknown): v is FieldName => v === 'provider_name' || v === 'phrase' || v === 'logo_url'

function phrasePlaceholder(cfg: FinancingSettings): string {
  if (cfg.mode === 'cashea') return 'Paga en cuotas con Cashea'
  if (cfg.mode === 'other') return `Paga en cuotas con ${cfg.provider_name?.trim() || 'tu empresa'}`
  return 'Ej: Te financiamos en 3 cuotas sin intereses'
}

/**
 * Financiamiento del catálogo por negocio (contrato .doc/CONTRATO_FINANCIAMIENTO.md):
 * activado, modo (Cashea / otra empresa / propio), frase editable y logo subido. Nada de Cashea queda cableado:
 * es solo un preset del servidor. Guarda con PATCH /api/config/catalog { financing } y muestra el error 422 junto a su campo.
 */
export function FinancingConfig() {
  const { toast } = useToast()
  const [cfg, setCfg] = useState<FinancingSettings>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})

  useEffect(() => {
    let active = true
    fetch('/api/config/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { catalog?: { financing?: FinancingSettings } } | null) => {
        if (active && data?.catalog?.financing) setCfg(data.catalog.financing)
      })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [])

  const patch = (next: Partial<FinancingSettings>) => {
    setCfg((prev) => ({ ...prev, ...next }))
    setErrors({})
  }

  const save = async () => {
    setSaving(true)
    setErrors({})
    const body = {
      enabled: cfg.enabled,
      mode: cfg.mode,
      ...(cfg.mode === 'other' && cfg.provider_name?.trim() ? { provider_name: cfg.provider_name.trim() } : {}),
      ...(cfg.phrase?.trim() ? { phrase: cfg.phrase.trim() } : {}),
      ...(cfg.mode === 'other' && cfg.logo_url ? { logo_url: cfg.logo_url } : {}),
    }
    try {
      const res = await fetch('/api/config/catalog', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ financing: body }),
      })
      const data = await res.json().catch(() => null) as { financing?: FinancingSettings; error?: string; field?: unknown } | null
      if (res.ok && data?.financing) {
        setCfg(data.financing)
        toast('Financiamiento guardado.', 'success')
        return
      }
      const message = data?.error ?? 'No se pudo guardar el financiamiento.'
      if (isField(data?.field)) setErrors({ [data.field]: message })
      else toast(message, 'error')
    } catch {
      toast('No se pudo guardar el financiamiento.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.formCard}>
      <h3 className={styles.formCardTitle}>Financiamiento</h3>

      <div className={styles.toggleRow}>
        <div>
          <p className={styles.toggleLabel}>Ofrecer financiamiento en el catálogo</p>
          <p className={styles.toggleHint}>Todos los productos entran; puedes excluir los que quieras desde su ficha.</p>
        </div>
        <button
          type="button"
          className={`${styles.toggleBtn} ${cfg.enabled ? styles.toggleBtnOn : ''}`}
          onClick={() => patch({ enabled: !cfg.enabled })}
          disabled={!loaded || saving}
          aria-pressed={cfg.enabled}
          aria-label={cfg.enabled ? 'Desactivar financiamiento' : 'Activar financiamiento'}
        >
          <span className={`${styles.toggleKnob} ${cfg.enabled ? styles.toggleKnobOn : ''}`} />
        </button>
      </div>

      {cfg.enabled && (
        <>
          <div className={styles.posModeOptions} role="radiogroup" aria-label="Quién financia">
            {MODES.map((opt) => (
              <label key={opt.key} className={`${styles.posModeOption} ${cfg.mode === opt.key ? styles.posModeOptionActive : ''}`}>
                <input
                  type="radio"
                  name="financing-mode"
                  className={styles.posModeRadio}
                  checked={cfg.mode === opt.key}
                  onChange={() => patch(opt.key === 'cashea' ? { mode: opt.key, logo_url: null } : withoutPreset(cfg, opt.key))}
                />
                <span>
                  <strong>{opt.title}</strong>
                  <small>{opt.hint}</small>
                </span>
              </label>
            ))}
          </div>

          {cfg.mode === 'other' && (
            <Input
              label="Nombre de la empresa"
              value={cfg.provider_name ?? ''}
              onChange={(e) => patch({ provider_name: e.target.value })}
              maxLength={FINANCING_NAME_MAX}
              error={errors.provider_name}
            />
          )}

          <Input
            label="Frase en el catálogo"
            value={cfg.phrase ?? ''}
            onChange={(e) => patch({ phrase: e.target.value })}
            placeholder={phrasePlaceholder(cfg)}
            maxLength={FINANCING_PHRASE_MAX}
            error={errors.phrase}
          />

          {cfg.mode === 'other' && (
            <div className={styles.fieldGroup}>
              <ImageField
                label="Logo de la empresa"
                value={cfg.logo_url}
                onChange={(url) => patch({ logo_url: url })}
                uploadType="financing"
                removable
                layout="inline"
                boxClassName={styles.imageFieldDropZone}
                imgClassName={styles.imageFieldPreview}
                alt="Logo de la empresa de financiamiento"
                emptyContent={<ImageUp size={22} aria-hidden="true" />}
              />
              {errors.logo_url && <p className={styles.errorMsg} role="alert">{errors.logo_url}</p>}
            </div>
          )}
        </>
      )}

      <div className={styles.saveRow}>
        <Button variant="primary" onClick={save} loading={saving} disabled={!loaded}>
          Guardar financiamiento
        </Button>
      </div>
    </div>
  )
}
