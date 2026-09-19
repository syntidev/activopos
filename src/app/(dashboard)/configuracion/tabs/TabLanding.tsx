'use client'

import { useEffect, useState } from 'react'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, ImageUp, LayoutTemplate,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { SECTION_TYPES } from '@/lib/landing-sections'
import type {
  SectionType, HeroConfig, EventSliderConfig, CommunityConfig, StoryConfig, CollectionGridConfig,
  AnnouncementPopupConfig, SlideConfig, CommunityItemConfig,
} from '@/lib/landing-sections'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

interface SectionRow {
  id:      number
  type:    SectionType
  order:   number
  visible: boolean
  config:  Record<string, unknown>
  isNew?:  boolean
}

const TYPE_LABELS: Record<SectionType, string> = {
  hero:                'Hero',
  event_slider:        'Banner de evento',
  community:           'Comunidad',
  story:               'Historia de marca',
  collection_grid:     'Colección',
  // Fase 2 (schema, 2026-09-18) — sin formulario propio todavía en este tab
  // (fuera de scope: solo se agregó el tipo/label para que el mapa exhaustivo
  // siga compilando). Editar su config hoy requiere ir directo a la API.
  announcement_popup:  'Popup de anuncio',
}

const EMPTY_SLIDE: SlideConfig = { title: '', subtitle: '', cta_text: '', cta_link: '', image_url: '' }
const EMPTY_ITEM: CommunityItemConfig = { image_url: '', product_tag: '' }

const DEFAULT_CONFIG: Record<SectionType, Record<string, unknown>> = {
  hero:            { title: '', subtitle: '', cta_text: '', cta_link: '', image_url: '' } satisfies HeroConfig,
  event_slider:    { slides: [EMPTY_SLIDE, { ...EMPTY_SLIDE }] } satisfies EventSliderConfig,
  community:       { heading: '', subheading: '', items: [EMPTY_ITEM, { ...EMPTY_ITEM }] } satisfies CommunityConfig,
  story:           { eyebrow: '', title: '', body: '', image_url: '' } satisfies StoryConfig,
  // collection_id=0 no pasa el schema (.positive()) hasta que el admin elija una
  // colección real -- mismo patrón que hero/story arrancando con strings vacíos
  // que tampoco pasan min(1): "Se persiste recién cuando el admin llena el form".
  collection_grid: { collection_id: 0 } satisfies CollectionGridConfig,
  announcement_popup: { image_url: '', heading: '', delay_ms: 2500 } satisfies AnnouncementPopupConfig,
}

/* Compresión client-side (Canvas -> WebP) — mismo patrón que ProductModal.tsx,
   no reinventado: archivos chicos se suben tal cual (el backend ya genera webp). */
const COMPRESS_THRESHOLD_KB = 800
const COMPRESS_MAX_DIM      = 1600
const COMPRESS_QUALITY      = 0.85

