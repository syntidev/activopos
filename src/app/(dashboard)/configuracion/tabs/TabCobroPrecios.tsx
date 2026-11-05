'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { CobroPatch, CobroPrecios, CollectIn } from '@/lib/cobro-precios'
import styles from '../configuracion.module.css'
import own from './TabCobroPrecios.module.css'

interface Props { businessId: number }

interface MethodRow { id: number; name: string; type: string; is_financing: boolean }
interface Preview { name: string; full_usd: number; divisa_usd: number | null }
interface Loaded { config: CobroPrecios; methods: MethodRow[]; preview: Preview | null; rate: number; carta_available: boolean }

const COLLECT_OPTIONS: Array<{ key: CollectIn; label: string }> = [
  { key: 'both', label: 'Bs y $' },
  { key: 'bs',   label: 'Solo Bs' },
  { key: 'usd',  label: 'Solo $' },
]

const fmtUsd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtBs  = (n: number): string => `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Lo que de verdad se aplicaría con el formulario actual (mismas reglas que lib/cobro-precios.readCobroEffective). */
function effectiveOf(c: CobroPrecios): { divisa: boolean; cashea: boolean } {
  return { divisa: c.divisa_enabled && c.collect_in !== 'bs', cashea: c.cashea_enabled && c.collect_in !== 'usd' }
}

function Toggle({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId: string }) {
  return (
    <button
      type="button"
      className={`${styles.toggleBtn} ${on ? styles.toggleBtnOn : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!on)}
    >
      <span className={`${styles.toggleKnob} ${on ? styles.toggleKnobOn : ''}`} />
    </button>
  )
}

function PreviewBox({ form, preview, rate }: { form: CobroPrecios; preview: Preview | null; rate: number }) {
  if (!preview) return <p className={own.muted}>Agrega un producto con precio para ver la vista previa.</p>
  const eff = effectiveOf(form)
  const showDivisa = eff.divisa && preview.divisa_usd !== null
  const main = showDivisa ? (preview.divisa_usd as number) : preview.full_usd
  return (
    <div className={own.preview} data-testid="cp-preview">
      <span className={own.previewLabel}>Vista previa · así se ve hoy</span>
      <span className={own.previewName}>{preview.name}</span>
      <span className={own.previewPrice}>{fmtUsd(main)}</span>
      <span className={own.previewSub}>{showDivisa ? `Pagando en bolívares: ${fmtUsd(preview.full_usd)}` : fmtBs(preview.full_usd * rate)}</span>
      <span className={own.previewTags}>
        {showDivisa && <span className={own.tag}>Selector Divisa / Bs</span>}
        {eff.cashea && <span className={own.tag}>Cashea</span>}
      </span>
    </div>
  )
}

