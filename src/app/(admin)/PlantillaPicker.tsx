'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CARTA_PRESET_OPTIONS, CARTA_STYLES, TEMPLATES, TEMPLATE_LABELS, type CartaPresetKey, type CartaStyleKey, type PlantillaKey } from '@/lib/plantillas'
import styles from './admin.module.css'

interface PlantillaPickerProps {
  tenantId:  number
  publicUrl: string | null
  /** Por qué el enlace público no está disponible (null = publicado). */
  unavailableReason: string | null
  initial:   { template: PlantillaKey; carta_preset: CartaPresetKey; carta_style: CartaStyleKey }
}

const STYLE_LABELS: Record<CartaStyleKey, string> = { casual: 'Casual', fine: 'Fine dining' }

/** Plantilla del catálogo de un negocio (solo superadmin). El enlace público no cambia al cambiar de plantilla. */
export function PlantillaPicker({ tenantId, publicUrl, unavailableReason, initial }: PlantillaPickerProps) {
  const router = useRouter()
  const [template, setTemplate] = useState<PlantillaKey>(initial.template)
  const [preset, setPreset]     = useState<CartaPresetKey>(initial.carta_preset)
  const [style, setStyle]       = useState<CartaStyleKey>(initial.carta_style)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<string | null>(null)

  async function save(): Promise<void> {
    setSaving(true)
    setMsg(null)
    try {
      const body = template === 'carta' ? { template, carta_preset: preset, carta_style: style } : { template }
      const res = await fetch(`/api/admin/tenants/${tenantId}/plantilla`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setMsg(j.error ?? 'No se pudo guardar.'); return }
      setMsg('Plantilla guardada. El enlace del cliente no cambia.')
      router.refresh()
    } catch {
      setMsg('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.planStatusForm} data-testid="plantilla-picker">
      <div className={styles.planStatusField}>
        <label className={styles.infoLabel} htmlFor="pl-template">Plantilla</label>
        <select id="pl-template" className={styles.planSelect} value={template} onChange={e => setTemplate(e.target.value as PlantillaKey)} disabled={saving}>
          {TEMPLATES.map(t => <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>)}
        </select>
      </div>
      {template === 'carta' && (
        <>
          <div className={styles.planStatusField}>
            <label className={styles.infoLabel} htmlFor="pl-preset">Preset de la carta</label>
            <select id="pl-preset" className={styles.planSelect} value={preset} onChange={e => setPreset(e.target.value as CartaPresetKey)} disabled={saving}>
              {CARTA_PRESET_OPTIONS.map(o => (
                <option key={o.key} value={o.key} disabled={!o.available}>{o.available ? o.label : `${o.label} — Próximamente`}</option>
              ))}
            </select>
          </div>
          <div className={styles.planStatusField}>
            <label className={styles.infoLabel} htmlFor="pl-style">Estilo de la carta</label>
            <select id="pl-style" className={styles.planSelect} value={style} onChange={e => setStyle(e.target.value as CartaStyleKey)} disabled={saving}>
              {CARTA_STYLES.map(s => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
            </select>
          </div>
        </>
      )}
      {publicUrl && (
        <div className={styles.planStatusField}>
          <span className={styles.infoLabel}>Enlace público (único)</span>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={styles.actionLink} data-testid="plantilla-public-url">{publicUrl}</a>
          {unavailableReason && <span className={styles.unavailableReason} role="status" data-testid="public-url-reason">No disponible. {unavailableReason}</span>}
        </div>
      )}
      <div className={styles.planStatusActions}>
        <button type="button" className={`${styles.actionLink} ${styles.actionBtn}`} onClick={() => void save()} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar plantilla'}
        </button>
        {msg && <span className={styles.planStatusMsg} role="status">{msg}</span>}
      </div>
    </div>
  )
}