async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_KB * 1024) return file
  return new Promise<File>((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
        if (width > height) { height = Math.round(height * (COMPRESS_MAX_DIM / width)); width = COMPRESS_MAX_DIM }
        else { width = Math.round(width * (COMPRESS_MAX_DIM / height)); height = COMPRESS_MAX_DIM }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp', lastModified: file.lastModified }))
        },
        'image/webp',
        COMPRESS_QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

async function uploadLandingImage(file: File): Promise<string | null> {
  const compressed = await compressImage(file)
  const fd = new FormData()
  fd.append('file', compressed)
  fd.append('type', 'landing')
  const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
  if (!res.ok) return null
  const { url } = await res.json() as { url: string }
  return url
}

export function TabLanding({ businessId: _b }: Props) {
  const { toast } = useToast()
  const [sections, setSections] = useState<SectionRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [busyId, setBusyId]     = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/landing-sections')
      if (res.ok) {
        const data = await res.json() as { sections: SectionRow[] }
        setSections(data.sections.slice().sort((a, b) => a.order - b.order))
      }
    } catch {
      toast('Error de conexión al cargar las secciones.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const existingTypes = new Set(sections.map(s => s.type))
  const missingTypes  = SECTION_TYPES.filter(t => !existingTypes.has(t))

  // Borrador local, sin POST todavía — los campos requeridos (título, imagen…)
  // empiezan vacíos y el schema Zod exige min(1) + image_url con formato
  // válido, así que un POST inmediato con defaults vacíos siempre da 400.
  // Se persiste recién cuando el admin llena el form y presiona Guardar.
  function addSection(type: SectionType) {
    const draft: SectionRow = {
      id:      -Date.now(),
      type,
      order:   sections.length,
      visible: true,
      config:  DEFAULT_CONFIG[type],
      isNew:   true,
    }
    setSections(prev => [...prev, draft])
  }

  async function patchSection(id: number, body: Partial<{ config: unknown; visible: boolean; order: number }>): Promise<boolean> {
    const res = await fetch(`/api/landing-sections/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) { toast('Error al guardar.', 'error'); return false }
    return true
  }

  async function deleteSection(id: number, isNew?: boolean) {
    if (!confirm('¿Eliminar esta sección del catálogo?')) return
    if (isNew) { setSections(prev => prev.filter(s => s.id !== id)); return }
    setBusyId(id)
    try {
      const res = await fetch(`/api/landing-sections/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Error al eliminar.', 'error'); return }
      setSections(prev => prev.filter(s => s.id !== id))
      toast('Sección eliminada.', 'success')
    } finally {
      setBusyId(null)
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = sections.findIndex(s => s.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sections.length) return
    const a = sections[idx]
    const b = sections[swapIdx]
    const next = sections.slice()
    next[idx]     = { ...b, order: a.order }
    next[swapIdx] = { ...a, order: b.order }
    next.sort((x, y) => x.order - y.order)
    setSections(next)
    // Borradores (isNew, sin fila real todavía) reordenan solo local — nada que PATCH.
    setBusyId(id)
    try {
      await Promise.all([
        a.isNew ? Promise.resolve(true) : patchSection(a.id, { order: b.order }),
        b.isNew ? Promise.resolve(true) : patchSection(b.id, { order: a.order }),
      ])
    } finally {
      setBusyId(null)
    }
  }

  async function toggleVisible(s: SectionRow) {
    const nextVisible = !s.visible
    setSections(prev => prev.map(x => x.id === s.id ? { ...x, visible: nextVisible } : x))
    if (s.isNew) return
    setBusyId(s.id)
    try {
      const ok = await patchSection(s.id, { visible: nextVisible })
      if (!ok) setSections(prev => prev.map(x => x.id === s.id ? { ...x, visible: s.visible } : x))
    } finally {
      setBusyId(null)
    }
  }

  function updateConfig(id: number, config: Record<string, unknown>) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, config } : s))
  }

  async function saveConfig(s: SectionRow) {
    setBusyId(s.id)
    try {
      if (s.isNew) {
        const res = await fetch('/api/landing-sections', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ type: s.type, config: s.config, visible: s.visible }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null) as { error?: string } | null
          toast(data?.error ?? 'Revisa los campos requeridos.', 'error')
          return
        }
        const data = await res.json() as { section: SectionRow }
        setSections(prev => prev.map(x => x.id === s.id ? { ...data.section, isNew: false } : x))
        toast('Sección creada.', 'success')
        return
      }
      const ok = await patchSection(s.id, { config: s.config })
      if (ok) toast('Sección guardada.', 'success')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.configSection}>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Landing del Catálogo</h2>
        </div>
        <p className={styles.pageSubtitle}>Cargando…</p>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Landing del Catálogo</h2>
        <p className={styles.pageSubtitle}>
          Secciones editoriales del catálogo público — hero, banner de evento, comunidad e historia de marca.
          El orden acá define el orden real en el catálogo.
        </p>
      </div>

      {sections.map((s, i) => (
        <SectionCard
          key={s.id}
          section={s}
          isFirst={i === 0}
          isLast={i === sections.length - 1}
          busy={busyId === s.id}
          onMoveUp={() => move(s.id, -1)}
          onMoveDown={() => move(s.id, 1)}
          onToggleVisible={() => toggleVisible(s)}
          onDelete={() => deleteSection(s.id, s.isNew)}
          onConfigChange={(cfg) => updateConfig(s.id, cfg)}
          onSave={() => saveConfig(s)}
        />
      ))}

      {missingTypes.length > 0 && (
        <div className={styles.formCard}>
          <h3 className={styles.formCardTitle}>
            <Plus size={16} aria-hidden="true" />
            Agregar sección
          </h3>
          <div className={styles.landingAddRow}>
            {missingTypes.map(t => (
              <Button key={t} variant="secondary" onClick={() => addSection(t)} loading={busyId === -1}>
                {TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tarjeta por sección — header con controles + form del tipo ────────── */

interface SectionCardProps {
  section:         SectionRow
  isFirst:         boolean
  isLast:          boolean
  busy:            boolean
  onMoveUp:        () => void
  onMoveDown:      () => void
  onToggleVisible: () => void
  onDelete:        () => void
  onConfigChange:  (config: Record<string, unknown>) => void
  onSave:          () => void
}

function SectionCard({
  section, isFirst, isLast, busy,
  onMoveUp, onMoveDown, onToggleVisible, onDelete, onConfigChange, onSave,
}: SectionCardProps) {
  return (
    <div className={styles.formCard}>
      <div className={styles.landingCardHeader}>
        <h3 className={styles.formCardTitle}>
          <LayoutTemplate size={16} aria-hidden="true" />
          {TYPE_LABELS[section.type]}
          {!section.visible && <span className={styles.landingHiddenBadge}>Oculta</span>}
        </h3>
        <div className={styles.landingCardControls}>
          <button type="button" className={styles.landingIconBtn} onClick={onMoveUp} disabled={isFirst || busy} aria-label="Subir sección">
            <ChevronUp size={15} aria-hidden="true" />
          </button>
          <button type="button" className={styles.landingIconBtn} onClick={onMoveDown} disabled={isLast || busy} aria-label="Bajar sección">
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <button type="button" className={styles.landingIconBtn} onClick={onToggleVisible} disabled={busy} aria-label={section.visible ? 'Ocultar sección' : 'Mostrar sección'}>
            {section.visible ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
          </button>
          <button type="button" className={`${styles.landingIconBtn} ${styles.landingIconBtnDanger}`} onClick={onDelete} disabled={busy} aria-label="Eliminar sección">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {section.type === 'hero'            && <HeroForm           config={section.config as unknown as HeroConfig} onChange={onConfigChange} />}
      {section.type === 'event_slider'    && <EventSliderForm    config={section.config as unknown as EventSliderConfig} onChange={onConfigChange} />}
      {section.type === 'community'       && <CommunityForm      config={section.config as unknown as CommunityConfig} onChange={onConfigChange} />}
      {section.type === 'story'           && <StoryForm          config={section.config as unknown as StoryConfig} onChange={onConfigChange} />}
      {section.type === 'collection_grid' && <CollectionGridForm config={section.config as unknown as CollectionGridConfig} onChange={onConfigChange} />}

      <div className={styles.saveRow}>
        <Button variant="primary" onClick={onSave} loading={busy}>Guardar</Button>
      </div>
    </div>
  )
}

/* ── Campo de imagen reutilizable — mismo patrón de TabTema (dropzone + upload) ── */

export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const inputId = `ls-file-${label.replace(/\s+/g, '-')}`

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const url = await uploadLandingImage(file)
      if (url) onChange(url)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>{label}</label>
      <div
        className={`${styles.coverDropZone} ${dragging ? styles.logoDropZoneActive : ''}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => document.getElementById(inputId)?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') document.getElementById(inputId)?.click() }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f) }}
      >
        {value ? (
          <img src={value} alt="" className={styles.coverPreview} />
        ) : (
          <div className={styles.coverEmpty}>
            <ImageUp size={20} aria-hidden="true" />
            <p className={styles.logoDropText}>Arrastra o haz clic</p>
          </div>
        )}
        {uploading && <div className={styles.coverUploading}>Subiendo…</div>}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={styles.logoFileInput}
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}

/* ── Formularios por tipo — solo campos, sin builder visual ────────────── */

function HeroForm({ config, onChange }: { config: HeroConfig; onChange: (c: HeroConfig) => void }) {
  const set = <K extends keyof HeroConfig>(k: K) => (v: HeroConfig[K]) => onChange({ ...config, [k]: v })
  return (
    <div className={styles.formFields}>
      <Input label="Título" value={config.title} onChange={e => set('title')(e.target.value)} maxLength={120} />
      <Input label="Subtítulo" value={config.subtitle} onChange={e => set('subtitle')(e.target.value)} maxLength={200} />
      <Input label="Texto del botón" value={config.cta_text} onChange={e => set('cta_text')(e.target.value)} maxLength={40} />
      <Input label="Link del botón" value={config.cta_link} onChange={e => set('cta_link')(e.target.value)} placeholder="/catalogo-premium/mi-slug/productos" maxLength={500} />
      <ImageField label="Imagen de fondo" value={config.image_url} onChange={v => set('image_url')(v)} />
      <Input label="Video (opcional)" value={config.video_url ?? ''} onChange={e => set('video_url')(e.target.value || undefined)} placeholder="https://…mp4" maxLength={500} />
    </div>
  )
}

function EventSliderForm({ config, onChange }: { config: EventSliderConfig; onChange: (c: EventSliderConfig) => void }) {
  const setSlide = (i: number, patch: Partial<SlideConfig>) => {
    const slides = config.slides.map((s, idx) => idx === i ? { ...s, ...patch } : s)
    onChange({ ...config, slides })
  }
  const addSlide = () => {
    if (config.slides.length >= 8) return
    onChange({ ...config, slides: [...config.slides, { ...EMPTY_SLIDE }] })
  }
  const removeSlide = (i: number) => {
    if (config.slides.length <= 2) return
    onChange({ ...config, slides: config.slides.filter((_, idx) => idx !== i) })
  }

  return (
    <div className={styles.formFields}>
      {config.slides.map((slide, i) => (
        <div key={i} className={styles.landingSubCard}>
          <div className={styles.landingCardHeader}>
            <span className={styles.landingSubCardTitle}>Slide {i + 1}</span>
            <button
              type="button"
              className={`${styles.landingIconBtn} ${styles.landingIconBtnDanger}`}
              onClick={() => removeSlide(i)}
              disabled={config.slides.length <= 2}
              aria-label={`Eliminar slide ${i + 1}`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.formFields}>
            <Input label="Título" value={slide.title} onChange={e => setSlide(i, { title: e.target.value })} maxLength={120} />
            <Input label="Subtítulo" value={slide.subtitle} onChange={e => setSlide(i, { subtitle: e.target.value })} maxLength={200} />
            <Input label="Texto del botón" value={slide.cta_text} onChange={e => setSlide(i, { cta_text: e.target.value })} maxLength={40} />
            <Input label="Link del botón" value={slide.cta_link} onChange={e => setSlide(i, { cta_link: e.target.value })} maxLength={500} />
            <ImageField label={`Imagen slide ${i + 1}`} value={slide.image_url} onChange={v => setSlide(i, { image_url: v })} />
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={addSlide} disabled={config.slides.length >= 8}>
        <Plus size={14} aria-hidden="true" /> Agregar slide ({config.slides.length}/8)
      </Button>
    </div>
  )
}

function CommunityForm({ config, onChange }: { config: CommunityConfig; onChange: (c: CommunityConfig) => void }) {
  const setItem = (i: number, patch: Partial<CommunityItemConfig>) => {
    const items = config.items.map((it, idx) => idx === i ? { ...it, ...patch } : it)
    onChange({ ...config, items })
  }
  const addItem = () => {
    if (config.items.length >= 4) return
    onChange({ ...config, items: [...config.items, { ...EMPTY_ITEM }] })
  }
  const removeItem = (i: number) => {
    if (config.items.length <= 2) return
    onChange({ ...config, items: config.items.filter((_, idx) => idx !== i) })
  }

  return (
    <div className={styles.formFields}>
      <Input label="Encabezado" value={config.heading} onChange={e => onChange({ ...config, heading: e.target.value })} maxLength={120} />
      <Input label="Subtítulo" value={config.subheading} onChange={e => onChange({ ...config, subheading: e.target.value })} maxLength={200} />
      {config.items.map((item, i) => (
        <div key={i} className={styles.landingSubCard}>
          <div className={styles.landingCardHeader}>
            <span className={styles.landingSubCardTitle}>Foto {i + 1}</span>
            <button
              type="button"
              className={`${styles.landingIconBtn} ${styles.landingIconBtnDanger}`}
              onClick={() => removeItem(i)}
              disabled={config.items.length <= 2}
              aria-label={`Eliminar foto ${i + 1}`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.formFields}>
            <ImageField label={`Foto ${i + 1}`} value={item.image_url} onChange={v => setItem(i, { image_url: v })} />
            <Input label="Producto etiquetado" value={item.product_tag} onChange={e => setItem(i, { product_tag: e.target.value })} maxLength={80} />
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={addItem} disabled={config.items.length >= 4}>
        <Plus size={14} aria-hidden="true" /> Agregar foto ({config.items.length}/4)
      </Button>
    </div>
  )
}

function CollectionGridForm({ config, onChange }: { config: CollectionGridConfig; onChange: (c: CollectionGridConfig) => void }) {
  const [options, setOptions] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    fetch('/api/collections')
      .then(r => r.ok ? r.json() : { collections: [] })
      .then((data: { collections: { id: number; name: string }[] }) => setOptions(data.collections ?? []))
      .catch(() => {})
  }, [])

  return (
    <div className={styles.formFields}>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="ls-collection-select">Colección</label>
        <select
          id="ls-collection-select"
          className={styles.select}
          value={config.collection_id || ''}
          onChange={e => onChange({ ...config, collection_id: Number(e.target.value) })}
        >
          <option value="" disabled>Elige una colección…</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {options.length === 0 && (
        <p className={styles.pageSubtitle}>
          No hay colecciones creadas todavía — creá una en la pestaña "Colecciones" primero.
        </p>
      )}
    </div>
  )
}

function StoryForm({ config, onChange }: { config: StoryConfig; onChange: (c: StoryConfig) => void }) {
  return (
    <div className={styles.formFields}>
      <Input label="Etiqueta pequeña" value={config.eyebrow} onChange={e => onChange({ ...config, eyebrow: e.target.value })} placeholder="NUESTRA HISTORIA" maxLength={60} />
      <Input label="Título" value={config.title} onChange={e => onChange({ ...config, title: e.target.value })} maxLength={120} />
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="story-body">Historia</label>
        <textarea
          id="story-body"
          className={styles.textarea}
          value={config.body}
          onChange={e => onChange({ ...config, body: e.target.value })}
          maxLength={2000}
          rows={6}
        />
      </div>
      <ImageField label="Foto" value={config.image_url} onChange={v => onChange({ ...config, image_url: v })} />
    </div>
  )
}