export function TabCobroPrecios({ businessId: _b }: Props) {
  const { toast } = useToast()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<CobroPrecios | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/config/cobro-precios', { cache: 'no-store' })
      const j = await res.json() as Loaded & { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'No se pudo cargar')
      setLoaded(j)
      setForm(j.config)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (error) return <p role="alert">{error}</p>
  if (!loaded || !form) return <p className={own.muted}>Cargando…</p>

  const base = loaded.config
  const patch: CobroPatch = {}
  if (form.collect_in !== base.collect_in) patch.collect_in = form.collect_in
  if (form.divisa_enabled !== base.divisa_enabled) patch.divisa_enabled = form.divisa_enabled
  if (form.cashea_enabled !== base.cashea_enabled) patch.cashea_enabled = form.cashea_enabled
  if (form.template !== base.template) patch.template = form.template
  if (JSON.stringify([...form.divisa_method_ids].sort()) !== JSON.stringify([...base.divisa_method_ids].sort())) patch.divisa_method_ids = form.divisa_method_ids
  const dirty = Object.keys(patch).length > 0

  const set = (p: Partial<CobroPrecios>): void => setForm({ ...form, ...p })
  const toggleMethod = (id: number): void => set({
    divisa_method_ids: form.divisa_method_ids.includes(id) ? form.divisa_method_ids.filter(x => x !== id) : [...form.divisa_method_ids, id],
  })

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const res = await fetch('/api/config/cobro-precios', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      const j = await res.json() as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'No se pudo guardar')
      toast('Cobro y precios guardado', 'success')
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const divisaMethods = loaded.methods.filter(m => !m.is_financing)
  const eff = effectiveOf(form)

  return (
    <div data-testid="tab-cobro-precios">
      <h2 className={styles.pageTitle}>Cobro y precios</h2>
      <p className={styles.pageSubtitle}>Aquí decides cómo cobra tu negocio. Los cambios se aplican al catálogo, la ficha, el carrito y el POS.</p>

      {/* 1. Moneda */}
      <section className={styles.formCard}>
        <h3 className={styles.formCardTitle}>1. Moneda</h3>
        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Precios en</p>
            <p className={styles.toggleHint}>Los precios se fijan en dólares ($); el catálogo siempre muestra el equivalente en Bs.</p>
          </div>
          <span className={own.tag}>$ (USD)</span>
        </div>
        <div>
          <p className={styles.toggleLabel}>Cobras en</p>
          <p className={styles.toggleHint}>Solo Bs: sin precio Divisa. Solo $: sin formas de pago en Bs ni Cashea. Los precios siguen mostrando $ y Bs.</p>
          <div className={own.options} role="radiogroup" aria-label="Cobras en">
            {COLLECT_OPTIONS.map(o => (
              <button key={o.key} type="button" role="radio" aria-checked={form.collect_in === o.key} className={own.option}
                data-testid={`cp-collect-${o.key}`} onClick={() => set({ collect_in: o.key })}>{o.label}</button>
            ))}
          </div>
        </div>
        <PreviewBox form={form} preview={loaded.preview} rate={loaded.rate} />
      </section>

      {/* 2. Precio Divisa */}
      <section className={styles.formCard}>
        <h3 className={styles.formCardTitle}>2. Precio Divisa</h3>
        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Ofrecer precio Divisa</p>
            <p className={styles.toggleHint}>Apagado: un solo precio (el normal) en catálogo, ficha y POS, sin selector.</p>
          </div>
          <Toggle on={form.divisa_enabled} onChange={v => set({ divisa_enabled: v })} label="Ofrecer precio Divisa" testId="cp-divisa" />
        </div>
        {form.collect_in === 'bs' && <p className={own.muted}>Con «Cobras en: Solo Bs» el precio Divisa queda desactivado.</p>}
      </section>

      {/* 3. Cashea */}
      <section className={styles.formCard}>
        <h3 className={styles.formCardTitle}>3. Cashea / financiamiento</h3>
        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Ofrecer Cashea</p>
            <p className={styles.toggleHint}>Apagado: ningún logo, chip, línea ni opción Cashea, aunque el producto lo tenga encendido.</p>
          </div>
          <Toggle on={form.cashea_enabled} onChange={v => set({ cashea_enabled: v })} label="Ofrecer Cashea" testId="cp-cashea" />
        </div>
        {form.collect_in === 'usd' && <p className={own.muted}>Con «Cobras en: Solo $» Cashea queda desactivado.</p>}
      </section>

      {/* 4. Métodos Divisa */}
      <section className={styles.formCard}>
        <h3 className={styles.formCardTitle}>4. Métodos Divisa</h3>
        <p className={styles.formCardHint}>Los medios de pago que cuentan como Divisa: aparecen como «Paga con» junto al precio Divisa.</p>
        {divisaMethods.length === 0 ? (
          <p className={own.muted}>No hay medios de cobro activos. Créalos en «Medios de Cobro».</p>
        ) : (
          <ul className={own.methods} aria-label="Métodos Divisa">
            {divisaMethods.map(m => (
              <li key={m.id}>
                <label className={own.method}>
                  <input type="checkbox" checked={form.divisa_method_ids.includes(m.id)} onChange={() => toggleMethod(m.id)} disabled={!eff.divisa} />
                  {m.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5. Plantilla */}
      <section className={styles.formCard}>
        <h3 className={styles.formCardTitle}>5. Plantilla del catálogo</h3>
        <p className={styles.formCardHint}>El diseño que ven tus clientes. «Premium» muestra el selector de moneda y la ficha completa.</p>
        <div className={own.options} role="radiogroup" aria-label="Plantilla del catálogo">
          {(['generic', 'premium'] as const).map(t => (
            <button key={t} type="button" role="radio" aria-checked={form.template === t} className={own.option}
              data-testid={`cp-template-${t}`} onClick={() => set({ template: t })}>{t === 'generic' ? 'Clásica' : 'Premium'}</button>
          ))}
          <button type="button" role="radio" aria-checked={false} className={own.option} disabled={!loaded.carta_available} data-testid="cp-template-carta">
            Carta<span className={own.soon}>Próximamente</span>
          </button>
        </div>
      </section>

      <div className={styles.saveRow}>
        <Button variant="primary" onClick={() => { void save() }} loading={saving} disabled={!dirty}>Guardar cambios</Button>
      </div>
    </div>
  )
}
