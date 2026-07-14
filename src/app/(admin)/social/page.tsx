'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Image as ImageIcon, Layers, Smartphone, Copy, Check } from 'lucide-react'
import adminStyles from '../admin.module.css'
import styles from './social.module.css'

type Tipo = 'post' | 'story' | 'carrusel'

interface SocialAsset {
  id:         number
  orden:      number
  imagen_url: string
  titulo:     string | null
  subtitulo:  string | null
}

interface SocialPost {
  id:       number
  tipo:     Tipo
  caption:  string | null
  hashtags: string[] | null
  assets:   SocialAsset[]
}

const TIPOS: { value: Tipo; label: string; icon: typeof ImageIcon }[] = [
  { value: 'post',     label: 'Post',     icon: ImageIcon  },
  { value: 'story',    label: 'Story',    icon: Smartphone },
  { value: 'carrusel', label: 'Carrusel', icon: Layers     },
]

export default function SocialPage() {
  const [tipo, setTipo]           = useState<Tipo>('post')
  const [nicho, setNicho]         = useState('')
  const [gancho, setGancho]       = useState('')
  const [beneficio, setBeneficio] = useState('')
  const [objetivo, setObjetivo]   = useState('')
  const [slides, setSlides]       = useState(4)

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [post, setPost]       = useState<SocialPost | null>(null)
  const [copied, setCopied]   = useState(false)

  // Cada imagen tarda ~10s en NVIDIA NIM. Un carrusel de 4 son ~40s de espera,
  // así que la UI dice cuánto falta en vez de dejar al usuario adivinando.
  const imageCount  = tipo === 'carrusel' ? slides : 1
  const etaSegundos = imageCount * 10
  const canSubmit   = !!nicho.trim() && !!gancho.trim() && !!objetivo.trim() && !loading

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
          gancho:   gancho.trim(),
          objetivo: objetivo.trim(),
          ...(beneficio.trim() ? { beneficio: beneficio.trim() } : {}),
          ...(tipo === 'carrusel' ? { slides } : {}),
        }),
      })

      const body = await res.json() as { ok?: boolean; post?: SocialPost; error?: string }
      if (!res.ok || !body.post) throw new Error(body.error ?? 'Falló la generación')

      setPost(body.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
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

  return (
    <>
      <header className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Contenido Social</h1>
        <p className={adminStyles.pageSubtitle}>
          Genera posts, stories y carruseles de Instagram con la marca ActivoPOS.
        </p>
      </header>

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
            <label className={styles.label} htmlFor="gancho">Gancho</label>
            <textarea
              id="gancho"
              className={styles.textarea}
              value={gancho}
              onChange={e => setGancho(e.target.value)}
              placeholder="Cierro la caja y no me cuadra el efectivo"
              maxLength={300}
              disabled={loading}
              required
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
                <button
                  type="button"
                  className={`${adminStyles.actionLink} ${adminStyles.actionBtn}`}
                  onClick={() => void copyCaption()}
                >
                  {copied
                    ? <><Check size={14} aria-hidden="true" /> Copiado</>
                    : <><Copy size={14} aria-hidden="true" /> Copiar caption</>}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}
