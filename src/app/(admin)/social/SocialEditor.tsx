'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Type, Baseline, ImageIcon, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import styles from './SocialEditor.module.css'

/* El editor no puede importar brand.ts (usa fs, server-only). Las dimensiones
   del lienzo se duplican acá — misma tabla que ASPECT_DIMENSIONS. */
type Aspect = '1:1' | '4:5' | '3:4' | '9:16'
const CANVAS: Record<Aspect, { w: number; h: number }> = {
  '1:1':  { w: 1080, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
  '3:4':  { w: 1080, h: 1440 },
  '9:16': { w: 1080, h: 1920 },
}

// Ancho de preview fijo; el alto sale del aspect. scale mapea px de pantalla a px
// del lienzo real (1080 de ancho).
const PREVIEW_W = 300

// Paleta de swatches de marca para color de texto.
const SWATCHES = ['#0038BD', '#0D1B2E', '#EF8E01', '#FFFFFF', '#000000', '#4D7AFF', '#DCE6FF', '#64748B']

type Pos = { x: number; y: number }

interface LayerState {
  pos:    Pos
  size:   number
  color:  string
  align:  'left' | 'center' | 'right'
  shadow: boolean
  show:   boolean
}

// Mismo shape que arma buildOverride() y que valida overrideSchema en
// compose/route.ts. Es lo que queda guardado en SocialAsset.layer_override.
export interface LayerOverride {
  titlePos?:       Pos
  subtitlePos?:    Pos
  logoPos?:        Pos
  titleSize?:      number
  subtitleSize?:   number
  logoSize?:       number
  titleColor?:     string
  subtitleColor?:  string
  logoType?:       'negative' | 'positive'
  showTitle?:      boolean
  showSubtitle?:   boolean
  showLogo?:       boolean
  titleAlign?:     LayerState['align']
  subtitleAlign?:  LayerState['align']
  titleShadow?:    boolean
  subtitleShadow?: boolean
}

interface SocialEditorProps {
  postId:        number
  titulo:        string
  subtitulo:     string
  backgroundUrl: string
  aspect:        Aspect
  formato:       'post' | 'story' | 'carrusel'
  // Edición previa, leída de SocialAsset.layer_override. null = nunca se editó.
  layerOverride?: LayerOverride | null
  onClose:       () => void
  onSealed:      (imagenUrl: string) => void
}

// Defaults alineados con compose.ts (posiciones aproximadas del layout fijo).
// Campo por campo en vez de spread: con `...partial` una clave presente pero
// undefined (lo normal al venir de un layer_override parcial) pisaba el default
// con undefined en vez de conservarlo.
function initLayer(partial: Partial<LayerState>): LayerState {
  return {
    pos:    partial.pos    ?? { x: 72, y: 72 },
    size:   partial.size   ?? 68,
    color:  partial.color  ?? '#FFFFFF',
    align:  partial.align  ?? 'left',
    shadow: partial.shadow ?? false,
    show:   partial.show   ?? true,
  }
}

export function SocialEditor({
  postId, titulo, subtitulo, backgroundUrl, aspect, formato, layerOverride, onClose, onSealed,
}: SocialEditorProps) {
  const canvas = CANVAS[aspect]
  const scale  = PREVIEW_W / canvas.w
  const previewH = canvas.h * scale

  const isStory = formato === 'story'
  // Semilla: lo que quedó guardado de la última edición; si el post nunca se
  // editó (ov vacío) cada campo cae a su default de siempre.
  const ov = layerOverride ?? {}
  const [title, setTitle]       = useState<LayerState>(initLayer({
    pos:    ov.titlePos   ?? { x: 72, y: canvas.h - 320 },
    size:   ov.titleSize  ?? (isStory ? 76 : 68),
    color:  ov.titleColor, align: ov.titleAlign, shadow: ov.titleShadow, show: ov.showTitle,
  }))
  const [subtitle, setSubtitle] = useState<LayerState>(initLayer({
    pos:    ov.subtitlePos  ?? { x: 72, y: canvas.h - 180 },
    size:   ov.subtitleSize ?? (isStory ? 36 : 32),
    color:  ov.subtitleColor, align: ov.subtitleAlign, shadow: ov.subtitleShadow, show: ov.showSubtitle,
  }))
  const [logo, setLogo]         = useState<LayerState & { type: 'negative' | 'positive' }>({
    ...initLayer({
      pos:  ov.logoPos  ?? { x: 72, y: 72 },
      size: ov.logoSize ?? 84,
      show: ov.showLogo,
    }),
    type: ov.logoType ?? 'negative',
  })

  const [sealing, setSealing] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [sealedUrl, setSealedUrl] = useState<string | null>(null)

  // Arrastre: info.delta viene en px de pantalla; se divide por scale para
  // moverse en px del lienzo real. dragMomentum off para control preciso.
  const dragProps = (set: (fn: (p: LayerState) => LayerState) => void) => ({
    drag: true as const,
    dragMomentum: false,
    onDrag: (_e: unknown, info: { delta: { x: number; y: number } }) =>
      set(p => ({ ...p, pos: { x: p.pos.x + info.delta.x / scale, y: p.pos.y + info.delta.y / scale } })),
  })

  function buildOverride() {
    return {
      titlePos: title.pos, subtitlePos: subtitle.pos, logoPos: logo.pos,
      titleSize: Math.round(title.size), subtitleSize: Math.round(subtitle.size), logoSize: Math.round(logo.size),
      titleColor: title.color, subtitleColor: subtitle.color,
      logoType: logo.type,
      showTitle: title.show, showSubtitle: subtitle.show, showLogo: logo.show,
      titleAlign: title.align, subtitleAlign: subtitle.align,
      titleShadow: title.shadow, subtitleShadow: subtitle.shadow,
    }
  }

  async function seal() {
    setSealing(true); setError(null)
    try {
      const res = await fetch('/api/admin/social/compose', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          social_post_id: postId, background_url: backgroundUrl,
          titulo, subtitulo, formato, aspect, override: buildOverride(),
        }),
      })
      const data = await res.json() as { ok?: boolean; imagen_url?: string; error?: string }
      if (!res.ok || !data.imagen_url) { setError(data.error ?? 'No se pudo sellar'); return }
      setSealedUrl(data.imagen_url)
      onSealed(data.imagen_url)
    } catch {
      setError('Error de conexión')
    } finally {
      setSealing(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label="Editor de diseño">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.title}>Editar diseño</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.body}>
          {/* ── Preview arrastrable ── */}
          <div className={styles.previewWrap}>
            <div
              className={styles.preview}
              style={{ width: PREVIEW_W, height: previewH, backgroundImage: `url(${sealedUrl ?? backgroundUrl})` }}
            >
              {!sealedUrl && logo.show && (
                // Isotipo + wordmark como un solo bloque arrastrable, igual que el lockup
                // que compone compose.ts server-side (isotipo + "ActivoPOS" en Inter, gap 20px,
                // wordmark blanco fijo a 34px — no proporcional al logo, para calcar el sellado).
                <motion.div
                  className={styles.layer}
                  style={{ left: logo.pos.x * scale, top: logo.pos.y * scale, display: 'flex', alignItems: 'center', gap: 20 * scale }}
                  {...dragProps(setLogo as never)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.type === 'negative' ? '/activopos-logo-negative.svg' : '/activopos-logo-positive.svg'}
                    style={{ width: logo.size * scale }}
                    alt="logo" draggable={false}
                  />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#FFFFFF', fontSize: 34 * scale, whiteSpace: 'nowrap' }}>
                    ActivoPOS
                  </span>
                </motion.div>
              )}
              {!sealedUrl && title.show && (
                <motion.div
                  className={styles.layer}
                  style={{
                    left: title.pos.x * scale, top: title.pos.y * scale,
                    fontSize: title.size * scale, color: title.color, textAlign: title.align,
                    fontFamily: 'Fraunces, serif', fontWeight: 700, maxWidth: (canvas.w - 144) * scale,
                    textShadow: title.shadow ? '2px 2px 4px rgba(0,0,0,0.6)' : 'none',
                  }}
                  {...dragProps(setTitle)}
                >
                  {titulo}
                </motion.div>
              )}
              {!sealedUrl && subtitle.show && (
                <motion.div
                  className={styles.layer}
                  style={{
                    left: subtitle.pos.x * scale, top: subtitle.pos.y * scale,
                    fontSize: subtitle.size * scale, color: subtitle.color, textAlign: subtitle.align,
                    fontFamily: 'Inter, sans-serif', fontWeight: 600, maxWidth: (canvas.w - 144) * scale,
                    textShadow: subtitle.shadow ? '2px 2px 4px rgba(0,0,0,0.6)' : 'none',
                  }}
                  {...dragProps(setSubtitle)}
                >
                  {subtitulo}
                </motion.div>
              )}
            </div>
            {sealedUrl && <p className={styles.sealedNote}>Diseño sellado. Cierra para volver.</p>}
            {!sealedUrl && <p className={styles.hint}>Arrastra cada capa para moverla. El resultado real se sella en el servidor.</p>}
          </div>

          {/* ── Panel de control ── */}
          <div className={styles.controls}>
            <TextSection icon={Type} name="Título" layer={title} setLayer={setTitle} sizeRange={[32, 140]} />
            <TextSection icon={Baseline} name="Subtítulo" layer={subtitle} setLayer={setSubtitle} sizeRange={[18, 80]} />

            <details className={styles.section}>
              <summary className={styles.sectionHead}>
                <ImageIcon size={14} aria-hidden="true" /> Logo
              </summary>
              <div className={styles.sectionBody}>
                <ToggleRow label="Mostrar" on={logo.show} onToggle={() => setLogo(p => ({ ...p, show: !p.show }))} />
                <label className={styles.ctrlLabel}>
                  Tamaño
                  <input type="range" min={40} max={220} value={logo.size}
                    onChange={e => setLogo(p => ({ ...p, size: Number(e.target.value) }))} />
                </label>
                <div className={styles.segRow} role="group" aria-label="Tipo de logo">
                  <button type="button" className={`${styles.segBtn} ${logo.type === 'negative' ? styles.segOn : ''}`}
                    onClick={() => setLogo(p => ({ ...p, type: 'negative' }))}>Claro</button>
                  <button type="button" className={`${styles.segBtn} ${logo.type === 'positive' ? styles.segOn : ''}`}
                    onClick={() => setLogo(p => ({ ...p, type: 'positive' }))}>Oscuro</button>
                </div>
              </div>
            </details>
          </div>
        </div>

        <footer className={styles.footer}>
          {error && <span className={styles.error}>{error}</span>}
          <button type="button" className={styles.sealBtn} onClick={seal} disabled={sealing}>
            {sealing ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : null}
            {sealing ? 'Sellando…' : 'Sellar diseño final'}
          </button>
        </footer>
      </div>
    </div>
  )
}

