'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Download, ScanBarcode, Undo2 } from 'lucide-react'
import { EAN_RE } from '@/lib/label-capture-shared'
import { evaluateOn, groupOnProducts, normalizeGender, normalizeOnStyle, normalizeShoeSize } from '@/lib/label-profiles'
import type { LabelCaptureDTO, LabelCaptureList, OnCaptureBody, OnCaptureResponse, OnOcrResult } from '@/types/label-capture'
import { BarcodeCamera } from './BarcodeCamera'
import { scanLabel } from './scan'
import styles from './captura.module.css'
import on from './OnCapture.module.css'

interface CardForm {
  ean: string
  style: string
  model: string
  colorway: string
  gender: string
  us: string
  eu: string
  uk: string
  jp: string
}

const EMPTY_FORM: CardForm = { ean: '', style: '', model: '', colorway: '', gender: '', us: '', eu: '', uk: '', jp: '' }
/** Campos de la caja (misma referencia para varias tallas): se conservan al guardar y se borran con "Siguiente caja". */
const BOX_KEYS = ['style', 'model', 'colorway', 'gender'] as const

interface Undo {
  id: number
  /** 'new' = la captura se creó con ese guardado (se borra); 'added' = solo se sumó 1 (se resta). */
  kind: 'new' | 'added'
  label: string
}

async function request<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, init)
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T }
}

function errorOf(data: unknown, fallback: string): string {
  const msg = (data as { error?: unknown } | null)?.error
  return typeof msg === 'string' ? msg : fallback
}

function bodyOf(form: CardForm): Omit<OnCaptureBody, 'profile'> {
  return { ean: form.ean, style: form.style, model_name: form.model, colorway: form.colorway, gender: form.gender, us: form.us, eu: form.eu, uk: form.uk, jp: form.jp }
}

function formOf(item: LabelCaptureDTO): CardForm {
  return { ean: item.ean, style: item.style, model: item.model_name, colorway: item.label_color, gender: item.gender, us: item.size_us, eu: item.size_eu, uk: item.size_uk, jp: item.size_jp }
}

function describe(form: CardForm): string {
  const sizes = [form.us && `US ${form.us}`, form.eu && `EU ${form.eu}`].filter(Boolean).join(' · ')
  return [form.model || normalizeOnStyle(form.style) || 'Sin estilo', sizes].filter(Boolean).join(' ')
}

interface OnCaptureProps {
  /** Con false la cámara en vivo se apaga (la pestaña o la marca no están a la vista). */
  active: boolean
}

