'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { GA4_RE, GSC_RE, SEO_DESC_MAX, SEO_TITLE_MAX } from '@/lib/seo'
import styles from '../configuracion.module.css'
import own from './TabSeoAnalitica.module.css'

interface Props { businessId: number }
interface Form { seo_title: string; seo_description: string; ga4_id: string; gsc_verification: string }
type Server = { [K in keyof Form]: string | null }

const EMPTY: Form = { seo_title: '', seo_description: '', ga4_id: '', gsc_verification: '' }
const toForm = (s: Server): Form => ({ seo_title: s.seo_title ?? '', seo_description: s.seo_description ?? '', ga4_id: s.ga4_id ?? '', gsc_verification: s.gsc_verification ?? '' })

/** Mensaje de validación local (el servidor vuelve a validar igual): vacío = campo opcional. */
function fieldError(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (f.ga4_id.trim() && !GA4_RE.test(f.ga4_id.trim())) e.ga4_id = 'Debe verse como G-XXXXXXXXXX (letras mayúsculas y números).'
  if (f.gsc_verification.trim() && !GSC_RE.test(f.gsc_verification.trim())) e.gsc_verification = 'Solo letras, números, guion y guion bajo (20 a 100 caracteres).'
  return e
}

/** SEO y Analítica: título y descripción para buscadores, Google Analytics 4 y verificación de Search Console. */
export function TabSeoAnalitica({ businessId }: Props) {
  void businessId
  const { toast } = useToast()
  const [form, setForm] = useState<Form>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/config/seo-analitica')
      const data = (await res.json().catch(() => null)) as { seo?: Server } | null
      if (res.ok && data?.seo) setForm(toForm(data.seo))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const errors = fieldError(form)
  const set = (key: keyof Form) => (value: string): void => setForm(prev => ({ ...prev, [key]: value }))

  const save = async (): Promise<void> => {
    if (Object.keys(errors).length > 0) { toast('Revisa los campos marcados.', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/config/seo-analitica', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = (await res.json().catch(() => null)) as { seo?: Server; error?: string } | null
      if (!res.ok) { toast(data?.error ?? 'No se pudo guardar.', 'error'); return }
      if (data?.seo) setForm(toForm(data.seo))
      toast('SEO y analítica guardados.', 'success')
    } catch {
      toast('Error de conexión. Intenta de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.configSection}>
        <div className={styles.pageHeader}><h2 className={styles.pageTitle}>SEO y Analítica</h2></div>
        <p className={styles.pageSubtitle}>Cargando…</p>
      </div>
    )
  }

  return (
    <div className={styles.configSection} data-testid="seo-analitica">
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>SEO y Analítica</h2>
        <p className={styles.pageSubtitle}>Cómo aparece tu catálogo en Google y cómo medir sus visitas. Si lo dejas vacío, se usa el título y la descripción de tu catálogo.</p>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}><BarChart3 size={16} aria-hidden="true" />Buscadores</h3>
        <div className={styles.formFields}>
          <div>
            <Input id="seo-title" label="Título para Google" value={form.seo_title} onChange={e => set('seo_title')(e.target.value)} maxLength={SEO_TITLE_MAX} />
            <p className={own.contador} data-testid="seo-title-contador">{form.seo_title.length}/{SEO_TITLE_MAX}</p>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="seo-description">Descripción para Google</label>
            <textarea id="seo-description" className={styles.textarea} rows={3} maxLength={SEO_DESC_MAX} value={form.seo_description} onChange={e => set('seo_description')(e.target.value)} />
            <p className={own.contador} data-testid="seo-description-contador">{form.seo_description.length}/{SEO_DESC_MAX}</p>
          </div>
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}><BarChart3 size={16} aria-hidden="true" />Analítica y verificación</h3>
        <div className={styles.formFields}>
          <Input id="seo-ga4" label="ID de Google Analytics 4" placeholder="G-XXXXXXXXXX" value={form.ga4_id} onChange={e => set('ga4_id')(e.target.value)} maxLength={20}
            error={errors.ga4_id} hint="Lo encuentras en Analytics > Administrar > Flujos de datos. Solo mide tu catálogo público." />
          <Input id="seo-gsc" label="Código de verificación de Search Console (opcional)" value={form.gsc_verification} onChange={e => set('gsc_verification')(e.target.value)} maxLength={100}
            error={errors.gsc_verification} hint="Solo el valor de content de la etiqueta google-site-verification. Si tienes dominio propio, verifica por DNS y no lo necesitas." />
        </div>
      </div>

      <div className={own.acciones}>
        <Button variant="primary" onClick={() => void save()} loading={saving}>Guardar</Button>
      </div>
    </div>
  )
}
