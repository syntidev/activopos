'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, CameraOff, Images, Search } from 'lucide-react'
import { CODE_RE, formatBs, formatUsd, parseMoney } from '@/lib/quick-add-shared'
import type {
  QuickAddContext,
  QuickAddCreateBody,
  QuickAddLookup,
  QuickAddPatchBody,
  QuickAddProductResult,
  QuickAddedItem,
  TitleHit,
} from '@/types/quick-add'
import { BarcodeCamera } from './BarcodeCamera'
import { QuickAddForm } from './QuickAddForm'
import { QuickAddList, type ItemChange } from './QuickAddList'
import { EMPTY_VALUES, call, errorOf, jsonInit, type FormValues } from './quick-add-client'
import { scanLabel } from './scan'
import base from './captura.module.css'
import styles from './alta.module.css'

type Phase = 'idle' | 'checking' | 'existing' | 'form'

interface ProductResponse {
  product: QuickAddProductResult
  existing?: QuickAddProductResult
}

/** Valores del formulario → cuerpo del POST, o null si algo no es válido todavía. */
function toCreateBody(code: string, v: FormValues): QuickAddCreateBody | null {
  const quantity = Number(v.quantity)
  const price = parseMoney(v.price)
  const wholesale = parseMoney(v.wholesale)
  const wholesaleOk = v.wholesale.trim() === '' || (Number.isFinite(wholesale) && wholesale >= 0)
  if (!v.title.trim() || !Number.isInteger(quantity) || quantity < 1 || !v.categoryId) return null
  if (!Number.isFinite(price) || price <= 0 || !wholesaleOk) return null
  return {
    code,
    name: v.title.trim(),
    quantity,
    category_id: Number(v.categoryId),
    subcategory: v.subcategory.trim() || null,
    price_usd: price,
    wholesale_usd: v.wholesale.trim() === '' ? null : wholesale,
  }
}

/** Reemplaza la fila del producto o la agrega al principio (lo último cargado arriba). */
function withItem(items: QuickAddedItem[], next: QuickAddedItem): QuickAddedItem[] {
  return [next, ...items.filter(i => i.id !== next.id)]
}

