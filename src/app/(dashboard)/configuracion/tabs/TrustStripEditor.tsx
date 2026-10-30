'use client'

import { useEffect, useState } from 'react'
import { Truck, ShieldCheck, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { DEFAULT_TRUST_STRIP, TRUST_DESC_MAX, TRUST_TITLE_MAX, trustStripInputSchema, type TrustItem } from '@/lib/trust-strip'
import cfg from '../configuracion.module.css'
import styles from './TrustStripEditor.module.css'

const ICONS = [Truck, ShieldCheck, MessageCircle]
const POSITIONS = ['Envío', 'Garantía', 'Atención']

/** Sección "Franja de confianza" (Tema Visual): los 3 textos de la fila Envío / Garantía / Atención de la home. */
export function TrustStripEditor() {
  const { toast } = useToast()
  const [items, setItems] = useState<TrustItem[]>(() => DEFAULT_TRUST_STRIP.map(i => ({ ...i })))
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/config/catalog')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { catalog?: { trust_strip?: TrustItem[] } } | null) => {
        if (!active) return
        if (!d?.catalog?.trust_strip) { setLoadFailed(true); return }
        setItems(d.catalog.trust_strip)
        setLoaded(true)
      })
      .catch(() => { if (active) setLoadFailed(true) })
    return () => { active = false }
  }, [])

  const setField = (i: number, field: keyof TrustItem, value: string) =>
    setItems(prev => prev.map((it, k) => (k === i ? { ...it, [field]: value } : it)))

  const save = async () => {
    const parsed = trustStripInputSchema.safeParse(items)
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Datos inválidos'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/config/catalog', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ trust_strip: parsed.data }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null) as { issues?: { message: string }[]; error?: string } | null
        throw new Error(j?.issues?.[0]?.message ?? j?.error ?? 'No se pudo guardar.')
      }
      setItems(parsed.data)
      toast('Franja de confianza guardada.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cfg.formCard} data-testid="franja-confianza">
      <h3 className={cfg.formCardTitle}>Franja de confianza</h3>
      <p className={cfg.colorDesc}>
        Los 3 mensajes que aparecen debajo de los productos destacados en la home de tu catálogo. Los íconos no cambian.
      </p>

      {loadFailed && <p className={styles.error} role="alert">No se pudo cargar la franja. Recarga la página para editarla.</p>}

      <ul className={styles.list}>
        {items.map((it, i) => {
          const Icon = ICONS[i]
          return (
            <li key={i} className={styles.item}>
              <div className={styles.itemHead}>
                <Icon size={18} aria-hidden="true" />
                <span>{POSITIONS[i]}</span>
              </div>
              <label className={styles.field}>
                <span className={styles.label}>Título</span>
                <input
                  className={styles.input}
                  value={it.title}
                  maxLength={TRUST_TITLE_MAX}
                  disabled={!loaded}
                  aria-label={`Título de ${POSITIONS[i]}`}
                  onChange={e => setField(i, 'title', e.target.value)}
                />
                <span className={styles.counter} aria-live="polite">{it.title.length}/{TRUST_TITLE_MAX}</span>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Descripción</span>
                <input
                  className={styles.input}
                  value={it.desc}
                  maxLength={TRUST_DESC_MAX}
                  disabled={!loaded}
                  aria-label={`Descripción de ${POSITIONS[i]}`}
                  onChange={e => setField(i, 'desc', e.target.value)}
                />
                <span className={styles.counter} aria-live="polite">{it.desc.length}/{TRUST_DESC_MAX}</span>
              </label>
            </li>
          )
        })}
      </ul>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        <Button variant="primary" onClick={save} loading={saving} disabled={!loaded}>Guardar franja</Button>
      </div>
    </div>
  )
}
