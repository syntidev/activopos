'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Loader2, Image as ImageIcon, Layers, Smartphone, Copy, Check, CalendarDays, Send, Trash2, BookmarkPlus, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { CalendarTab } from './CalendarTab'
import { MobilePreview } from './MobilePreview'
import { SocialEditor } from './SocialEditor'
import adminStyles from '../admin.module.css'
import styles from './social.module.css'

type Channel = 'instagram' | 'facebook'

type Tipo   = 'post' | 'story' | 'carrusel'
type Estado = 'pendiente' | 'generado' | 'publicado' | 'error'
type Aspect = '1:1' | '4:5' | '3:4' | '9:16'
type CarouselMode = 'geometric' | 'human' | 'hybrid'

// Solo post y carrusel dejan elegir dimensión -- story se fija a 9:16 automáticamente
// (ver STORY_ASPECT más abajo), no tiene sentido mostrarla como opción aquí.
const POST_ASPECTS: { value: Aspect; label: string; hint: string }[] = [
  { value: '1:1', label: '1:1', hint: '1080×1080 — cuadrado' },
  { value: '4:5', label: '4:5', hint: '1080×1350 — vertical clásico' },
  { value: '3:4', label: '3:4', hint: '1080×1440 — vertical nuevo' },
]

const STORY_ASPECT: Aspect = '9:16'
const DEFAULT_POST_ASPECT: Aspect = '4:5'

// Presets de color del motor de imagen (gemini-image.ts). '' = automático, deja
// que el sistema elija por rol de slide. El swatch es solo indicativo del fondo.
const PRESET_OPTIONS: { value: string; label: string; swatch: string; desc: string }[] = [
  { value: '',              label: 'Automático',    swatch: 'linear-gradient(135deg, #0D1B2E, #0038BD, #EF8E01)', desc: 'El sistema elige' },
  { value: 'NAVY_TECH',     label: 'Navy Tech',     swatch: '#0D1B2E', desc: 'Profesional, energía SaaS' },
  { value: 'SKY_LIGHT',     label: 'Sky Light',     swatch: '#7AA2FF', desc: 'Fresco, luz de día' },
  { value: 'WARM_SAND',     label: 'Warm Sand',     swatch: '#E8D3A8', desc: 'Cálido, sol venezolano' },
  { value: 'VIBRANT_AMBER', label: 'Vibrant Amber', swatch: '#EF8E01', desc: 'Alta energía, impacto' },
  { value: 'CLEAN_WHITE',   label: 'Clean White',   swatch: '#FFFFFF', desc: 'Minimal, editorial' },
  { value: 'PURPLE_TECH',   label: 'Purple Tech',   swatch: '#7C3AED', desc: 'Moderno, innovación premium' },
  { value: 'MINT_FRESH',    label: 'Mint Fresh',    swatch: '#2DD4BF', desc: 'Fresco, confiable, calma' },
]

// Estructural (no importado de CalendarTab.tsx): CalendarEntry ahí ya trae todos estos
// campos, no hace falta acoplar los dos archivos por un tipo compartido.
interface CalendarEntryBrief {
  id:        number
  tipo:      string
  segmento:  string
  objetivo:  string
  titulo:    string
  subtitulo: string | null
}

interface SocialAsset {
  id:         number
  orden:      number
  imagen_url: string
  titulo:     string | null
  subtitulo:  string | null
}

interface SegmentOption {
  slug: string
  name: string
}

interface ScenePresetOption {
  id:        number
  name:      string
  personaje: string | null
  escena:    string | null
  accion:    string | null
}

interface SocialPost {
  id:             number
  tipo:           Tipo
  nicho:          string | null
  titulo:         string
  estado:         Estado
  imagen_url:     string | null
  caption:        string | null
  hashtags:       string[] | null
  content_engine: string | null
  created_at:     string
  assets:         SocialAsset[]
}

// Copy estratégico (Fase C) — transitorio, viene en la respuesta de generate.
interface Strategy {
  hook:     string
  cuerpo:   string
  cta:      string
  pregunta: string
  hashtags: string[]
  caption:  string
  metadata: { horarioSugerido: string; objetivo: string; seoKeywords: string[]; tipoAds: string }
  notaCreador: string
}

