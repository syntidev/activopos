'use client'

import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ImageUp } from 'lucide-react'
import { Button } from './Button'
import styles from './ImageField.module.css'

/*
 * ImageField — control único de subida de imagen (no-producto).
 * Ciclo completo: subir, cambiar y (si `removable`) quitar, con botones
 * visibles bajo la vista previa (no dependen de hover: en móvil no existe).
 * `onChange(null)` = quitar. Si `onChange` devuelve una promesa (pestañas que
 * guardan al instante), el control queda ocupado hasta que resuelve y muestra
 * el error si rechaza. No borra archivos del disco al quitar ni al reemplazar.
 * Tamaño/proporción de la vista previa: las pone cada pantalla (boxClassName).
 */

export type ImageUploadType = 'logo' | 'catalog_cover' | 'landing' | 'brand'

// Mismos límites que api/upload/image/route.ts (MAX_SIZE = 5 MB, ALLOWED_FORMATS
// jpeg/png/webp). El servidor es la fuente de verdad; esto solo ahorra el viaje.
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const HINT = 'JPG, PNG o WebP · máx. 5 MB'

// Compresión client-side (Canvas -> WebP) que ya usaba Landing: archivos chicos
// se suben tal cual (el backend igual genera webp).
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

async function uploadImage(file: File, type: ImageUploadType, resultField: 'url' | 'thumb'): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('type', type)
  const res  = await fetch('/api/upload/image', { method: 'POST', body: fd })
  const data = await res.json().catch(() => null) as { url?: string; thumb?: string; error?: string } | null
  const result = data?.[resultField]
  if (!res.ok || !result) throw new Error(data?.error ?? 'No se pudo subir la imagen. Intenta de nuevo.')
  return result
}

export interface ImageFieldProps {
  /** Nombre del campo: etiqueta visible y base de los aria-label. */
  label:           string
  value:           string | null
  /** url = imagen subida; null = quitar. Puede devolver promesa (guardado al instante). */
  onChange:        (url: string | null) => void | Promise<void>
  uploadType:      ImageUploadType
  removable?:      boolean
  /** Comprime > 800 KB a WebP antes de subir (comportamiento previo de Landing). */
  compress?:       boolean
  /** Campo de la respuesta del upload que se guarda (marcas usan la miniatura). */
  resultField?:    'url' | 'thumb'
  /** Oculta la etiqueta visible cuando la pantalla ya muestra un título propio. */
  hideLabel?:      boolean
  labelClassName?: string
  /** Caja de la vista previa: define tamaño y proporción de cada pantalla. */
  boxClassName:    string
  imgClassName?:   string
  alt?:            string
  emptyContent?:   ReactNode
  /** stack: botones bajo la vista previa · inline: a su derecha (logo, marca). */
  layout?:         'stack' | 'inline'
}

export function ImageField({
  label, value, onChange, uploadType, removable = false, compress = false,
  resultField = 'url', hideLabel = false, labelClassName, boxClassName, imgClassName,
  alt = '', emptyContent, layout = 'stack',
}: ImageFieldProps) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const errorId   = useId()
  const [busy, setBusy]                 = useState(false)
  const [error, setError]               = useState('')
  const [dragging, setDragging]         = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  // Quitar en dos pasos: el primer clic solo pide confirmación inline.
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const src = localPreview ?? value

  const openPicker = () => { if (!busy) inputRef.current?.click() }

  const handleFile = async (file: File) => {
    setError('')
    setConfirmingRemove(false)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato no permitido: usa una imagen JPG, PNG o WebP.')
      return
    }
    const toSend = compress ? await compressImage(file) : file
    if (toSend.size > MAX_BYTES) {
      setError('La imagen supera 5 MB. Reduce su tamaño e intenta de nuevo.')
      return
    }
    const preview = URL.createObjectURL(file)
    setLocalPreview(preview)
    setBusy(true)
    try {
      const url = await uploadImage(toSend, uploadType, resultField)
      await onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen. Intenta de nuevo.')
    } finally {
      setBusy(false)
      setLocalPreview(null)
      URL.revokeObjectURL(preview)
    }
  }

  const handleRemove = async () => {
    setError('')
    setBusy(true)
    try {
      await onChange(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la imagen. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && !busy) void handleFile(file)
  }

  return (
    <div className={styles.field}>
      {!hideLabel && <span className={labelClassName ?? styles.label}>{label}</span>}

      <div className={layout === 'inline' ? styles.inline : styles.stack}>
        <div
          className={`${boxClassName} ${styles.box} ${dragging ? styles.dragging : ''}`}
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-label={src ? `Cambiar ${label}` : `Subir ${label}`}
          aria-disabled={busy}
          aria-describedby={error ? errorId : undefined}
          onClick={openPicker}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() } }}
          onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {src
            ? <img src={src} alt={alt} className={imgClassName} />
            : (emptyContent ?? (
                <span className={styles.empty}>
                  <ImageUp size={20} aria-hidden="true" />
                  Arrastra o haz clic
                </span>
              ))}
          {busy && <span className={styles.overlay}>{localPreview ? 'Subiendo…' : 'Guardando…'}</span>}
        </div>

        <div className={styles.controls}>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openPicker}
              disabled={busy}
              aria-label={`${src ? 'Cambiar' : 'Subir'} imagen: ${label}`}
            >
              {src ? 'Cambiar imagen' : 'Subir imagen'}
            </Button>
            {removable && value && !confirmingRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingRemove(true)}
                disabled={busy}
                aria-label={`Quitar imagen: ${label}`}
              >
                Quitar
              </Button>
            )}
            {removable && value && confirmingRemove && (
              <>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => { setConfirmingRemove(false); void handleRemove() }}
                  disabled={busy}
                  aria-label={`Confirmar quitar imagen: ${label}`}
                >
                  Sí, quitar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingRemove(false)}
                  disabled={busy}
                  aria-label={`Cancelar quitar imagen: ${label}`}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
          <p className={styles.hint}>{HINT}</p>
          {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className={styles.fileInput}
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
