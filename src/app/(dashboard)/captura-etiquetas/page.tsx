'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Download, Images } from 'lucide-react'
import { GOAL_UNITS, GOAL_VARIANTS, EAN_RE } from '@/lib/label-capture-shared'
import type {
  LabelCaptureDTO,
  LabelCaptureDuplicate,
  LabelCaptureList,
  LabelCapturePatch,
  LabelOcrResult,
  PendingLabel,
} from '@/types/label-capture'
import { EditSheet } from './EditSheet'
import { QuickAdd } from './QuickAdd'
import { scanLabel } from './scan'
import styles from './captura.module.css'
import tabStyles from './alta.module.css'

const LOG_LIMIT = 30
const EMPTY_OCR: LabelOcrResult = { ref: '', modelo: '', talla: '' }

interface ApiResult<T> {
  ok: boolean
  status: number
  data: T
}

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(url, init)
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

function errorOf(data: unknown, fallback: string): string {
  const msg = (data as { error?: unknown } | null)?.error
  return typeof msg === 'string' ? msg : fallback
}

function SafettiCapture() {
  const [items, setItems] = useState<LabelCaptureDTO[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [onlyReview, setOnlyReview] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [pending, setPending] = useState<PendingLabel[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const itemsRef = useRef<LabelCaptureDTO[]>([])
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const addLog = useCallback((line: string): void => {
    setLog(prev => [line, ...prev].slice(0, LOG_LIMIT))
  }, [])

  // El ref evita leer una lista vieja mientras la cola de fotos avanza.
  const upsert = useCallback((item: LabelCaptureDTO): void => {
    const exists = itemsRef.current.some(i => i.id === item.id)
    itemsRef.current = exists ? itemsRef.current.map(i => (i.id === item.id ? item : i)) : [...itemsRef.current, item]
    setItems(itemsRef.current)
  }, [])

  useEffect(() => {
    void (async () => {
      const r = await call<LabelCaptureList>('/api/label-capture')
      if (r.ok) {
        itemsRef.current = r.data.items
        setItems(r.data.items)
      } else {
        addLog(errorOf(r.data, 'No se pudo cargar la lista'))
      }
      setLoaded(true)
    })()
  }, [addLog])

  const totals = useMemo(
    () => ({ variants: items.length, units: items.reduce((sum, i) => sum + i.units, 0) }),
    [items],
  )
  const reviewCount = useMemo(() => items.filter(i => i.status === 'review').length, [items])
  const visible = useMemo(
    () => [...items].reverse().filter(i => !onlyReview || i.status === 'review'),
    [items, onlyReview],
  )
  const editing = items.find(i => i.id === editingId) ?? null

  /** Nunca se suma sin preguntar: Aceptar suma 1, Cancelar ignora. */
  async function resolveDuplicate(id: number, units: number, desc: string): Promise<string> {
    const again = window.confirm(`${desc} ya está registrada con ${units} unidad(es).\n¿Es otra unidad?\n\nAceptar = sumar 1 · Cancelar = ignorar`)
    if (!again) return `${desc}: ignorada`
    const r = await call<{ item: LabelCaptureDTO }>(`/api/label-capture/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ add_unit: true } satisfies LabelCapturePatch),
    })
    if (!r.ok) return `${desc}: ${errorOf(r.data, 'no se pudo sumar')}`
    upsert(r.data.item)
    return `${desc}: +1 unidad (ahora ${r.data.item.units})`
  }

  async function saveCapture(ean: string, ocr: LabelOcrResult): Promise<{ message: string; saved: boolean }> {
    const desc = `${ocr.ref || 'Sin ref'} ${ocr.talla}`.trim()
    const r = await call<{ item: LabelCaptureDTO } & Partial<LabelCaptureDuplicate>>('/api/label-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ean, ref: ocr.ref, model_name: ocr.modelo, size: ocr.talla }),
    })
    if (r.status === 409 && r.data.id !== undefined) {
      return { message: await resolveDuplicate(r.data.id, r.data.units ?? 0, `EAN ${ean}`), saved: true }
    }
    if (!r.ok) return { message: `${desc}: ${errorOf(r.data, 'no se pudo guardar')}`, saved: false }
    upsert(r.data.item)
    const tag = r.data.item.status === 'ok' ? 'OK' : 'por revisar'
    return { message: `${desc}: guardada (${tag})`, saved: true }
  }

  async function readText(image: Blob): Promise<LabelOcrResult> {
    const form = new FormData()
    form.append('file', image, 'etiqueta.jpg')
    const r = await call<LabelOcrResult>('/api/label-capture/ocr', { method: 'POST', body: form })
    if (!r.ok) throw new Error(errorOf(r.data, 'no se pudo leer el texto'))
    return r.data
  }

  async function handleFile(file: File): Promise<string> {
    const scan = await scanLabel(file)
    const dup = scan.ean ? itemsRef.current.find(i => i.ean === scan.ean) : undefined
    if (dup) return resolveDuplicate(dup.id, dup.units, `${dup.ref || 'EAN ' + dup.ean} ${dup.size}`.trim())

    let ocr = EMPTY_OCR
    let ocrError = ''
    try {
      ocr = await readText(scan.image)
    } catch (err) {
      ocrError = err instanceof Error ? err.message : 'sin lectura de texto'
    }
    if (!scan.ean) {
      setPending(prev => [...prev, { key: `${Date.now()}-${file.name}`, fileName: file.name, ocr, ean: '' }])
      return `${file.name}: no se leyó el código de barras; escribe el EAN abajo`
    }
    const { message } = await saveCapture(scan.ean, ocr)
    return ocrError ? `${message} (texto: ${ocrError})` : message
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    for (const file of files) {
      try {
        addLog(await handleFile(file))
      } catch (err) {
        addLog(`${file.name}: ${err instanceof Error ? err.message : 'error al procesar'}`)
      }
    }
    setBusy(false)
  }

  async function savePending(p: PendingLabel): Promise<void> {
    setBusy(true)
    const { message, saved } = await saveCapture(p.ean, p.ocr)
    addLog(message)
    if (saved) setPending(prev => prev.filter(x => x.key !== p.key))
    setBusy(false)
  }

  async function saveEdit(patch: LabelCapturePatch): Promise<void> {
    if (!editing) return
    if (Object.keys(patch).length === 0) {
      setEditingId(null)
      return
    }
    setSaving(true)
    setEditError('')
    const r = await call<{ item: LabelCaptureDTO }>(`/api/label-capture/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSaving(false)
    if (!r.ok) {
      setEditError(errorOf(r.data, 'No se pudo guardar'))
      return
    }
    upsert(r.data.item)
    setEditingId(null)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Captura de etiquetas</h1>
        <p className={styles.subtitle}>Fotografía cada etiqueta Safetti. El código de barras se lee en el teléfono.</p>
      </header>

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={styles.counters}>
            <div className={styles.counter}>
              <span className={styles.counterValue}>{totals.variants}<span className={styles.counterGoal}> / {GOAL_VARIANTS}</span></span>
              <span className={styles.counterLabel}>Variantes</span>
            </div>
            <div className={styles.counter}>
              <span className={styles.counterValue}>{totals.units}<span className={styles.counterGoal}> / {GOAL_UNITS}</span></span>
              <span className={styles.counterLabel}>Unidades</span>
            </div>
          </div>

          <input ref={cameraRef} className={styles.hiddenInput} type="file" accept="image/*" capture="environment" onChange={e => void onFiles(e)} />
          <input ref={galleryRef} className={styles.hiddenInput} type="file" accept="image/*" multiple onChange={e => void onFiles(e)} />
          <div className={styles.actions}>
            <button type="button" className={styles.bigButton} disabled={busy} onClick={() => cameraRef.current?.click()}>
              <Camera size={22} /> Tomar foto
            </button>
            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => galleryRef.current?.click()}>
              <Images size={20} /> Galería
            </button>
          </div>
          {busy && <p className={styles.busy} role="status">Leyendo etiqueta…</p>}

          {pending.length > 0 && (
            <div className={styles.pendingBox}>
              <h2 className={styles.sectionTitle}>Sin código de barras ({pending.length})</h2>
              {pending.map(p => (
                <div key={p.key} className={styles.pendingRow}>
                  <span className={styles.pendingInfo}>{p.fileName} · {p.ocr.ref || 'sin ref'} {p.ocr.talla}</span>
                  <input
                    className={styles.input}
                    value={p.ean}
                    inputMode="numeric"
                    maxLength={13}
                    placeholder="EAN de 13 dígitos"
                    onChange={e => {
                      const ean = e.target.value.replace(/\D/g, '')
                      setPending(prev => prev.map(x => (x.key === p.key ? { ...x, ean } : x)))
                    }}
                  />
                  <button type="button" className={styles.primaryButton} disabled={busy || !EAN_RE.test(p.ean)} onClick={() => void savePending(p)}>
                    Guardar
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => setPending(prev => prev.filter(x => x.key !== p.key))}>
                    Descartar
                  </button>
                </div>
              ))}
            </div>
          )}

          {log.length > 0 && (
            <ul className={styles.log} aria-live="polite">
              {log.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
            </ul>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.toolbar}>
            <button type="button" className={onlyReview ? styles.chipActive : styles.chip} onClick={() => setOnlyReview(v => !v)}>
              Por revisar ({reviewCount})
            </button>
            <a className={styles.chip} href="/api/label-capture/export?format=csv" download><Download size={16} /> CSV</a>
            <a className={styles.chip} href="/api/label-capture/export?format=json" download><Download size={16} /> JSON</a>
          </div>

          {loaded && visible.length === 0 && (
            <p className={styles.empty}>{onlyReview ? 'Nada por revisar.' : 'Aún no hay etiquetas. Toma la primera foto.'}</p>
          )}
          <ul className={styles.list}>
            {visible.map(i => (
              <li key={i.id}>
                <button type="button" className={styles.row} onClick={() => { setEditError(''); setEditingId(i.id) }}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowRef}>{i.ref || 'Sin ref'} · {i.size || 'sin talla'}</span>
                    <span className={styles.rowMeta}>{i.model_name || 'Sin modelo'} · {i.garment || 'prenda ?'} · {i.gender || 'género ?'}{i.color_actual ? ` · ${i.color_actual}` : ''}</span>
                  </span>
                  <span className={i.status === 'ok' ? styles.badgeOk : styles.badgeReview}>{i.status === 'ok' ? 'OK' : 'Revisar'}</span>
                  <span className={styles.units}>×{i.units}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editing && (
        <EditSheet
          key={editing.id}
          item={editing}
          saving={saving}
          error={editError}
          onClose={() => setEditingId(null)}
          onSave={patch => void saveEdit(patch)}
        />
      )}
    </div>
  )
}

type Tab = 'safetti' | 'alta'

/** Dos modos en la misma ruta. Ambos quedan montados (el modo Safetti conserva su estado al cambiar de pestaña). */
export default function CapturaEtiquetasPage() {
  const [tab, setTab] = useState<Tab>('safetti')
  return (
    <>
      <div className={tabStyles.tabs} role="tablist" aria-label="Modo de captura">
        <button type="button" role="tab" aria-selected={tab === 'safetti'} className={tab === 'safetti' ? tabStyles.tabActive : tabStyles.tab} onClick={() => setTab('safetti')}>
          Etiquetas Safetti
        </button>
        <button type="button" role="tab" aria-selected={tab === 'alta'} className={tab === 'alta' ? tabStyles.tabActive : tabStyles.tab} onClick={() => setTab('alta')}>
          Alta rápida
        </button>
      </div>
      <div hidden={tab !== 'safetti'}><SafettiCapture /></div>
      <div hidden={tab !== 'alta'}><QuickAdd active={tab === 'alta'} /></div>
    </>
  )
}