export function QuickAdd({ active }: { active: boolean }) {
  const [context, setContext] = useState<QuickAddContext | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [code, setCode] = useState('')
  const [manual, setManual] = useState('')
  const [existing, setExisting] = useState<QuickAddProductResult | null>(null)
  const [restockQty, setRestockQty] = useState('1')
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [items, setItems] = useState<QuickAddedItem[]>([])
  const [cameraOn, setCameraOn] = useState(false)
  const phaseRef = useRef<Phase>('idle')
  const lastDone = useRef('')
  const codeRef = useRef('')
  const photoRef = useRef<HTMLInputElement>(null)

  const goTo = useCallback((next: Phase): void => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  useEffect(() => {
    if (!active) setCameraOn(false)
    if (!active || context) return
    void (async () => {
      const r = await call<QuickAddContext>('/api/quick-add/context')
      if (r.ok) setContext(r.data)
      else setError(errorOf(r.data, 'No se pudo cargar categorías y tasa'))
    })()
  }, [active, context])

  /** Vuelve a "listo para el siguiente". Conserva categoría y subcategoría para la próxima carga. */
  function finish(message: string, remember = true): void {
    lastDone.current = remember ? code : ''
    codeRef.current = ''
    goTo('idle')
    setCode('')
    setManual('')
    setExisting(null)
    setValues(prev => ({ ...EMPTY_VALUES, categoryId: prev.categoryId, subcategory: prev.subcategory }))
    setNotice(message)
  }

  async function resolveCode(raw: string): Promise<void> {
    const next = raw.trim()
    if (!CODE_RE.test(next)) {
      setError('Código inválido: usa de 4 a 50 letras, números o guiones')
      return
    }
    goTo('checking')
    setBusy(true)
    setError('')
    setNotice('')
    setCode(next)
    codeRef.current = next
    const r = await call<QuickAddLookup>(`/api/quick-add/lookup?code=${encodeURIComponent(next)}`)
    setBusy(false)
    if (r.ok && r.data.existing) {
      setExisting(r.data.existing)
      setRestockQty('1')
      goTo('existing')
      return
    }
    if (!r.ok) setError(`${errorOf(r.data, 'No se pudo consultar el código')}. Escribe el título.`)
    const hit: TitleHit | null = r.ok ? r.data.title : null
    setValues(prev => ({ ...prev, title: hit?.title ?? '', titleSource: hit?.source ?? null }))
    goTo('form')
    if (!hit) void completeTitle(next)
  }

  /** Bases públicas (tope de 2 s en el servidor): completan el título solo si responden Y el campo sigue vacío. */
  async function completeTitle(forCode: string): Promise<void> {
    const r = await call<{ title: TitleHit | null }>(`/api/quick-add/title?code=${encodeURIComponent(forCode)}`)
    const hit = r.ok ? r.data.title : null
    if (!hit || codeRef.current !== forCode) return
    setValues(prev => (prev.title.trim() === '' ? { ...prev, title: hit.title, titleSource: hit.source } : prev))
  }

  function onCameraCode(raw: string): void {
    if (phaseRef.current !== 'idle' || raw === lastDone.current || !CODE_RE.test(raw.trim())) return
    lastDone.current = ''
    void resolveCode(raw)
  }

  async function onCodePhoto(file: File): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const scan = await scanLabel(file)
      if (scan.ean) await resolveCode(scan.ean)
      else setError('No se leyó el código de la foto. Escríbelo abajo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la foto')
    }
    setBusy(false)
  }

  async function onTitlePhoto(file: File): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const { image } = await scanLabel(file)
      const form = new FormData()
      form.append('file', image, 'caja.jpg')
      const r = await call<{ title: TitleHit | null }>('/api/quick-add/title-photo', { method: 'POST', body: form })
      if (!r.ok) setError(errorOf(r.data, 'No se pudo leer el título'))
      else if (!r.data.title) setError('No se pudo leer un título en la foto. Escríbelo.')
      else setValues(prev => ({ ...prev, title: r.data.title?.title ?? '', titleSource: 'vision' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la foto')
    }
    setBusy(false)
  }

  async function save(): Promise<void> {
    const body = toCreateBody(code, values)
    if (!body) return
    setBusy(true)
    setError('')
    const r = await call<ProductResponse>('/api/quick-add/products', jsonInit('POST', body))
    setBusy(false)
    if (r.status === 409 && r.data.existing) {
      setExisting(r.data.existing)
      setNotice('Ese código ya existe: suma cantidad en lugar de duplicarlo.')
      goTo('existing')
      return
    }
    if (!r.ok) {
      setError(errorOf(r.data, 'No se pudo guardar'))
      return
    }
    setItems(prev => withItem(prev, { ...r.data.product, kind: 'created', added: body.quantity }))
    finish(`Guardado: ${r.data.product.name}`)
  }

  async function restock(): Promise<void> {
    const n = Number(restockQty)
    if (!existing || !Number.isInteger(n) || n < 1) return
    setBusy(true)
    setError('')
    const r = await call<ProductResponse>(`/api/quick-add/products/${existing.id}`, jsonInit('PATCH', { quantity_delta: n } satisfies QuickAddPatchBody))
    setBusy(false)
    if (!r.ok) {
      setError(errorOf(r.data, 'No se pudo sumar'))
      return
    }
    const prior = items.find(i => i.id === existing.id)
    setItems(prev => withItem(prev, { ...r.data.product, kind: prior?.kind ?? 'restocked', added: (prior?.added ?? 0) + n }))
    finish(`+${n} a ${r.data.product.name} (stock ${r.data.product.stock})`)
  }

  async function saveItem(item: QuickAddedItem, change: ItemChange): Promise<string> {
    const body: QuickAddPatchBody = {
      ...(change.added !== item.added ? { quantity_delta: change.added - item.added } : {}),
      ...(change.price !== item.price_usd ? { price_usd: change.price } : {}),
      ...(change.wholesale !== item.wholesale_usd ? { wholesale_usd: change.wholesale } : {}),
    }
    if (Object.keys(body).length === 0) return ''
    const r = await call<ProductResponse>(`/api/quick-add/products/${item.id}`, jsonInit('PATCH', body))
    if (!r.ok) return errorOf(r.data, 'No se pudo guardar')
    setItems(prev => prev.map(i => (i.id === item.id ? { ...r.data.product, kind: i.kind, added: change.added } : i)))
    return ''
  }

  function onManualSubmit(e: FormEvent): void {
    e.preventDefault()
    lastDone.current = ''
    void resolveCode(manual)
  }

  const rate = context?.rate ?? 0
  const canSave = toCreateBody(code, values) !== null

  return (
    <div className={base.page}>
      <header className={base.header}>
        <h1 className={base.title}>Alta rápida</h1>
        <p className={base.subtitle}>Escanea el código, completa y guarda. Productos sin variantes.</p>
      </header>

      <div className={base.columns}>
        <section className={base.card}>
          {!context && !error && <p className={base.busy} role="status">Cargando categorías y tasa…</p>}

          <div className={base.actions}>
            <button type="button" className={base.bigButton} disabled={!context} onClick={() => setCameraOn(on => !on)}>
              {cameraOn ? <><CameraOff size={22} /> Cerrar cámara</> : <><Camera size={22} /> Escanear con la cámara</>}
            </button>
            <input ref={photoRef} className={base.hiddenInput} type="file" accept="image/*" capture="environment"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onCodePhoto(f) }} />
            <button type="button" className={base.secondaryButton} disabled={busy || !context} onClick={() => photoRef.current?.click()}>
              <Images size={20} /> Foto del código
            </button>
          </div>

          {cameraOn && (
            <BarcodeCamera
              paused={phase !== 'idle'}
              onCode={onCameraCode}
              onError={message => { setCameraOn(false); setError(message) }}
            />
          )}

          <form className={styles.manual} onSubmit={onManualSubmit}>
            <input className={base.input} value={manual} placeholder="Escribir el código a mano" aria-label="Código de barras a buscar"
              inputMode="text" maxLength={50} onChange={e => setManual(e.target.value.trim())} />
            <button type="submit" className={base.primaryButton} disabled={busy || !context || manual === ''}>
              <Search size={18} /> Buscar
            </button>
          </form>

          {busy && <p className={base.busy} role="status">Trabajando…</p>}
          {error && <p className={base.error} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}

          {phase === 'existing' && existing?.has_variants && (
            <div className={styles.existing}>
              <h2 className={base.sectionTitle}>{existing.name}</h2>
              <p className={base.rowMeta} role="status">Este producto tiene variantes; edítalo en Productos</p>
              <div className={base.sheetActions}>
                <button type="button" className={base.secondaryButton} onClick={() => finish('Código descartado', false)}>Otro código</button>
              </div>
            </div>
          )}

          {phase === 'existing' && existing && !existing.has_variants && (
            <div className={styles.existing}>
              <h2 className={base.sectionTitle}>Ya existe: {existing.name}</h2>
              <p className={base.rowMeta}>{existing.barcode} · stock actual: {existing.stock}</p>
              {existing.price_usd !== null && <p className={styles.priceHint}>{formatUsd(existing.price_usd)} · {formatBs(existing.price_usd, rate)}</p>}
              <label className={base.field}>
                <span className={base.label}>Cantidad a sumar</span>
                <input className={base.input} value={restockQty} inputMode="numeric" onChange={e => setRestockQty(e.target.value.replace(/\D/g, ''))} />
              </label>
              <div className={base.sheetActions}>
                <button type="button" className={base.secondaryButton} disabled={busy} onClick={() => finish('Código descartado', false)}>Otro código</button>
                <button type="button" className={base.primaryButton} disabled={busy || !(Number(restockQty) >= 1)} onClick={() => void restock()}>Sumar cantidad</button>
              </div>
            </div>
          )}

          {phase === 'form' && context && (
            <QuickAddForm
              code={code}
              values={values}
              context={context}
              busy={busy}
              canSave={canSave}
              onChange={patch => setValues(prev => ({ ...prev, ...patch }))}
              onTitlePhoto={file => void onTitlePhoto(file)}
              onSave={() => void save()}
              onCancel={() => finish('Código descartado', false)}
            />
          )}
        </section>

        <section className={base.card}>
          <h2 className={base.sectionTitle}>Cargado en esta sesión ({items.length})</h2>
          <QuickAddList items={items} rate={rate} onSave={saveItem} />
        </section>
      </div>
    </div>
  )
}
