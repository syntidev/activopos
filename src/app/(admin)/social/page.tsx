'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Loader2, Image as ImageIcon, Layers, Smartphone, Copy, Check, CalendarDays, Send } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { CalendarTab } from './CalendarTab'
import adminStyles from '../admin.module.css'
import styles from './social.module.css'

type Channel = 'instagram' | 'facebook'

type Tipo   = 'post' | 'story' | 'carrusel'
type Estado = 'pendiente' | 'generado' | 'publicado' | 'error'

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

interface StylePresetOption {
  id:       number
  name:     string
  business: { name: string }
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
  const [stylePresetId, setStylePresetId] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [post, setPost]       = useState<SocialPost | null>(null)
  const [copied, setCopied]   = useState(false)
  const [history, setHistory] = useState<SocialPost[]>([])
  const [segments, setSegments]         = useState<SegmentOption[]>([])
  const [stylePresets, setStylePresets] = useState<StylePresetOption[]>([])

  // Publicación (Fase E → Buffer)
  const [pubOpen, setPubOpen]         = useState(false)
  const [pubChannels, setPubChannels] = useState<Channel[]>(['instagram'])
  const [pubDueAt, setPubDueAt]       = useState('')
  const [publishing, setPublishing]   = useState(false)
  const [pubError, setPubError]       = useState<string | null>(null)
  const [pubOk, setPubOk]             = useState<string | null>(null)

  const loadHistory = useCallback(() => {
    fetch('/api/admin/social')
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((body: { posts: SocialPost[] }) => setHistory(body.posts ?? []))
      .catch(() => {})
  }, [])

  useEffect(loadHistory, [loadHistory])

  // Segmentos (marketing) y presets de estilo -- listas de solo-lectura, se piden una vez.
  useEffect(() => {
    fetch('/api/marketing/segments')
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((data: SegmentOption[]) => setSegments(data))
      .catch(() => {})
    fetch('/api/admin/social/style-presets')
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((body: { presets: StylePresetOption[] }) => setStylePresets(body.presets ?? []))
      .catch(() => {})
  }, [])

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

    try {
      const res = await fetch('/api/admin/social/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tipo,
          nicho:    nicho.trim(),
          objetivo: objetivo.trim(),
          ...(gancho.trim() ? { gancho: gancho.trim() } : {}),
          ...(beneficio.trim() ? { beneficio: beneficio.trim() } : {}),
          ...(tipo === 'carrusel' ? { slides } : {}),
          ...(tipo === 'carrusel' && segmentSlug ? { segment_slug: segmentSlug } : {}),
          ...(stylePresetId ? { style_preset_id: Number(stylePresetId) } : {}),
        }),
      })

      const body = await res.json() as { ok?: boolean; post?: SocialPost; error?: string }
      if (!res.ok || !body.post) throw new Error(body.error ?? 'Falló la generación')

      setPost(body.post)
      loadHistory()
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

      {tab === 'calendario' && <CalendarTab />}

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
              <label className={styles.label} htmlFor="preset">Estilo</label>
              <select
                id="preset"
                className={styles.select}
                value={stylePresetId}
                onChange={e => setStylePresetId(e.target.value)}
                disabled={loading}
              >
                <option value="">Diseño default</option>
                {stylePresets.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.business.name})</option>
                ))}
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
              <div className={styles.slides}>
                {post.assets.map(asset => (
                  <figure key={asset.id} className={styles.slide}>
                    {post.assets.length > 1 && (
                      <span className={styles.slideIndex}>{asset.orden + 1}</span>
                    )}
                    {/* next/image no aporta aquí: son piezas recién generadas, de un solo uso,
                        y sharp ya las entregó optimizadas. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.slideImg}
                      src={asset.imagen_url}
                      alt={asset.titulo ?? `Slide ${asset.orden + 1}`}
                    />
                  </figure>
                ))}
              </div>

              <div className={styles.captionBox}>
                <p className={styles.caption}>{post.caption}</p>
                {!!post.hashtags?.length && (
                  <p className={styles.hashtags}>
                    {post.hashtags.map(h => `#${h}`).join(' ')}
                  </p>
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
            </>
          )}
        </section>
      </div>

      <section className={styles.history}>
        <h2 className={adminStyles.sectionTitle}>Generados</h2>

        {history.length === 0 ? (
          <p className={adminStyles.emptyState}>Todavía no has generado ninguna pieza.</p>
        ) : (
          <ul className={styles.historyGrid} role="list">
            {history.map(item => (
              <li key={item.id}>
                {/* Click = cargar la pieza en el lienzo de arriba, que ya sabe mostrarla
                    completa y copiar su caption. No hace falta una vista aparte. */}
                <button
                  type="button"
                  className={`${styles.card} ${post?.id === item.id ? styles.cardActive : ''}`}
                  onClick={() => { setPost(item); setCopied(false) }}
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
