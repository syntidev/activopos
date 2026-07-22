'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Sparkles, ImageIcon, Check, RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { BLOG_CATEGORIES } from './constants'
import styles from './blog-admin.module.css'

interface AiArticle {
  titulo:            string
  slug:              string
  excerpt:           string
  content:           string
  meta_title:        string
  meta_description:  string
  tags:              string[]
  read_time:         string
}

interface ImagePromptResponse {
  personaje: string
  lugar:     string
  accion:    string
  nicho:     string
  error:     string
}

interface ImageResponse {
  url:   string
  error: string
}

interface GenerateAiModalProps {
  open:     boolean
  onClose:  () => void
  onSaved:  () => void
}

export function GenerateAiModal({ open, onClose, onSaved }: GenerateAiModalProps) {
  const [tema, setTema]           = useState('')
  const [categoria, setCategoria] = useState<string>(BLOG_CATEGORIES[0])
  const [categories, setCategories] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [article, setArticle]     = useState<AiArticle | null>(null)

  // Paso 2 — imagen destacada. `accepted` separa "generada y en preview" de
  // "aceptada por el editor": solo la aceptada viaja en el payload de guardado.
  // Dirección de escena (personaje/lugar/acción), mismo contrato que los presets
  // de social. Editables por separado: es lo que hace que la foto ilustre el
  // artículo en vez de salir genérica.
  const [personaje, setPersonaje] = useState('')
  const [lugar, setLugar]         = useState('')
  const [accion, setAccion]       = useState('')
  const [imageNicho, setImageNicho]       = useState('pyme venezolana')
  const [promptLoading, setPromptLoading] = useState(false)
  const [imageLoading, setImageLoading]   = useState(false)
  const [imageUrl, setImageUrl]           = useState<string | null>(null)
  const [imageAccepted, setImageAccepted] = useState(false)
  const [imageError, setImageError]       = useState<string | null>(null)

  // El modal nunca se desmonta (page.tsx lo deja montado y solo alterna `open`),
  // así que un fetch lento sigue vivo tras cerrar/descartar y su respuesta
  // pisaría estado ya reseteado. Cada corrida toma un id; al resolver, se
  // descarta si ya no es la corrida vigente.
  const runId = useRef(0)

  useEffect(() => {
    if (!open) return
    fetch('/api/admin/blog/categories')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((body: { categories: string[] }) => setCategories(body.categories ?? []))
      .catch(() => {})
  }, [open])

  function reset() {
    runId.current += 1 // invalida cualquier respuesta en vuelo
    setTema('')
    setCategoria(BLOG_CATEGORIES[0])
    setArticle(null)
    setError(null)
    setPersonaje('')
    setLugar('')
    setAccion('')
    setImageNicho('pyme venezolana')
    setImageUrl(null)
    setImageAccepted(false)
    setImageError(null)
  }

  // Se dispara solo al aparecer el artículo (efecto de abajo). El fallo acá no
  // rompe el flujo: el editor puede escribir su propio prompt o guardar sin imagen.
  const fetchImagePrompt = useCallback(async (a: AiArticle) => {
    const myRun = runId.current
    setImageError(null)
    setPromptLoading(true)
    try {
      const res = await fetch('/api/admin/blog/generate-image-prompt', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          titulo: a.titulo, excerpt: a.excerpt, content: a.content, categoria,
        }),
      })
      const body = await res.json() as Partial<ImagePromptResponse>
      if (myRun !== runId.current) return
      if (!res.ok) {
        setImageError(body.error ?? 'No se pudo sugerir una dirección de escena.')
        return
      }
      if (!body.personaje || !body.lugar || !body.accion) {
        setImageError('El servidor no devolvió una dirección de escena válida.')
        return
      }
      setPersonaje(body.personaje)
      setLugar(body.lugar)
      setAccion(body.accion)
      setImageNicho(body.nicho || 'pyme venezolana')
    } catch {
      if (myRun === runId.current) setImageError('Error de red al sugerir el prompt de imagen.')
    } finally {
      if (myRun === runId.current) setPromptLoading(false)
    }
  }, [categoria])

  useEffect(() => {
    if (article) void fetchImagePrompt(article)
  }, [article, fetchImagePrompt])

  const sceneReady = personaje.trim() && lugar.trim() && accion.trim()

  async function handleGenerateImage() {
    if (!sceneReady) return
    const myRun = runId.current
    setImageError(null)
    setImageLoading(true)
    // Regenerar invalida la aceptación previa: lo aceptado debe ser lo visible.
    setImageAccepted(false)
    try {
      const res = await fetch('/api/admin/blog/generate-image', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ personaje, lugar, accion, nicho: imageNicho }),
      })
      const body = await res.json() as Partial<ImageResponse>
      if (myRun !== runId.current) return
      if (!res.ok) {
        setImageError(body.error ?? 'No se pudo generar la imagen.')
        return
      }
      if (typeof body.url !== 'string') {
        setImageError('El servidor no devolvió una imagen válida.')
        return
      }
      setImageUrl(body.url)
    } catch {
      if (myRun === runId.current) setImageError('Error de red al generar la imagen.')
    } finally {
      if (myRun === runId.current) setImageLoading(false)
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleGenerate() {
    const myRun = runId.current
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/blog/generate-ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tema, categoria }),
      })
      const body = await res.json() as { article?: AiArticle; error?: string }
      // Sin este guard una respuesta tardía resucita un artículo ya descartado.
      if (myRun !== runId.current) return
      if (!res.ok || !body.article) {
        setError(body.error ?? 'No se pudo generar el artículo.')
        return
      }
      setArticle(body.article)
    } catch {
      if (myRun === runId.current) setError('Error de red al generar el artículo.')
    } finally {
      if (myRun === runId.current) setGenerating(false)
    }
  }

  async function handleSaveDraft() {
    if (!article) return
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/blog', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:             article.titulo,
          slug:              article.slug,
          excerpt:           article.excerpt,
          content:           article.content,
          category:          categoria,
          tags:              article.tags,
          read_time:         article.read_time,
          meta_title:        article.meta_title,
          meta_description:  article.meta_description,
          // Solo la imagen aceptada explícitamente. Sin imagen el guardado sigue
          // funcionando igual que antes — el paso es opcional, no bloquea.
          featured_image:    imageAccepted ? imageUrl : null,
          status:            'draft',
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'No se pudo guardar el borrador.')
        return
      }
      reset()
      onSaved()
    } catch {
      setError('Error de red al guardar el borrador.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Generar post con IA" size="lg">
      <div className={styles.aiForm}>
        {!article && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ai-tema">Tema</label>
              <textarea
                id="ai-tema"
                className={styles.textarea}
                value={tema}
                onChange={e => setTema(e.target.value)}
                placeholder="Ej: cómo evitar pérdidas por descuadre de caja en un abasto"
                maxLength={200}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ai-categoria">Categoría</label>
              <input
                id="ai-categoria"
                className={styles.input}
                list="blog-categories"
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                placeholder="Ej: Catálogo digital, Marketing..."
                maxLength={80}
              />
              <datalist id="blog-categories">
                {/* Siempre las categorías fijas + las que ya existan en la DB
                    (custom manuales), sin duplicados. Antes solo mostraba las de
                    la DB, así que con un solo post salía una sola opción. */}
                {Array.from(new Set<string>([...BLOG_CATEGORIES, ...categories])).map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            {generating && (
              <div className={styles.loadingRow}>
                <Loader2 size={16} className={styles.spin} aria-hidden="true" />
                Generando artículo...
              </div>
            )}

            <div className={styles.formActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void handleGenerate()}
                disabled={generating || !tema.trim()}
              >
                <Sparkles size={14} aria-hidden="true" />
                {generating ? 'Generando...' : 'Generar'}
              </button>
            </div>
          </>
        )}

        {article && (
          <>
            <div className={styles.aiPreview}>
              <p className={styles.aiPreviewTitle}>{article.titulo}</p>
              <p className={styles.aiPreviewMeta}>/{article.slug} · {article.read_time}</p>
              <p className={styles.aiPreviewExcerpt}>{article.excerpt}</p>
              <div className={styles.aiTagsRow}>
                {article.tags.map(t => <span key={t} className={styles.aiTag}>{t}</span>)}
              </div>
              <p className={styles.aiPreviewContent}>{article.content.replace(/<[^>]+>/g, ' ').trim()}</p>
            </div>

            <div className={styles.aiImageStep}>
              <p className={styles.aiStepTitle}>
                <ImageIcon size={13} aria-hidden="true" />
                Imagen destacada
                <span className={styles.aiStepOptional}>opcional</span>
              </p>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-personaje">Personaje</label>
                <textarea
                  id="ai-personaje"
                  className={styles.textareaSm}
                  value={personaje}
                  onChange={e => setPersonaje(e.target.value)}
                  placeholder={promptLoading ? 'Dirigiendo escena...' : 'dueña de bodega, mujer, mestiza, 40 años, delantal'}
                  disabled={promptLoading}
                  maxLength={300}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-lugar">Lugar</label>
                <textarea
                  id="ai-lugar"
                  className={styles.textareaSm}
                  value={lugar}
                  onChange={e => setLugar(e.target.value)}
                  placeholder="detrás del mostrador, luz de mañana entrando por la puerta"
                  disabled={promptLoading}
                  maxLength={300}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-accion">
                  Acción <span className={styles.labelHint}>lo que ilustra el artículo</span>
                </label>
                <textarea
                  id="ai-accion"
                  className={styles.textareaSm}
                  value={accion}
                  onChange={e => setAccion(e.target.value)}
                  placeholder="ajustando la etiqueta de precio de un estante"
                  disabled={promptLoading}
                  maxLength={300}
                />
              </div>

              {promptLoading && (
                <div className={styles.loadingRow}>
                  <Loader2 size={16} className={styles.spin} aria-hidden="true" />
                  Dirigiendo la escena desde el artículo...
                </div>
              )}

              {imageLoading && (
                <div className={styles.loadingRow}>
                  <Loader2 size={16} className={styles.spin} aria-hidden="true" />
                  Generando imagen... (~10s)
                </div>
              )}

              {imageError && <p className={styles.errorText}>{imageError}</p>}

              {imageUrl && !imageLoading && (
                <div className={styles.aiImagePreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Imagen destacada generada" className={styles.aiImageThumb} />
                  {imageAccepted && (
                    <span className={styles.aiImageBadge}>
                      <Check size={12} aria-hidden="true" />
                      Se guardará con el post
                    </span>
                  )}
                </div>
              )}

              <div className={styles.formActions}>
                {!imageUrl && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => void handleGenerateImage()}
                    disabled={imageLoading || promptLoading || !sceneReady}
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    {imageLoading ? 'Generando...' : 'Generar imagen'}
                  </button>
                )}

                {imageUrl && !imageAccepted && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => setImageAccepted(true)}
                    disabled={imageLoading}
                  >
                    <Check size={14} aria-hidden="true" />
                    Usar esta imagen
                  </button>
                )}

                {imageUrl && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => void handleGenerateImage()}
                    disabled={imageLoading || !sceneReady}
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    Regenerar
                  </button>
                )}
              </div>
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <div className={styles.formActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void handleSaveDraft()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar como borrador'}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={reset}
                disabled={saving}
              >
                Descartar
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