/** Captura de etiquetas del perfil On: código de barras + foto para el OCR → tarjeta editable → guardar. */
export function OnCapture({ active }: OnCaptureProps) {
  const [items, setItems] = useState<LabelCaptureDTO[]>([])
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState<CardForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<Undo | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<LabelCaptureDTO[]>([])

  const upsert = useCallback((item: LabelCaptureDTO): void => {
    const exists = itemsRef.current.some(i => i.id === item.id)
    itemsRef.current = exists ? itemsRef.current.map(i => (i.id === item.id ? item : i)) : [...itemsRef.current, item]
    setItems(itemsRef.current)
  }, [])

  useEffect(() => {
    void (async () => {
      const r = await request<LabelCaptureList>('/api/label-capture?profile=on')
      if (r.ok) {
        itemsRef.current = r.data.items
        setItems(r.data.items)
      } else {
        setError(errorOf(r.data, 'No se pudo cargar la lista'))
      }
      setLoaded(true)
    })()
  }, [])

  const groups = useMemo(() => groupOnProducts(items), [items])
  const units = useMemo(() => items.reduce((sum, i) => sum + i.units, 0), [items])
  const evaluation = useMemo(
    () => evaluateOn({ ean: form.ean, style: normalizeOnStyle(form.style), gender: normalizeGender(form.gender), us: normalizeShoeSize(form.us), eu: normalizeShoeSize(form.eu) }),
    [form],
  )

  function setField(key: keyof CardForm, value: string): void {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  /** Guarda la tarjeta. Un EAN ya capturado suma 1 a su variante. Conserva los datos de la caja para la siguiente talla. */
  async function submit(data: CardForm): Promise<void> {
    setBusy(true)
    setError('')
    const r = await request<OnCaptureResponse>('/api/label-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: 'on', ...bodyOf(data) } satisfies OnCaptureBody),
    })
    setBusy(false)
    if (!r.ok) {
      setError(errorOf(r.data, 'No se pudo guardar'))
      return
    }
    const { item, added, reasons } = r.data
    upsert(item)
    const label = describe(formOf(item))
    setUndo({ id: item.id, kind: added ? 'added' : 'new', label })
    setMessage(added ? `${label}: +1 (ahora ${item.units})` : `${label}: guardada${reasons.length ? ` · por revisar: ${reasons.join('; ')}` : ''}`)
    setForm(BOX_KEYS.reduce<CardForm>((acc, k) => ({ ...acc, [k]: data[k] }), EMPTY_FORM))
  }

  async function undoLast(): Promise<void> {
    if (!undo) return
    setBusy(true)
    setError('')
    if (undo.kind === 'new') {
      const r = await request<{ ok: boolean }>(`/api/label-capture/${undo.id}`, { method: 'DELETE' })
      if (r.ok) {
        itemsRef.current = itemsRef.current.filter(i => i.id !== undo.id)
        setItems(itemsRef.current)
      } else setError(errorOf(r.data, 'No se pudo deshacer'))
      setBusy(false)
      if (!r.ok) return
    } else {
      const r = await request<{ item: LabelCaptureDTO }>(`/api/label-capture/${undo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_unit: true }),
      })
      setBusy(false)
      if (!r.ok) {
        setError(errorOf(r.data, 'No se pudo deshacer'))
        return
      }
      upsert(r.data.item)
    }
    setMessage(`${undo.label}: deshecho`)
    setUndo(null)
  }

  /** Un código leído: si ya está capturado suma 1 al instante; si no, abre la tarjeta con ese EAN. */
  function onCode(code: string): void {
    if (!EAN_RE.test(code)) {
      setError('Solo se leen códigos EAN-13')
      return
    }
    setError('')
    const known = itemsRef.current.find(i => i.ean === code)
    if (known) {
      void submit(formOf(known))
      return
    }
    setField('ean', code)
    setCameraOn(false)
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const scan = await scanLabel(file)
      const known = scan.ean ? itemsRef.current.find(i => i.ean === scan.ean) : undefined
      if (known) {
        setBusy(false)
        await submit(formOf(known))
        return
      }
      const body = new FormData()
      body.append('file', scan.image, 'etiqueta.jpg')
      body.append('profile', 'on')
      const r = await request<OnOcrResult>('/api/label-capture/ocr', { method: 'POST', body })
      if (!r.ok) setError(`Texto: ${errorOf(r.data, 'no se pudo leer')}`)
      else {
        const o = r.data
        // Solo pisa con lo que el OCR leyó: lo ya escrito a mano no se borra con un campo vacío.
        setForm(prev => ({
          ean: scan.ean ?? prev.ean,
          style: o.estilo || prev.style,
          model: o.modelo || prev.model,
          colorway: o.colorway || prev.colorway,
          gender: o.genero || prev.gender,
          us: o.us || prev.us,
          eu: o.eu || prev.eu,
          uk: o.uk || prev.uk,
          jp: o.jp || prev.jp,
        }))
        if (!scan.ean) setMessage('No se leyó el código de barras: escríbelo o escanéalo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la foto')
    }
    setBusy(false)
  }

  function nextBox(): void {
    setForm(EMPTY_FORM)
    setUndo(null)
    setMessage('')
    setError('')
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Captura de etiquetas · On</h1>
        <p className={styles.subtitle}>Escanea el código de barras y fotografía la etiqueta. Cada EAN es una talla; repetirlo suma 1.</p>
      </header>

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={styles.counters}>
            <div className={styles.counter}>
              <span className={styles.counterValue}>{items.length}</span>
              <span className={styles.counterLabel}>Variantes ({groups.length} productos)</span>
            </div>
            <div className={styles.counter}>
              <span className={styles.counterValue}>{units}</span>
              <span className={styles.counterLabel}>Unidades</span>
            </div>
          </div>

          <input ref={photoRef} className={styles.hiddenInput} type="file" accept="image/*" capture="environment" onChange={e => void onPhoto(e)} />
          <div className={on.actions}>
            <button type="button" className={styles.bigButton} disabled={busy} onClick={() => setCameraOn(v => !v)}>
              <ScanBarcode size={22} /> {cameraOn ? 'Cerrar cámara' : 'Escanear código'}
            </button>
            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => photoRef.current?.click()}>
              <Camera size={20} /> Foto de la etiqueta
            </button>
          </div>
          {cameraOn && active && <BarcodeCamera paused={busy} onCode={onCode} onError={m => { setError(m); setCameraOn(false) }} />}
          {busy && <p className={styles.busy} role="status">Procesando…</p>}

          <div className={on.card} role="group" aria-label="Confirmar etiqueta">
            <label className={on.field}>EAN
              <input className={styles.input} value={form.ean} inputMode="numeric" maxLength={13} placeholder="13 dígitos" onChange={e => setField('ean', e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className={on.field}>Estilo
              <input className={styles.input} value={form.style} autoCapitalize="characters" placeholder="3MD10110001" onChange={e => setField('style', e.target.value)} />
            </label>
            <label className={on.field}>Modelo
              <input className={styles.input} value={form.model} placeholder="Cloudboom Volt" onChange={e => setField('model', e.target.value)} />
            </label>
            <label className={on.field}>Colorway
              <input className={styles.input} value={form.colorway} placeholder="White | Black" onChange={e => setField('colorway', e.target.value)} />
            </label>
            <div className={on.field} role="group" aria-label="Género">
              Género
              <div className={on.genderButtons}>
                {(['M', 'W'] as const).map(g => (
                  <button key={g} type="button" aria-pressed={normalizeGender(form.gender) === g} className={normalizeGender(form.gender) === g ? styles.chipActive : styles.chip} onClick={() => setField('gender', normalizeGender(form.gender) === g ? '' : g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className={on.sizes}>
              {(['us', 'eu', 'uk', 'jp'] as const).map(k => (
                <label key={k} className={on.field}>{k.toUpperCase()}
                  <input className={styles.input} value={form[k]} inputMode="decimal" maxLength={8} onChange={e => setField(k, e.target.value)} />
                </label>
              ))}
            </div>
            {form.ean !== '' && evaluation.reasons.length > 0 && (
              <p className={on.hint} role="status">Irá a revisión: {evaluation.reasons.join('; ')}</p>
            )}
            <div className={on.buttons}>
              <button type="button" className={styles.primaryButton} disabled={busy || !EAN_RE.test(form.ean)} onClick={() => void submit(form)}>
                Guardar
              </button>
              <button type="button" className={styles.secondaryButton} disabled={busy} onClick={nextBox}>
                Siguiente caja
              </button>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && (
            <div className={on.result} role="status">
              <span>{message}</span>
              {undo && <button type="button" className={styles.chip} disabled={busy} onClick={() => void undoLast()}><Undo2 size={16} /> Deshacer</button>}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.toolbar}>
            <a className={styles.chip} href="/api/label-capture/export?profile=on&format=csv" download><Download size={16} /> CSV</a>
            <a className={styles.chip} href="/api/label-capture/export?profile=on&format=json" download><Download size={16} /> JSON</a>
          </div>
          {loaded && groups.length === 0 && <p className={styles.empty}>Aún no hay etiquetas On. Escanea la primera.</p>}
          <ul className={styles.list}>
            {groups.map(g => (
              <li key={g.style || 'sin-estilo'} className={on.product}>
                <div className={on.productHead}>
                  <span className={on.productName}>{g.model_name || 'Sin modelo'}{g.colorway ? ` · ${g.colorway}` : ''}</span>
                  <span className={g.review ? styles.badgeReview : styles.badgeOk}>{g.review ? 'Revisar' : 'OK'}</span>
                </div>
                <span className={on.productStyle}>{g.style || 'sin estilo'}{g.gender ? ` · ${g.gender}` : ''}</span>
                <ul className={on.variants}>
                  {g.variants.map(v => (
                    <li key={v.id} className={on.variant}>
                      <span className={on.variantSize}>{v.size || 'sin talla'}</span>
                      <span className={on.variantEan}>{v.ean}</span>
                      <span className={styles.units}>×{v.units}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
