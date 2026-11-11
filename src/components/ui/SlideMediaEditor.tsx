'use client'

import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { ImageField, type ImageUploadType } from '@/components/ui/ImageField'
import { RECOMMENDED, SHOW_ON, objectPositionOf, type ShowOn } from '@/lib/slide-media'
import styles from './SlideMediaEditor.module.css'

const SHOW_ON_LABEL: Record<ShowOn, string> = { all: 'Todos los dispositivos', desktop: 'Solo escritorio', mobile: 'Solo móvil' }
const KEY_STEP = 5

interface Size { w: number; h: number }

export interface SlideMediaPatch { mobile?: string | null; focusX?: number; focusY?: number; showOn?: ShowOn }

interface SlideMediaEditorProps {
  /** Prefijo único para ids/labels (ej. "slide-2", "portada-1"). */
  idPrefix:   string
  /** Imagen de escritorio ya subida (el editor solo aparece cuando existe). */
  image:      string
  mobile:     string | null
  focusX:     number
  focusY:     number
  showOn:     ShowOn
  uploadType: ImageUploadType
  onChange:   (patch: SlideMediaPatch) => void | Promise<void>
}

const small = (s: Size | null, rec: Size): boolean => !!s && (s.w < rec.w || s.h < rec.h)

/** Enfoque (clic sobre la miniatura), imagen móvil opcional, "Mostrar en" y vista previa lado a lado con avisos de tamaño. */
export function SlideMediaEditor({ idPrefix, image, mobile, focusX, focusY, showOn, uploadType, onChange }: SlideMediaEditorProps) {
  const [desktopSize, setDesktopSize] = useState<Size | null>(null)
  const [mobileSize, setMobileSize] = useState<Size | null>(null)

  const pick = (e: MouseEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    void onChange({ focusX: Math.round(((e.clientX - r.left) / r.width) * 100), focusY: Math.round(((e.clientY - r.top) / r.height) * 100) })
  }
  const keys = (e: KeyboardEvent<HTMLDivElement>): void => {
    const d: Record<string, [number, number]> = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }
    const step = d[e.key]
    if (!step) return
    e.preventDefault()
    void onChange({ focusX: Math.min(100, Math.max(0, focusX + step[0])), focusY: Math.min(100, Math.max(0, focusY + step[1])) })
  }
  const measure = (set: (s: Size) => void) => (e: { currentTarget: HTMLImageElement }): void => set({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })

  return (
    <div className={styles.editor} data-testid={idPrefix + '-media'}>
      <p className={styles.titulo}>Punto de enfoque</p>
      <p className={styles.ayuda}>Toca la foto donde está lo importante: es lo que siempre se verá al recortar.</p>
      <div className={styles.picker} onClick={pick} onKeyDown={keys} role="button" tabIndex={0} aria-label={'Elegir punto de enfoque de ' + idPrefix} data-testid={idPrefix + '-enfoque'}>
        <img src={image} alt="" className={styles.miniatura} draggable={false} />
        <span className={styles.cruz} style={{ left: focusX + '%', top: focusY + '%' }} data-testid={idPrefix + '-cruz'} aria-hidden="true" />
      </div>
      <p className={styles.valor}>Enfoque: {focusX}% · {focusY}%</p>

      <p className={styles.titulo}>Imagen para móvil (opcional)</p>
      <ImageField label={'Imagen móvil de ' + idPrefix} value={mobile} onChange={u => onChange({ mobile: u })} uploadType={uploadType} compress removable
        boxClassName={styles.cajaMovil} alt="Imagen móvil" emptyContent={<span className={styles.vacio}>Subir imagen móvil (4:5)</span>} />

      <label className={styles.titulo} htmlFor={idPrefix + '-mostrar'}>Mostrar en</label>
      <select id={idPrefix + '-mostrar'} className={styles.select} value={showOn} onChange={e => { void onChange({ showOn: SHOW_ON.find(v => v === e.target.value) ?? 'all' }) }} data-testid={idPrefix + '-mostrar'}>
        {SHOW_ON.map(v => <option key={v} value={v}>{SHOW_ON_LABEL[v]}</option>)}
      </select>

      <p className={styles.titulo}>Vista previa</p>
      <div className={styles.previas}>
        <figure className={styles.figura}>
          <div className={styles.marcoMovil} data-testid={idPrefix + '-previa-movil'}>
            <img src={mobile ?? image} alt="" className={styles.previaImg} style={{ objectPosition: objectPositionOf({ focusX, focusY }) }} onLoad={mobile ? measure(setMobileSize) : undefined} />
          </div>
          <figcaption>Teléfono 375 px · {RECOMMENDED.mobile.w}×{RECOMMENDED.mobile.h}</figcaption>
        </figure>
        <figure className={styles.figura}>
          <div className={styles.marcoEscritorio} data-testid={idPrefix + '-previa-escritorio'}>
            <img src={image} alt="" className={styles.previaImg} style={{ objectPosition: objectPositionOf({ focusX, focusY }) }} onLoad={measure(setDesktopSize)} />
          </div>
          <figcaption>Escritorio · {RECOMMENDED.desktop.w}×{RECOMMENDED.desktop.h}</figcaption>
        </figure>
      </div>
      {small(desktopSize, RECOMMENDED.desktop) && desktopSize && (
        <p className={styles.aviso} role="status" data-testid={idPrefix + '-aviso-escritorio'}>
          Tu foto de escritorio mide {desktopSize.w}×{desktopSize.h} px; se recomienda {RECOMMENDED.desktop.w}×{RECOMMENDED.desktop.h}. Puede verse borrosa.
        </p>
      )}
      {mobile && small(mobileSize, RECOMMENDED.mobile) && mobileSize && (
        <p className={styles.aviso} role="status" data-testid={idPrefix + '-aviso-movil'}>
          Tu foto móvil mide {mobileSize.w}×{mobileSize.h} px; se recomienda {RECOMMENDED.mobile.w}×{RECOMMENDED.mobile.h}. Puede verse borrosa.
        </p>
      )}
      {!mobile && <p className={styles.ayuda}>Sin imagen móvil se usa la de escritorio, recortada alrededor del enfoque.</p>}
    </div>
  )
}