/* ── Sección de control de una capa de texto ── */
interface TextSectionProps {
  icon:      typeof Type
  name:      string
  layer:     LayerState
  setLayer:  (fn: (p: LayerState) => LayerState) => void
  sizeRange: [number, number]
}
function TextSection({ icon: Icon, name, layer, setLayer, sizeRange }: TextSectionProps) {
  return (
    <details className={styles.section} open>
      <summary className={styles.sectionHead}>
        <Icon size={14} aria-hidden="true" /> {name}
      </summary>
      <div className={styles.sectionBody}>
        <ToggleRow label="Mostrar" on={layer.show} onToggle={() => setLayer(p => ({ ...p, show: !p.show }))} />
        <label className={styles.ctrlLabel}>
          Tamaño
          <input type="range" min={sizeRange[0]} max={sizeRange[1]} value={layer.size}
            onChange={e => setLayer(p => ({ ...p, size: Number(e.target.value) }))} />
        </label>
        <div className={styles.swatches}>
          {SWATCHES.map(c => (
            <button key={c} type="button"
              className={`${styles.swatch} ${layer.color.toUpperCase() === c ? styles.swatchOn : ''}`}
              style={{ background: c }} onClick={() => setLayer(p => ({ ...p, color: c }))}
              aria-label={`Color ${c}`} />
          ))}
          <input type="color" className={styles.colorPicker} value={layer.color}
            onChange={e => setLayer(p => ({ ...p, color: e.target.value }))} aria-label="Color personalizado" />
        </div>
        <div className={styles.segRow} role="group" aria-label="Alineación">
          <button type="button" className={`${styles.segBtn} ${layer.align === 'left' ? styles.segOn : ''}`}
            onClick={() => setLayer(p => ({ ...p, align: 'left' }))} aria-label="Izquierda"><AlignLeft size={14} /></button>
          <button type="button" className={`${styles.segBtn} ${layer.align === 'center' ? styles.segOn : ''}`}
            onClick={() => setLayer(p => ({ ...p, align: 'center' }))} aria-label="Centro"><AlignCenter size={14} /></button>
          <button type="button" className={`${styles.segBtn} ${layer.align === 'right' ? styles.segOn : ''}`}
            onClick={() => setLayer(p => ({ ...p, align: 'right' }))} aria-label="Derecha"><AlignRight size={14} /></button>
        </div>
        <ToggleRow label="Sombra" on={layer.shadow} onToggle={() => setLayer(p => ({ ...p, shadow: !p.shadow }))} />
      </div>
    </details>
  )
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={styles.toggleRow} onClick={onToggle} aria-pressed={on}>
      {on ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
      {label}
      <span className={`${styles.toggleDot} ${on ? styles.toggleDotOn : ''}`} />
    </button>
  )
}
