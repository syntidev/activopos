'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
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

interface GenerateAiModalProps {
  open:     boolean
  onClose:  () => void
  onSaved:  () => void
}

export function GenerateAiModal({ open, onClose, onSaved }: GenerateAiModalProps) {
  const [tema, setTema]           = useState('')
  const [categoria, setCategoria] = useState<string>(BLOG_CATEGORIES[0])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [article, setArticle]     = useState<AiArticle | null>(null)

  function reset() {
    setTema('')
    setCategoria(BLOG_CATEGORIES[0])
    setArticle(null)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/blog/generate-ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tema, categoria }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'No se pudo generar el artículo.')
        return
      }
      setArticle(body.article as AiArticle)
    } catch {
      setError('Error de red al generar el artículo.')
    } finally {
      setGenerating(false)
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
    <div data-theme="dark">
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
                <select
                  id="ai-categoria"
                  className={styles.select}
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                >
                  {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
    </div>
  )
}