const TIPOS: { value: Tipo; label: string; icon: typeof ImageIcon }[] = [
  { value: 'post',     label: 'Post',     icon: ImageIcon  },
  { value: 'story',    label: 'Story',    icon: Smartphone },
  { value: 'carrusel', label: 'Carrusel', icon: Layers     },
]

const ESTADO_BADGE: Record<Estado, string> = {
  generado:  adminStyles.badgeActive,
  publicado: adminStyles.badgeInfo,
  pendiente: adminStyles.badgeTrial,
  error:     adminStyles.badgeDanger,
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function SocialPage() {
  const [tab, setTab]             = useState<'generador' | 'calendario'>('generador')
  const [tipo, setTipo]           = useState<Tipo>('post')
  const [nicho, setNicho]         = useState('')
  const [gancho, setGancho]       = useState('')
  const [beneficio, setBeneficio] = useState('')
  const [objetivo, setObjetivo]   = useState('')
  const [slides, setSlides]       = useState(4)
  const [segmentSlug, setSegmentSlug]     = useState('')
  const [carouselMode, setCarouselMode] = useState<CarouselMode>('geometric')
  const [aspect, setAspect]     = useState<Aspect>(DEFAULT_POST_ASPECT)
  const [preset, setPreset]       = useState('')
  // Fondos crudos que devuelve generate, para el editor de capas (Fase B).
  const [bgUrls, setBgUrls]       = useState<string[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  // Copy estratégico (Fase C) — desglose por secciones + metadata.
  const [strategy, setStrategy]   = useState<Strategy | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [personaje, setPersonaje] = useState('')
  const [lugar, setLugar]         = useState('')
  const [accion, setAccion]       = useState('')
  const [scenePresets, setScenePresets]   = useState<ScenePresetOption[]>([])
  const [scenePresetId, setScenePresetId] = useState('')
  const [savingScenePreset, setSavingScenePreset] = useState(false)
  const [linkedCalendarEntryId, setLinkedCalendarEntryId] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [post, setPost]       = useState<SocialPost | null>(null)
  const [copied, setCopied]   = useState(false)
  const [history, setHistory] = useState<SocialPost[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [historyEstado, setHistoryEstado]   = useState<Estado | ''>('')
  const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set())
  const [deletingId, setDeletingId]         = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting]     = useState(false)
  const [segments, setSegments]         = useState<SegmentOption[]>([])

  // Publicación (Fase E → Buffer)
  const [pubOpen, setPubOpen]         = useState(false)
  const [pubChannels, setPubChannels] = useState<Channel[]>(['instagram'])
  const [pubDueAt, setPubDueAt]       = useState('')
  const [publishing, setPublishing]   = useState(false)
  const [pubError, setPubError]       = useState<string | null>(null)
  const [pubOk, setPubOk]             = useState<string | null>(null)

  const loadHistory = useCallback(() => {
    const qs = historyEstado ? `?estado=${historyEstado}` : ''
    fetch(`/api/admin/social${qs}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((body: { posts: SocialPost[] }) => setHistory(body.posts ?? []))
      .catch(() => {})
  }, [historyEstado])

  useEffect(loadHistory, [loadHistory])

  // El filtro por estado cambia el conjunto visible -- una selección vieja podría
  // apuntar a piezas que ya no están en pantalla.
  useEffect(() => { setSelectedIds(new Set()) }, [historyEstado])

  // Nueva pieza cargada (generada o desde el historial) -- vuelve a mostrar el primer slide.
  useEffect(() => { setActiveIdx(0) }, [post?.id])

  // Story se fija a 9:16 automáticamente -- el usuario no elige acá. Al volver a
  // post/carrusel, si quedó 9:16 (heredado de story) cae al default de feed.
  useEffect(() => {
    if (tipo === 'story') setAspect(STORY_ASPECT)
    else setAspect(prev => (prev === STORY_ASPECT ? DEFAULT_POST_ASPECT : prev))
  }, [tipo])

  // Segmentos (marketing) y presets de estilo -- listas de solo-lectura, se piden una vez.
  useEffect(() => {
    fetch('/api/marketing/segments')
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((data: SegmentOption[]) => setSegments(data))
      .catch(() => {})
  }, [])

  const loadScenePresets = useCallback(() => {
    fetch('/api/admin/social/scene-presets')
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((body: { presets: ScenePresetOption[] }) => setScenePresets(body.presets ?? []))
      .catch(() => {})
  }, [])

  useEffect(loadScenePresets, [loadScenePresets])

  // Cada imagen tarda ~10s en NVIDIA NIM. Un carrusel de 4 son ~40s de espera,
  // así que la UI dice cuánto falta en vez de dejar al usuario adivinando.
  const imageCount  = tipo === 'carrusel' ? slides : 1
  const etaSegundos = imageCount * 10
  // El segmento real (segment_slug) solo sustituye al gancho en carrusel -- el backend
  // (bodySchema.refine en generate/route.ts) rechaza segment_slug para post/story.
  const ganchoSatisfecho = tipo === 'carrusel' ? (!!gancho.trim() || !!segmentSlug) : !!gancho.trim()
  const canSubmit = !!nicho.trim() && ganchoSatisfecho && !!objetivo.trim() && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setPost(null)
    setStrategy(null)
    setBgUrls([])

    try {
      const res = await fetch('/api/admin/social/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tipo,
          nicho:    nicho.trim(),
          objetivo: objetivo.trim(),
          aspect,
          ...(gancho.trim() ? { gancho: gancho.trim() } : {}),
          ...(beneficio.trim() ? { beneficio: beneficio.trim() } : {}),
          ...(tipo === 'carrusel' ? { slides, carouselMode } : {}),
          ...(tipo === 'carrusel' && segmentSlug ? { segment_slug: segmentSlug } : {}),
          // Dirección de escena real (PIEZA 1) -- solo aplica al motor de difusión.
          ...(tipo !== 'carrusel' && preset ? { preset } : {}),
          ...(tipo !== 'carrusel' && personaje.trim() ? { personaje: personaje.trim() } : {}),
          ...(tipo !== 'carrusel' && lugar.trim()     ? { lugar: lugar.trim() }         : {}),
          ...(tipo !== 'carrusel' && accion.trim()    ? { accion: accion.trim() }       : {}),
        }),
      })

      const body = await res.json() as { ok?: boolean; post?: SocialPost; error?: string; background_urls?: string[]; strategy?: Strategy | null }
      if (!res.ok || !body.post) throw new Error(body.error ?? 'Falló la generación')

      setPost(body.post)
      setBgUrls(body.background_urls ?? [])
      setStrategy(body.strategy ?? null)
      loadHistory()

      // Puente Calendario -> Generador (PIEZA 1, punto 4): si esta generación vino de
      // "Usar" en una entrada del calendario, se vincula de vuelta -- pendiente -> generado.
      if (linkedCalendarEntryId) {
        const linkId = linkedCalendarEntryId
        setLinkedCalendarEntryId(null)
        try {
          const linkRes = await fetch(`/api/admin/social/calendar/${linkId}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              estado:         'generado',
              social_post_id: body.post.id,
              ...(body.post.content_engine ? { content_engine: body.post.content_engine } : {}),
            }),
          })
          if (!linkRes.ok) throw new Error()
        } catch {
          setError('Se generó la pieza, pero no se pudo vincular con la entrada del calendario.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      // El endpoint deja la fila en estado 'error' aunque falle: el historial debe mostrarla.
      loadHistory()
    } finally {
      setLoading(false)
    }
  }

  async function copyCaption() {
    if (!post) return
    const hashtags = post.hashtags?.map(h => `#${h}`).join(' ') ?? ''
    await navigator.clipboard.writeText(`${post.caption ?? ''}\n\n${hashtags}`.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Copia un texto y marca cuál sección se copió, para el feedback por botón.
  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2000)
  }

  function openPublish() {
    setPubChannels(['instagram'])
    setPubDueAt('')
    setPubError(null)
    setPubOk(null)
    setPubOpen(true)
  }

  function toggleChannel(ch: Channel) {
    setPubChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  async function handlePublish() {
    if (!post || pubChannels.length === 0) return
    setPublishing(true)
    setPubError(null)
    setPubOk(null)
    try {
      const res = await fetch('/api/admin/social/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          social_post_id: post.id,
          channels:       pubChannels,
          // datetime-local es hora local; se convierte a ISO UTC para Buffer.
          ...(pubDueAt ? { due_at: new Date(pubDueAt).toISOString() } : {}),
        }),
      })
      const body = await res.json() as { error?: string; status?: string }
      if (!res.ok) throw new Error(body.error ?? 'Falló la publicación')
      setPubOk(pubDueAt ? 'Programado en Buffer.' : 'Enviado a la cola de Buffer.')
      loadHistory()
      setTimeout(() => setPubOpen(false), 1600)
    } catch (err) {
      setPubError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDeleteOne(id: number, titulo: string) {
    if (!confirm(`¿Eliminar "${titulo}"? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/social/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      if (post?.id === id) setPost(null)
      loadHistory()
    } catch {
      setError('No se pudo eliminar la pieza.')
    } finally {
      setDeletingId(null)
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`¿Eliminar ${selectedIds.size} pieza${selectedIds.size === 1 ? '' : 's'} seleccionada${selectedIds.size === 1 ? '' : 's'}? Esta acción no se puede deshacer.`)) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/admin/social', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error()
      if (post && selectedIds.has(post.id)) setPost(null)
      setSelectedIds(new Set())
      loadHistory()
    } catch {
      setError('No se pudieron eliminar las piezas seleccionadas.')
    } finally {
      setBulkDeleting(false)
    }
  }

  // El campo "tipo" del calendario es texto libre (import de Excel, edición manual) --
  // nunca el enum estricto del generador. Coincide por substring, no exacto.
  function detectTipoFromCalendar(raw: string): Tipo {
    const t = raw.trim().toLowerCase()
    if (t.includes('carrus')) return 'carrusel'
    if (t.includes('story') || t.includes('historia')) return 'story'
    return 'post'
  }

  function handleUseCalendarEntry(entry: CalendarEntryBrief) {
    setTipo(detectTipoFromCalendar(entry.tipo))
    setNicho(entry.segmento)
    setGancho(entry.titulo)
    setBeneficio(entry.subtitulo ?? '')
    setObjetivo(entry.objetivo)
    setLinkedCalendarEntryId(entry.id)
    setPost(null)
    setError(null)
    setTab('generador')
  }

  // Cada segmento agrupa >=1 variantes de personaje bajo el mismo `name` (mismo género/
  // fenotipo repetido siempre se sentía forzado -- Carlos pidió variación real). Se elige
  // una al azar cada vez que se selecciona el segmento, no siempre la misma.
  function applyScenePreset(name: string) {
    setScenePresetId(name)
    const variants = scenePresets.filter(p => p.name === name)
    if (!variants.length) return
    const preset = variants[Math.floor(Math.random() * variants.length)]
    setPersonaje(preset.personaje ?? '')
    setLugar(preset.escena ?? '')
    setAccion(preset.accion ?? '')
  }

  async function handleSaveScenePreset() {
    if (!personaje.trim() && !lugar.trim() && !accion.trim()) return
    const name = prompt('Nombre del preset (ej. "Dueña de bodega, mañana")')?.trim()
    if (!name) return
    setSavingScenePreset(true)
    try {
      const res = await fetch('/api/admin/social/scene-presets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          ...(personaje.trim() ? { personaje: personaje.trim() } : {}),
          ...(lugar.trim()     ? { escena: lugar.trim() }         : {}),
          ...(accion.trim()    ? { accion: accion.trim() }        : {}),
        }),
      })
      if (!res.ok) throw new Error()
      loadScenePresets()
    } catch {
      setError('No se pudo guardar el preset.')
    } finally {
      setSavingScenePreset(false)
    }
  }

  return (
    <>
      <header className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Contenido Social</h1>
        <p className={adminStyles.pageSubtitle}>
          Genera posts, stories y carruseles de Instagram con la marca ActivoPOS.
        </p>
      </header>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'generador'}
          className={`${styles.tabBtn} ${tab === 'generador' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('generador')}
        >
          <Sparkles size={15} aria-hidden="true" /> Generador
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'calendario'}
          className={`${styles.tabBtn} ${tab === 'calendario' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('calendario')}
        >
          <CalendarDays size={15} aria-hidden="true" /> Calendario
        </button>
      </div>

      {tab === 'calendario' && <CalendarTab onUseEntry={handleUseCalendarEntry} />}

      {tab === 'generador' && (
      <>
      <div className={styles.layout}>
        <form className={styles.form} onSubmit={e => void handleSubmit(e)}>
          <div className={styles.field}>
            <span className={styles.label}>Formato</span>
            <div className={styles.typeGroup} role="group" aria-label="Formato de la pieza">
              {TIPOS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.typeBtn} ${tipo === value ? styles.typeBtnActive : ''}`}
                  onClick={() => setTipo(value)}
                  disabled={loading}
                  aria-pressed={tipo === value}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Formato de salida</span>
            {tipo === 'story' ? (
              <p className={styles.hint}>9:16 — 1080×1920 (automático para story)</p>
            ) : (
              <div className={styles.typeGroup} role="group" aria-label="Dimensión de la imagen">
                {POST_ASPECTS.map(({ value, label, hint }) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.typeBtn} ${aspect === value ? styles.typeBtnActive : ''}`}
                    onClick={() => setAspect(value)}
                    disabled={loading}
                    aria-pressed={aspect === value}
                    title={hint}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {tipo !== 'carrusel' && (
            <div className={styles.field}>
              <span className={styles.label}>Estilo visual</span>
              <div className={styles.presetGroup} role="group" aria-label="Preset de color">
                {PRESET_OPTIONS.map(({ value, label, swatch, desc }) => (
                  <button
                    key={value || 'auto'}
                    type="button"
                    className={`${styles.presetCard} ${preset === value ? styles.presetCardActive : ''}`}
                    onClick={() => setPreset(value)}
                    disabled={loading}
                    aria-pressed={preset === value}
                  >
                    <span className={styles.presetSwatch} style={{ background: swatch }} aria-hidden="true" />
                    <span className={styles.presetName}>{label}</span>
                    <span className={styles.presetDesc}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipo === 'carrusel' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="slides">Slides</label>
              <select
                id="slides"
                className={styles.select}
                value={slides}
                onChange={e => setSlides(Number(e.target.value))}
                disabled={loading}
              >
                {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} slides</option>)}
              </select>
            </div>
          )}

          {tipo === 'carrusel' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="segmento">Segmento (opcional)</label>
              <select
                id="segmento"
                className={styles.select}
                value={segmentSlug}
                onChange={e => setSegmentSlug(e.target.value)}
                disabled={loading}
              >
                <option value="">Tema libre (usa el Gancho de abajo)</option>
                {segments.map(s => (
                  <option key={s.slug} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {tipo === 'carrusel' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="carouselMode">Estilo</label>
              <select
                id="carouselMode"
                className={styles.select}
                value={carouselMode}
                onChange={e => setCarouselMode(e.target.value as CarouselMode)}
                disabled={loading}
              >
                <option value="geometric">Geométrico</option>
                <option value="human">Escena Humana</option>
                <option value="hybrid">Híbrido</option>
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="nicho">Nicho</label>
            <input
              id="nicho"
              className={styles.input}
              value={nicho}
              onChange={e => setNicho(e.target.value)}
              placeholder="bodega, boutique, panadería..."
              maxLength={80}
              disabled={loading}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="gancho">
              Gancho{tipo === 'carrusel' && segmentSlug ? ' (opcional -- el segmento ya da el tema)' : ''}
            </label>
            <textarea
              id="gancho"
              className={styles.textarea}
              value={gancho}
              onChange={e => setGancho(e.target.value)}
              placeholder="Cierro la caja y no me cuadra el efectivo"
              maxLength={300}
              disabled={loading}
              required={!(tipo === 'carrusel' && !!segmentSlug)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="beneficio">Beneficio (opcional)</label>
            <input
              id="beneficio"
              className={styles.input}
              value={beneficio}
              onChange={e => setBeneficio(e.target.value)}
              placeholder="Tasa BCV automática"
              maxLength={300}
              disabled={loading}
            />
          </div>

          {tipo !== 'carrusel' && (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="scenePreset">Usar preset guardado</label>
                <select
                  id="scenePreset"
                  className={styles.select}
                  value={scenePresetId}
                  onChange={e => applyScenePreset(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Escribir manualmente</option>
                  {scenePresets
                    .map(p => p.name)
                    .filter((name, i, arr) => arr.indexOf(name) === i)
                    .map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="personaje">Personaje (opcional)</label>
                <input
                  id="personaje"
                  className={styles.input}
                  value={personaje}
                  onChange={e => { setPersonaje(e.target.value); setScenePresetId('') }}
                  placeholder="dueña de bodega, 40 años, delantal"
                  maxLength={200}
                  disabled={loading}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="lugar">Escena / lugar (opcional)</label>
                <input
                  id="lugar"
                  className={styles.input}
                  value={lugar}
                  onChange={e => { setLugar(e.target.value); setScenePresetId('') }}
                  placeholder="detrás del mostrador, luz de mañana"
                  maxLength={200}
                  disabled={loading}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="accion">Acción / motivo (opcional)</label>
                <input
                  id="accion"
                  className={styles.input}
                  value={accion}
                  onChange={e => { setAccion(e.target.value); setScenePresetId('') }}
                  placeholder="contando billetes con alivio"
                  maxLength={200}
                  disabled={loading}
                />
              </div>

              <button
                type="button"
                className={`${adminStyles.actionLink} ${adminStyles.actionBtn}`}
                onClick={() => void handleSaveScenePreset()}
                disabled={savingScenePreset || (!personaje.trim() && !lugar.trim() && !accion.trim())}
              >
                {savingScenePreset
                  ? <Loader2 size={14} className={styles.spin} aria-hidden="true" />
                  : <BookmarkPlus size={14} aria-hidden="true" />}
                Guardar como preset
              </button>
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="objetivo">Objetivo</label>
            <input
              id="objetivo"
              className={styles.input}
              value={objetivo}
              onChange={e => setObjetivo(e.target.value)}
              placeholder="Que prueben ActivoPOS gratis"
              maxLength={120}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
            {loading
              ? <><Loader2 size={16} className={styles.spin} aria-hidden="true" /> Generando…</>
              : <><Sparkles size={16} aria-hidden="true" /> Generar</>}
          </button>

          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>

        <section className={styles.canvas} aria-live="polite">
          {!post && (
            <div className={styles.placeholder}>
              {loading ? (
                <>
                  <Loader2 size={28} className={styles.spin} aria-hidden="true" />
                  <p className={styles.hint}>
                    Escribiendo el copy y generando {imageCount === 1 ? 'la imagen' : `las ${imageCount} imágenes`}.
                    Tarda alrededor de {etaSegundos} segundos — no cierres la pestaña.
                  </p>
                </>
              ) : (
                <>
                  <Sparkles size={28} strokeWidth={1.5} aria-hidden="true" />
                  <p className={styles.hint}>
                    Describe el gancho y el nicho. El copy sale de Gemini, la foto de fondo de
                    NVIDIA, y el overlay se compone con la tipografía real de la marca.
                  </p>
                </>
              )}
            </div>
          )}

          {post && (
            <>
              {/* Mockup de teléfono -- cómo se ve realmente en el feed, antes de publicar
                  (mismo criterio que SlideRenderer de Open Carrusel: contenedor escalado a
                  proporción real, acá con la pieza ya rasterizada en vez de un iframe HTML). */}
              <MobilePreview
                imageUrl={post.assets[activeIdx]?.imagen_url ?? post.imagen_url ?? ''}
                caption={post.caption}
              />

              {post.assets.length > 1 && (
                <div className={styles.slides}>
                  {post.assets.map((asset, i) => (
                    <button
                      key={asset.id}
                      type="button"
                      className={`${styles.slide} ${i === activeIdx ? styles.slideActive : ''}`}
                      onClick={() => setActiveIdx(i)}
                      aria-label={`Ver slide ${asset.orden + 1}`}
                      aria-pressed={i === activeIdx}
                    >
                      <span className={styles.slideIndex}>{asset.orden + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.slideImg}
                        src={asset.imagen_url}
                        alt={asset.titulo ?? `Slide ${asset.orden + 1}`}
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.captionBox}>
                {strategy ? (
                  <div className={styles.strategy}>
                    <div className={styles.stratBadges}>
                      <span className={styles.stratBadge}>🕐 {strategy.metadata.horarioSugerido}</span>
                      <span className={styles.stratBadge}>🎯 {strategy.metadata.objetivo}</span>
                      {strategy.metadata.tipoAds && (
                        <span className={styles.stratBadge}>📣 {strategy.metadata.tipoAds}</span>
                      )}
                    </div>

                    {([
                      { key: 'hook',     label: 'Hook',      text: strategy.hook },
                      { key: 'cuerpo',   label: 'Cuerpo',    text: strategy.cuerpo },
                      { key: 'cta',      label: 'CTA',       text: strategy.cta },
                      { key: 'pregunta', label: 'Pregunta',  text: strategy.pregunta },
                      { key: 'hashtags', label: 'Hashtags',  text: strategy.hashtags.map(h => `#${h}`).join(' ') },
                    ] as const).map(({ key, label, text }) => (
                      <div key={key} className={styles.stratSection}>
                        <div className={styles.stratHead}>
                          <span className={styles.stratLabel}>{label}</span>
                          <button
                            type="button"
                            className={styles.stratCopy}
                            onClick={() => void copyText(text, key)}
                            aria-label={`Copiar ${label}`}
                          >
                            {copiedKey === key
                              ? <><Check size={12} aria-hidden="true" /> Copiado</>
                              : <><Copy size={12} aria-hidden="true" /> Copiar</>}
                          </button>
                        </div>
                        <p className={styles.stratText}>{text}</p>
                      </div>
                    ))}

                    {strategy.metadata.seoKeywords.length > 0 && (
                      <p className={styles.stratSeo}>
                        SEO: {strategy.metadata.seoKeywords.join(' · ')}
                      </p>
                    )}
                    {strategy.notaCreador && (
                      <p className={styles.stratNote}>💡 {strategy.notaCreador}</p>
                    )}

                    <button
                      type="button"
                      className={styles.submitBtn}
                      onClick={() => void copyText(strategy.caption, 'all')}
                    >
                      {copiedKey === 'all'
                        ? <><Check size={14} aria-hidden="true" /> Copiado Todo</>
                        : <><Copy size={14} aria-hidden="true" /> Copiar Todo</>}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className={styles.caption}>{post.caption}</p>
                    {!!post.hashtags?.length && (
                      <p className={styles.hashtags}>
                        {post.hashtags.map(h => `#${h}`).join(' ')}
                      </p>
                    )}
                  </>
                )}
                <div className={styles.captionActions}>
                  <button
                    type="button"
                    className={`${adminStyles.actionLink} ${adminStyles.actionBtn}`}
                    onClick={() => void copyCaption()}
                  >
                    {copied
                      ? <><Check size={14} aria-hidden="true" /> Copiado</>
                      : <><Copy size={14} aria-hidden="true" /> Copiar caption</>}
                  </button>
                  {/* Editor de capas: solo post/story (el carrusel es HTML, no
                      pasa por compose) y solo si generate devolvió el fondo crudo. */}
                  {tipo !== 'carrusel' && bgUrls[activeIdx] && (
                    <button
                      type="button"
                      className={`${adminStyles.actionLink} ${adminStyles.actionBtn}`}
                      onClick={() => setEditorOpen(true)}
                    >
                      <Pencil size={14} aria-hidden="true" /> Editar diseño
                    </button>
                  )}
                  {post.imagen_url && (
                    <button
                      type="button"
                      className={styles.submitBtn}
                      onClick={openPublish}
                    >
                      <Send size={14} aria-hidden="true" /> Publicar
                    </button>
                  )}
                </div>
              </div>

              {editorOpen && bgUrls[activeIdx] && (
                <SocialEditor
                  postId={post.id}
                  titulo={post.assets[activeIdx]?.titulo ?? post.titulo}
                  subtitulo={post.assets[activeIdx]?.subtitulo ?? ''}
                  backgroundUrl={bgUrls[activeIdx]}
                  aspect={aspect}
                  formato={tipo === 'carrusel' ? 'post' : tipo}
                  onClose={() => setEditorOpen(false)}
                  onSealed={(url) => setPost(prev => prev ? { ...prev, imagen_url: url } : prev)}
                />
              )}
            </>
          )}
        </section>
      </div>

      <section className={styles.history}>
        <div className={styles.historyHeader}>
          <h2 className={adminStyles.sectionTitle}>Generados</h2>
          <div className={styles.historyControls}>
            <select
              className={styles.select}
              value={historyEstado}
              onChange={e => setHistoryEstado(e.target.value as Estado | '')}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              {(['generado', 'error', 'pendiente', 'publicado'] as Estado[]).map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            {selectedIds.size > 0 && (
              <button
                type="button"
                className={`${adminStyles.actionLink} ${adminStyles.actionBtn} ${adminStyles.actionDanger}`}
                onClick={() => void handleBulkDelete()}
                disabled={bulkDeleting}
              >
                {bulkDeleting
                  ? <Loader2 size={14} className={styles.spin} aria-hidden="true" />
                  : <Trash2 size={14} aria-hidden="true" />}
                Borrar seleccionados ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <p className={adminStyles.emptyState}>
            {historyEstado ? `Sin piezas en estado "${historyEstado}".` : 'Todavía no has generado ninguna pieza.'}
          </p>
        ) : (
          <ul className={styles.historyGrid} role="list">
            {history.map(item => (
              <li key={item.id} className={styles.historyItem}>
                <input
                  type="checkbox"
                  className={styles.historyCheck}
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  aria-label={`Seleccionar "${item.titulo}"`}
                />
                <button
                  type="button"
                  className={styles.historyDelete}
                  onClick={() => void handleDeleteOne(item.id, item.titulo)}
                  disabled={deletingId === item.id}
                  aria-label={`Eliminar "${item.titulo}"`}
                >
                  {deletingId === item.id
                    ? <Loader2 size={13} className={styles.spin} aria-hidden="true" />
                    : <Trash2 size={13} aria-hidden="true" />}
                </button>

                {/* Click = cargar la pieza en el lienzo de arriba, que ya sabe mostrarla
                    completa y copiar su caption. No hace falta una vista aparte. */}
                <button
                  type="button"
                  className={`${styles.card} ${post?.id === item.id ? styles.cardActive : ''}`}
                  onClick={() => { setPost(item); setStrategy(null); setBgUrls([]); setCopied(false) }}
                  aria-label={`Ver "${item.titulo}"`}
                >
                  <span className={styles.thumb}>
                    {item.imagen_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.imagen_url} alt="" loading="lazy" />
                    ) : (
                      <ImageIcon size={20} strokeWidth={1.5} aria-hidden="true" />
                    )}
                  </span>

                  <span className={styles.cardBody}>
                    <span className={styles.cardTitle}>{item.titulo}</span>
                    <span className={styles.cardMeta}>
                      {formatFecha(item.created_at)}
                      {item.nicho && ` · ${item.nicho}`}
                      {item.tipo === 'carrusel' && ` · ${item.assets.length} slides`}
                    </span>
                    <span className={styles.cardBadges}>
                      <span className={`${adminStyles.badge} ${ESTADO_BADGE[item.estado]}`}>
                        {item.estado}
                      </span>
                      <span className={`${adminStyles.badge} ${adminStyles.badgeInfo}`}>
                        {item.content_engine === 'html_render' ? 'Carrusel HTML' : 'Imagen'}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>
      )}

      <Modal
        open={pubOpen}
        onClose={() => setPubOpen(false)}
        title="Publicar en Buffer"
        footer={
          <>
            <button type="button" className={styles.tabBtn} onClick={() => setPubOpen(false)} disabled={publishing}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => void handlePublish()}
              disabled={publishing || pubChannels.length === 0}
            >
              {publishing
                ? <><Loader2 size={15} className={styles.spin} aria-hidden="true" /> Enviando…</>
                : <><Send size={15} aria-hidden="true" /> Publicar</>}
            </button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.field}>
            <span className={styles.label}>Canales</span>
            <div className={styles.typeGroup} role="group" aria-label="Canales">
              {(['instagram', 'facebook'] as Channel[]).map(ch => (
                <button
                  key={ch}
                  type="button"
                  className={`${styles.typeBtn} ${pubChannels.includes(ch) ? styles.typeBtnActive : ''}`}
                  onClick={() => toggleChannel(ch)}
                  aria-pressed={pubChannels.includes(ch)}
                >
                  {ch === 'instagram' ? 'Instagram' : 'Facebook'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="pub-due">Fecha y hora (opcional)</label>
            <input
              id="pub-due"
              type="datetime-local"
              className={styles.input}
              value={pubDueAt}
              onChange={e => setPubDueAt(e.target.value)}
            />
            <span className={styles.hint}>
              Vacío = se agrega a la cola (próximo slot). Con fecha = programado a esa hora.
            </span>
          </div>

          {pubError && <p className={styles.error} role="alert">{pubError}</p>}
          {pubOk && <p className={styles.hashtags} role="status">{pubOk}</p>}
        </div>
      </Modal>
    </>
  )
}
