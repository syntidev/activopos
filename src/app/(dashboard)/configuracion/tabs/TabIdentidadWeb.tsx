'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'
import own from './TabIdentidadWeb.module.css'

interface Props { businessId: number }
type Kind = 'favicon' | 'og'
interface Current { favicon: string | null; og: string | null }

const KEY_STEP = 5
const clamp = (n: number): number => Math.min(100, Math.max(0, Math.round(n)))

/** Identidad web: favicon (cuadrado ≥512 px) e imagen para compartir (1200×630, recorte con punto de enfoque). */
export function TabIdentidadWeb({ businessId }: Props) {
  void businessId
  const { toast } = useToast()
  const [current, setCurrent] = useState<Current>({ favicon: null, og: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Kind | null>(null)
  // Imagen para compartir elegida y aún sin guardar: archivo, vista local y punto de enfoque (%).
  const [ogFile, setOgFile] = useState<File | null>(null)
  const [ogPreview, setOgPreview] = useState<string | null>(null)
  const [focus, setFocus] = useState({ x: 50, y: 50 })
  const faviconInput = useRef<HTMLInputElement>(null)
  const ogInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/config/identidad-web')
      const data = (await res.json().catch(() => null)) as ({ ok?: boolean } & Partial<Current>) | null
      if (res.ok && data) setCurrent({ favicon: data.favicon ?? null, og: data.og ?? null })
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => () => { if (ogPreview) URL.revokeObjectURL(ogPreview) }, [ogPreview])

  const send = async (kind: Kind, file: File): Promise<void> => {
    setBusy(kind)
    try {
      const form = new FormData()
      form.set('kind', kind)
      form.set('file', file)
      if (kind === 'og') { form.set('focus_x', String(focus.x)); form.set('focus_y', String(focus.y)) }
      const res = await fetch('/api/config/identidad-web', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok) { toast(data?.error ?? 'No se pudo guardar la imagen.', 'error'); return }
      toast(kind === 'favicon' ? 'Favicon guardado.' : 'Imagen para compartir guardada.', 'success')
      if (kind === 'og') { setOgFile(null); setOgPreview(null); setFocus({ x: 50, y: 50 }) }
      await load()
    } catch {
      toast('Error de conexión. Intenta de nuevo.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const quitar = async (kind: Kind): Promise<void> => {
    setBusy(kind)
    try {
      const res = await fetch(`/api/config/identidad-web?kind=${kind}`, { method: 'DELETE' })
      if (!res.ok) { toast('No se pudo quitar la imagen.', 'error'); return }
      toast('Listo: se usa la de ActivoPOS.', 'success')
      await load()
    } catch {
      toast('Error de conexión. Intenta de nuevo.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const onFavicon = (e: ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) void send('favicon', f)
  }
  const onOg = (e: ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setOgFile(f)
    setOgPreview(URL.createObjectURL(f))
    setFocus({ x: 50, y: 50 })
  }
  const pick = (e: MouseEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    setFocus({ x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) })
  }
  const keys = (e: KeyboardEvent<HTMLDivElement>): void => {
    const d: Record<string, [number, number]> = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }
    const s = d[e.key]
    if (!s) return
    e.preventDefault()
    setFocus(f => ({ x: clamp(f.x + s[0]), y: clamp(f.y + s[1]) }))
  }

  if (loading) {
    return (
      <div className={styles.configSection}>
        <div className={styles.pageHeader}><h2 className={styles.pageTitle}>Identidad web</h2></div>
        <p className={styles.pageSubtitle}>Cargando…</p>
      </div>
    )
  }

  return (
    <div className={styles.configSection} data-testid="identidad-web">
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Identidad web</h2>
        <p className={styles.pageSubtitle}>El ícono de la pestaña y la imagen que aparece al compartir tu catálogo por WhatsApp o redes. Si no subes nada, se usan los de ActivoPOS.</p>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}><Globe size={16} aria-hidden="true" />Favicon</h3>
        <p className={styles.colorDesc}>Imagen cuadrada de al menos 512×512 px (PNG, SVG o JPG, máx. 5 MB). Se usa en la pestaña del navegador y al guardar el catálogo en el celular.</p>
        <div className={own.fila}>
          <div className={own.faviconCaja}>
            {current.favicon ? <img src={current.favicon} alt="Favicon actual" className={own.faviconImg} data-testid="identidad-favicon-actual" /> : <span className={own.vacio}>ActivoPOS</span>}
          </div>
          <div className={own.acciones}>
            <input ref={faviconInput} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className={own.oculto} onChange={onFavicon} data-testid="identidad-favicon-input" aria-label="Subir favicon" />
            <Button variant="secondary" onClick={() => faviconInput.current?.click()} loading={busy === 'favicon'}>{current.favicon ? 'Cambiar favicon' : 'Subir favicon'}</Button>
            {current.favicon && <Button variant="ghost" onClick={() => void quitar('favicon')} disabled={busy !== null}>Quitar</Button>}
          </div>
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}><Globe size={16} aria-hidden="true" />Imagen para compartir</h3>
        <p className={styles.colorDesc}>Ideal 1200×630 px (JPG, PNG o WebP, máx. 5 MB). Si tiene otra proporción se recorta al centro; toca la foto para elegir qué parte siempre se ve.</p>
        {ogPreview ? (
          <>
            <div className={own.ogCaja} onClick={pick} onKeyDown={keys} role="button" tabIndex={0} aria-label="Elegir punto de enfoque de la imagen para compartir" data-testid="identidad-og-enfoque">
              <img src={ogPreview} alt="" className={own.ogImg} style={{ objectPosition: `${focus.x}% ${focus.y}%` }} draggable={false} />
              <span className={own.cruz} style={{ left: `${focus.x}%`, top: `${focus.y}%` }} aria-hidden="true" />
            </div>
            <p className={own.valor}>Enfoque: {focus.x}% · {focus.y}%</p>
          </>
        ) : (
          <div className={own.ogCaja}>
            {current.og ? <img src={current.og} alt="Imagen para compartir actual" className={own.ogImg} data-testid="identidad-og-actual" /> : <span className={own.vacio}>Se genera automáticamente con tu logo y nombre</span>}
          </div>
        )}
        <div className={own.acciones}>
          <input ref={ogInput} type="file" accept="image/png,image/jpeg,image/webp" className={own.oculto} onChange={onOg} data-testid="identidad-og-input" aria-label="Elegir imagen para compartir" />
          {ogFile ? (
            <>
              <Button variant="primary" onClick={() => void send('og', ogFile)} loading={busy === 'og'} data-testid="identidad-og-guardar">Guardar imagen</Button>
              <Button variant="ghost" onClick={() => { setOgFile(null); setOgPreview(null) }} disabled={busy !== null}>Cancelar</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => ogInput.current?.click()}>{current.og ? 'Cambiar imagen' : 'Subir imagen'}</Button>
              {current.og && <Button variant="ghost" onClick={() => void quitar('og')} disabled={busy !== null}>Quitar</Button>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
