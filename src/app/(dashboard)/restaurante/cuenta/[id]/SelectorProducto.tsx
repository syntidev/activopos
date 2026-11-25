'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Minus, Plus, Search, X } from 'lucide-react'
import { useToast } from '@/components/ui'
import { callApi } from '@/lib/restaurante-client'
import { formatBs, formatUsd } from '@/lib/restaurante'
import type { AccountDTO, CatalogDTO, CatalogProductDTO, ModifierDTO } from '@/types/restaurante'
import styles from './cuenta.module.css'

interface SelectorProductoProps {
  open: boolean
  accountId: number
  onClose: () => void
  onAdded: (account: AccountDTO) => void
}

const COURSES: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: '1 Entrada' }, { value: 2, label: '2 Fondo' }, { value: 3, label: '3 Postre' },
]
const DECIMAL_MODES = new Set(['weight', 'length', 'volume'])
const NOTE_MAX = 120

/** Opciones de un producto agrupadas por group_name (las sueltas van cada una por su lado). */
function groupModifiers(mods: readonly ModifierDTO[]): Array<{ name: string | null; required: boolean; options: ModifierDTO[] }> {
  const groups: Array<{ name: string | null; required: boolean; options: ModifierDTO[] }> = []
  for (const m of mods) {
    const g = m.group_name !== null ? groups.find(x => x.name === m.group_name) : undefined
    if (g) { g.options.push(m); g.required = g.required || m.required } else groups.push({ name: m.group_name, required: m.required, options: [m] })
  }
  return groups
}

/**
 * Hoja para agregar un ítem a la cuenta: busca el producto, configura cantidad, modificadores, nota y curso.
 * El precio que se muestra es una vista previa; el servidor lo recalcula y es el único que cuenta.
 */
