'use client'

import { useEffect, useState } from 'react'
import { Ticket } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { KitConfig } from '@/lib/kit-config'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

const EMPTY: KitConfig = {
  nombre_evento: '', fecha_texto: '', badge_hero: '', seo_title: '', seo_description: '',
  activo: false, mostrar_en_header: false,
}

type TextField = 'nombre_evento' | 'fecha_texto' | 'badge_hero' | 'seo_title'

interface ServerError { error?: string; issues?: { path?: (string | number)[]; message: string }[] }

// Mensaje real del servidor: primer issue de Zod (campo + texto) o el error general.
function serverMessage(data: ServerError | null): string {
  const issue = data?.issues?.[0]
  if (issue) return issue.path?.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message
  return data?.error ?? 'No se pudo guardar la configuración del Kit.'
}

export function TabKit200k({ businessId: _b }: Props) {
  const { toast } = useToast()
  const [config, setConfig]   = useState<KitConfig>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/config/kit200k')
      .then(async res => {
        const data = await res.json().catch(() => null) as ({ config?: KitConfig } & ServerError) | null
        if (!res.ok || !data?.config) throw new Error(serverMessage(data))
        if (active) setConfig(data.config)
      })
      .catch((err: unknown) => {
        if (active) toast(err instanceof Error ? err.message : 'No se pudo cargar la configuración del Kit.', 'error')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [toast])

  const setText = (field: TextField) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig(prev => ({ ...prev, [field]: e.target.value }))

  const save = async () => {
    setSaving(true)
    try {
      const res  = await fetch('/api/config/kit200k', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(config),
      })
      const data = await res.json().catch(() => null) as ({ config?: KitConfig } & ServerError) | null
      if (!res.ok) { toast(serverMessage(data), 'error'); return }
      if (data?.config) setConfig(data.config)
      toast('Configuración del Kit guardada.', 'success')
    } catch {
      toast('Error de conexión. Intenta de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.configSection}>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Kit 200K</h2>
        </div>
        <p className={styles.pageSubtitle}>Cargando…</p>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Kit 200K</h2>
        <p className={styles.pageSubtitle}>Textos y visibilidad del micrositio de preventa (/kit-200k).</p>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Ticket size={16} aria-hidden="true" />
          Evento y portada
        </h3>
        <p className={styles.colorDesc}>
          Las imágenes del kit, de sus componentes y de las franelas se editan desde cada producto en Productos.
        </p>
        <div className={styles.formFields}>
          <Input id="kit-nombre-evento" label="Nombre del evento" value={config.nombre_evento} onChange={setText('nombre_evento')} maxLength={120} />
          <Input id="kit-fecha-texto" label="Fecha (texto)" value={config.fecha_texto} onChange={setText('fecha_texto')} maxLength={60} placeholder="8 de septiembre de 2027" />
          <Input
            id="kit-badge-hero"
            label="Texto destacado de la portada"
            value={config.badge_hero}
            onChange={setText('badge_hero')}
            maxLength={160}
            hint="Se muestra sobre el título del Kit. Si lo dejas vacío, no se muestra."
          />
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>SEO</h3>
        <div className={styles.formFields}>
          <Input
            id="kit-seo-title"
            label="Título para buscadores"
            value={config.seo_title}
            onChange={setText('seo_title')}
            maxLength={160}
            hint="Si lo dejas vacío, se usa el título actual del Kit."
          />
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="kit-seo-description">Descripción para buscadores</label>
            <textarea
              id="kit-seo-description"
              className={styles.textarea}
              value={config.seo_description}
              onChange={e => setConfig(prev => ({ ...prev, seo_description: e.target.value }))}
              maxLength={300}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Visibilidad</h3>
        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Kit activo</p>
            <p className={styles.toggleHint}>Habilita el Kit en el catálogo.</p>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${config.activo ? styles.toggleBtnOn : ''}`}
            onClick={() => setConfig(prev => ({ ...prev, activo: !prev.activo }))}
            aria-pressed={config.activo}
            aria-label="Kit activo"
          >
            <span className={`${styles.toggleKnob} ${config.activo ? styles.toggleKnobOn : ''}`} />
          </button>
        </div>
        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Mostrar &quot;200K&quot; en el menú del catálogo</p>
            <p className={styles.toggleHint}>El enlace aparece solo si el Kit también está activo.</p>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${config.mostrar_en_header ? styles.toggleBtnOn : ''}`}
            onClick={() => setConfig(prev => ({ ...prev, mostrar_en_header: !prev.mostrar_en_header }))}
            aria-pressed={config.mostrar_en_header}
            aria-label="Mostrar 200K en el menú del catálogo"
          >
            <span className={`${styles.toggleKnob} ${config.mostrar_en_header ? styles.toggleKnobOn : ''}`} />
          </button>
        </div>
      </div>

      <div className={styles.saveRow}>
        <Button variant="primary" onClick={() => void save()} loading={saving}>Guardar</Button>
      </div>
    </div>
  )
}