export function SelectorProducto({ open, accountId, onClose, onAdded }: SelectorProductoProps) {
  const { toast } = useToast()
  const ref = useRef<HTMLDialogElement>(null)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<number | null>(null)
  const [catalog, setCatalog] = useState<CatalogDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [product, setProduct] = useState<CatalogProductDTO | null>(null)
  const [qty, setQty] = useState('1')
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set())
  const [note, setNote] = useState('')
  const [course, setCourse] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
    if (!open) { setProduct(null); setQ(''); setCategory(null); setError(null) }
  }, [open])

  // Carta con búsqueda (con un pequeño retraso al escribir).
  useEffect(() => {
    if (!open) return
    const handle = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (category !== null) params.set('category_id', String(category))
      const res = await callApi<CatalogDTO>(`/api/restaurante/productos${params.size ? `?${params}` : ''}`, 'GET')
      setLoading(false)
      if (res.ok) { setCatalog(res.data); setLoadError(null) } else setLoadError(res.error)
    }, q ? 250 : 0)
    return () => clearTimeout(handle)
  }, [open, q, category])

  const decimal = product ? DECIMAL_MODES.has(product.sale_mode) : false
  const quantity = Number(qty.replace(',', '.'))
  const groups = useMemo(() => (product ? groupModifiers(product.modifiers) : []), [product])
  const extras = product ? product.modifiers.filter(m => picked.has(m.id)).reduce((s, m) => s + m.price_usd, 0) : 0
  const unit = product ? product.price_usd + extras : 0
  const total = Math.round(unit * (Number.isFinite(quantity) ? quantity : 0) * 100) / 100
  const rate = catalog?.rate ?? 0

  /** Falta elegir una opción de un grupo obligatorio. */
  const missing = groups.find(g => g.required && !g.options.some(o => picked.has(o.id)))
  const qtyOk = Number.isFinite(quantity) && quantity > 0 && (decimal || Number.isInteger(quantity))

  function choose(p: CatalogProductDTO): void {
    setProduct(p)
    setQty('1')
    setNote('')
    setCourse(1)
    setError(null)
    // Los modificadores sueltos obligatorios ya vienen marcados.
    setPicked(new Set(p.modifiers.filter(m => m.required && m.group_name === null).map(m => m.id)))
  }

  function toggle(g: { name: string | null; required: boolean; options: ModifierDTO[] }, m: ModifierDTO): void {
    setPicked(prev => {
      const next = new Set(prev)
      if (g.name !== null && g.required) {
        for (const o of g.options) next.delete(o.id) // grupo obligatorio: una sola opción
        next.add(m.id)
      } else if (next.has(m.id)) {
        if (!(m.required && g.name === null)) next.delete(m.id)
      } else next.add(m.id)
      return next
    })
  }

  async function add(): Promise<void> {
    if (!product || busy || missing || !qtyOk) return
    setBusy(true)
    setError(null)
    const res = await callApi<{ account: AccountDTO }>(`/api/restaurante/cuentas/${accountId}/items`, 'POST', {
      product_id: product.id, quantity, modifier_ids: Array.from(picked), note: note.trim() || undefined, course,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    toast(`${product.name} agregado`, 'success')
    onAdded(res.data.account)
  }

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="rs-selector-titulo" onClose={onClose} onClick={e => { if (e.target === ref.current) onClose() }}>
      <div className={styles.sheet}>
        <header className={styles.sheetHead}>
          {product && (
            <button type="button" className={styles.iconBtn} onClick={() => setProduct(null)} aria-label="Volver a la lista"><ChevronLeft size={20} aria-hidden="true" /></button>
          )}
          <h2 id="rs-selector-titulo" className={styles.sheetTitle}>{product ? product.name : 'Agregar ítem'}</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
        </header>

        {!product ? (
          <div className={styles.sheetBody}>
            <label className={styles.search}>
              <Search size={16} aria-hidden="true" />
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" maxLength={60} autoComplete="off" />
            </label>
            {catalog && catalog.categories.length > 0 && (
              <div className={styles.chips} role="group" aria-label="Categorías">
                <button type="button" className={`${styles.chip} ${category === null ? styles.chipOn : ''}`} aria-pressed={category === null} onClick={() => setCategory(null)}>Todo</button>
                {catalog.categories.map(c => (
                  <button key={c.id} type="button" className={`${styles.chip} ${category === c.id ? styles.chipOn : ''}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</button>
                ))}
              </div>
            )}
            {loadError && <p className={styles.error} role="alert">{loadError}</p>}
            {!loadError && catalog && catalog.products.length === 0 && !loading && <p className={styles.tip}>No hay productos que coincidan.</p>}
            <ul className={styles.prods}>
              {catalog?.products.map(p => (
                <li key={p.id}>
                  <button type="button" className={styles.prod} onClick={() => choose(p)}>
                    <span><b>{p.name}</b>{p.category_name && <small>{p.category_name}</small>}</span>
                    <span className={styles.amt}>{formatUsd(p.price_usd)}<small>{formatBs(p.price_usd * rate)}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className={styles.sheetBody}>
              <div className={styles.field}><span id="rs-cantidad">Cantidad</span>
                {decimal ? (
                  <input className={styles.input} inputMode="decimal" value={qty} onChange={e => setQty(e.target.value.replace(/[^\d.,]/g, ''))} aria-labelledby="rs-cantidad" />
                ) : (
                  <div className={styles.stepper} role="group" aria-labelledby="rs-cantidad">
                    <button type="button" className={styles.stepBtn} aria-label="Menos" disabled={quantity <= 1} onClick={() => setQty(String(Math.max(1, quantity - 1)))}><Minus size={18} aria-hidden="true" /></button>
                    <output className={styles.stepVal} aria-live="polite">{qty}</output>
                    <button type="button" className={styles.stepBtn} aria-label="Más" disabled={quantity >= 99} onClick={() => setQty(String((Number.isFinite(quantity) ? quantity : 0) + 1))}><Plus size={18} aria-hidden="true" /></button>
                  </div>
                )}
              </div>

              {groups.map(g => (
                <div key={g.name ?? `s${g.options[0].id}`}>
                  {g.name && <p className={styles.lbl}>{g.name}{g.required ? ' (obligatorio)' : ''}</p>}
                  <div className={styles.opts} role={g.name !== null && g.required ? 'radiogroup' : 'group'} aria-label={g.name ?? 'Opciones'}>
                    {g.options.map(m => (
                      <label key={m.id} className={`${styles.opt} ${picked.has(m.id) ? styles.optOn : ''}`}>
                        <span>
                          <input
                            type={g.name !== null && g.required ? 'radio' : 'checkbox'} name={`g-${g.name ?? m.id}`} checked={picked.has(m.id)}
                            disabled={m.required && g.name === null} onChange={() => toggle(g, m)}
                          />
                          {m.name}
                        </span>
                        <b>{m.price_usd > 0 ? `+${formatUsd(m.price_usd)}` : formatUsd(0)}</b>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className={styles.field}><span id="rs-curso">Curso</span>
                <div className={styles.seg} role="radiogroup" aria-labelledby="rs-curso">
                  {COURSES.map(c => (
                    <button key={c.value} type="button" role="radio" aria-checked={course === c.value} className={`${styles.segBtn} ${course === c.value ? styles.segOn : ''}`} onClick={() => setCourse(c.value)}>{c.label}</button>
                  ))}
                </div>
              </div>

              <label className={styles.field}><span>Nota para cocina</span>
                <textarea className={styles.textarea} value={note} maxLength={NOTE_MAX} onChange={e => setNote(e.target.value)} placeholder="Sin cebolla, bien cocido…" />
                <span className={styles.counter}>{note.length}/{NOTE_MAX}</span>
              </label>
              {missing && <p className={styles.tip}>Elige una opción de «{missing.name}» para poder agregar.</p>}
              {error && <p className={styles.error} role="alert">{error}</p>}
            </div>
            <div className={styles.sheetFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || !!missing || !qtyOk} onClick={() => { void add() }}>
                Agregar · {formatUsd(total)} / {formatBs(total * rate)}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
