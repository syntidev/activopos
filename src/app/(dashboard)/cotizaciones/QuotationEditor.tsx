'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, X, User, Calendar,
  Package, Save, Send, Loader2, PackagePlus, UserPlus, Percent,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import styles from './editor.module.css'

/* ── Types ── */

interface Client { id: number; name: string; phone?: string | null }

interface Product {
  id: number
  name: string
  base_unit_label: string
  sale_mode: string
  price_per_unit_usd: number | null
}

interface EditorItem {
  key: string
  product_id?: number
  name: string
  qty: string
  price: string
  discount_pct: string
}

interface LoadedQuotation {
  id: number
  number: string
  status: string
  notes: string | null
  valid_until: string | null
  client: Client | null
  items: Array<{
    product_id?: number | null
    name: string
    qty: number
    price_usd: number
    discount_pct?: number | null
  }>
}

/* ── Helpers ── */

const EDITABLE_STATUSES = ['draft', 'sent']

const r2  = (x: number) => Math.round(x * 100) / 100
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0 }
const pct = (s: string) => Math.min(100, Math.max(0, num(s)))

const lineTotal = (it: EditorItem) =>
  r2(num(it.qty) * num(it.price) * (1 - pct(it.discount_pct) / 100))

const fmtBs = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// valid_until llega como ISO del servidor; el input date exige YYYY-MM-DD.
const toDateInput = (iso: string | null) => iso ? iso.slice(0, 10) : ''

/* ── Modal rápido: crear producto ── */

interface NewProductModalProps {
  initialName: string
  onClose: () => void
  onCreated: (p: Product) => void
}

function NewProductModal({ initialName, onClose, onCreated }: NewProductModalProps) {
  const { toast } = useToast()
  const [name, setName]         = useState(initialName)
  const [price, setPrice]       = useState('')
  const [saleMode, setSaleMode] = useState<'unit' | 'weight'>('unit')
  const [saving, setSaving]     = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/products', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:               name.trim(),
          sale_mode:          saleMode,
          base_unit_label:    saleMode === 'weight' ? 'kg' : 'und',
          price_per_unit_usd: num(price),
        }),
      })
      const data = await res.json() as { product?: Product; error?: string }
      if (res.ok && data.product) {
        onCreated(data.product)
        toast(`Producto "${data.product.name}" creado`, 'success')
      } else {
        toast(data.error ?? 'Error al crear el producto', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
      role="dialog" aria-modal="true" aria-label="Crear producto"
    >
      <form className={styles.modal} onSubmit={submit} noValidate>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Crear producto</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose}
            disabled={saving} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.field}>
          <label htmlFor="np-name" className={styles.label}>Nombre *</label>
          <input id="np-name" className={styles.input} value={name} autoFocus
            onChange={e => setName(e.target.value)} maxLength={120} required />
        </div>

        <div className={styles.field}>
          <label htmlFor="np-price" className={styles.label}>Precio USD</label>
          <input id="np-price" className={styles.input} type="number" min="0" step="0.01"
            value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Tipo</span>
          <div className={styles.segmented}>
            <button type="button"
              className={`${styles.segBtn} ${saleMode === 'unit' ? styles.segBtnOn : ''}`}
              onClick={() => setSaleMode('unit')} aria-pressed={saleMode === 'unit'}>
              Por unidad
            </button>
            <button type="button"
              className={`${styles.segBtn} ${saleMode === 'weight' ? styles.segBtnOn : ''}`}
              onClick={() => setSaleMode('weight')} aria-pressed={saleMode === 'weight'}>
              Por peso
            </button>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSec} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPri} disabled={saving || !name.trim()}>
            {saving && <Loader2 size={14} className={styles.spin} aria-hidden="true" />}
            {saving ? 'Creando…' : 'Crear y agregar'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── Modal rápido: crear cliente ── */

interface NewClientModalProps {
  initialName: string
  onClose: () => void
  onCreated: (c: Client) => void
}

function NewClientModal({ initialName, onClose, onCreated }: NewClientModalProps) {
  const { toast } = useToast()
  const [name, setName]     = useState(initialName)
  const [phone, setPhone]   = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      })
      const data = await res.json() as { client?: Client; error?: string }
      if (res.ok && data.client) {
        onCreated(data.client)
        toast(`Cliente "${data.client.name}" creado`, 'success')
      } else {
        toast(data.error ?? 'Error al crear el cliente', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
      role="dialog" aria-modal="true" aria-label="Crear cliente"
    >
      <form className={styles.modal} onSubmit={submit} noValidate>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Crear cliente</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose}
            disabled={saving} aria-label="Cerrar">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.field}>
          <label htmlFor="nc-name" className={styles.label}>Nombre *</label>
          <input id="nc-name" className={styles.input} value={name} autoFocus
            onChange={e => setName(e.target.value)} maxLength={120} required />
        </div>

        <div className={styles.field}>
          <label htmlFor="nc-phone" className={styles.label}>Teléfono</label>
          <input id="nc-phone" className={styles.input} type="tel" value={phone}
            onChange={e => setPhone(e.target.value)} maxLength={20} placeholder="0414-1234567" />
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSec} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPri} disabled={saving || !name.trim()}>
            {saving && <Loader2 size={14} className={styles.spin} aria-hidden="true" />}
            {saving ? 'Creando…' : 'Crear y seleccionar'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── Editor ── */

interface QuotationEditorProps {
  /** undefined → cotización nueva; número → edición de esa cotización */
  quotationId?: number
}

function EditorContent({ quotationId }: QuotationEditorProps) {
  const { toast } = useToast()
  const router    = useRouter()
  const isEdit    = quotationId !== undefined

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [number, setNumber]   = useState('')

  const [items, setItems]      = useState<EditorItem[]>([])
  const [client, setClient]    = useState<Client | null>(null)
  const [validUntil, setValid] = useState('')
  const [notes, setNotes]      = useState('')
  const [rate, setRate]        = useState(0)

  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts]           = useState<Product[]>([])
  const [recent, setRecent]               = useState<Product[]>([])
  const [searching, setSearching]         = useState(false)

  const [clientSearch, setClientSearch] = useState('')
  const [clientSugg, setClientSugg]     = useState<Client[]>([])
  const [showClientDD, setShowClientDD] = useState(false)

  // Ítems con el campo de descuento desplegado a mano (clic en el botón).
  const [discountOpen, setDiscountOpen]     = useState<string[]>([])
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [showNewClient, setShowNewClient]   = useState(false)

  // Claves estables de fila: el índice se rompe al eliminar en el medio.
  const keyRef  = useRef(0)
  const nextKey = () => { keyRef.current += 1; return `it-${keyRef.current}` }

  /* ── Tasa activa ── */
  useEffect(() => {
    fetch('/api/rates/bcv')
      .then(r => r.json())
      .then((j: { rate?: number }) => { if (j.rate) setRate(Number(j.rate)) })
      .catch(() => { /* sin tasa: el editor sigue operando en USD */ })
  }, [])

  /* ── Carga en modo edición ── */
  useEffect(() => {
    if (!isEdit) return
    let alive = true

    async function load() {
      try {
        const res  = await fetch(`/api/quotations/${quotationId}`)
        const data = await res.json() as { quotation?: LoadedQuotation; error?: string }
        if (!alive) return

        if (!res.ok || !data.quotation) {
          toast(data.error ?? 'Cotización no encontrada', 'error')
          router.replace('/cotizaciones')
          return
        }

        const q = data.quotation
        if (!EDITABLE_STATUSES.includes(q.status)) {
          toast('Solo se pueden editar cotizaciones en Borrador o Enviada', 'warning')
          router.replace('/cotizaciones')
          return
        }

        setNumber(q.number)
        setClient(q.client)
        setNotes(q.notes ?? '')
        setValid(toDateInput(q.valid_until))
        setItems(q.items.map(i => ({
          key:          nextKey(),
          product_id:   i.product_id ?? undefined,
          name:         i.name,
          qty:          String(i.qty),
          price:        String(i.price_usd),
          discount_pct: i.discount_pct ? String(i.discount_pct) : '',
        })))
      } catch {
        if (alive) {
          toast('Error al cargar la cotización', 'error')
          router.replace('/cotizaciones')
        }
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId])

  /* ── Recientes: el panel izquierdo no arranca vacío ── */
  useEffect(() => {
    fetch('/api/products/search?q=&limit=8')
      .then(r => r.ok ? r.json() as Promise<{ products?: Product[] }> : { products: [] })
      .then(d => setRecent(d.products ?? []))
      .catch(() => { /* sin recientes: queda la ayuda de búsqueda */ })
  }, [])

  /* ── Búsqueda de productos ── */
  useEffect(() => {
    if (productSearch.trim().length < 2) { setProducts([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=12`)
        if (r.ok) {
          const d = await r.json() as { products?: Product[] }
          setProducts(d.products ?? [])
        }
      } catch {
        /* búsqueda fallida: el panel queda vacío y se puede crear el producto */
      } finally {
        setSearching(false)
      }
    }, 240)
    return () => clearTimeout(t)
  }, [productSearch])

  /* ── Búsqueda de clientes ── */
  useEffect(() => {
    if (clientSearch.trim().length < 2) { setClientSugg([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&limit=5`)
        if (r.ok) {
          const d = await r.json() as { clients?: Client[] }
          setClientSugg(d.clients ?? [])
        }
      } catch { /* ignore */ }
    }, 240)
    return () => clearTimeout(t)
  }, [clientSearch])

  /* ── Ítems ── */

  const addProduct = useCallback((p: Product) => {
    setItems(prev => {
      const hit = prev.find(i => i.product_id === p.id)
      if (hit) {
        return prev.map(i => i.key === hit.key
          ? { ...i, qty: String(r2(num(i.qty) + 1)) }
          : i)
      }
      return [...prev, {
        key:          nextKey(),
        product_id:   p.id,
        name:         p.name,
        qty:          '1',
        price:        p.price_per_unit_usd != null ? String(p.price_per_unit_usd) : '0',
        discount_pct: '',
      }]
    })
    setProductSearch('')
    setProducts([])
  }, [])

  // Pistola de código de barras: mismo hook que usa el POS.
  useHardwareScanner({
    enabled: !loading && !saving && !showNewProduct && !showNewClient,
    onScan:  async (code) => {
      try {
        const r = await fetch(`/api/products?search=${encodeURIComponent(code)}`)
        if (!r.ok) return
        const d = await r.json() as { products?: Product[] }
        const p = d.products?.[0]
        if (p) addProduct(p)
        else toast(`Producto no encontrado: ${code}`, 'error')
      } catch {
        /* el escaneo nunca interrumpe la edición */
      }
    },
  })

  function addFreeItem() {
    setItems(prev => [...prev, {
      key: nextKey(), name: '', qty: '1', price: '0', discount_pct: '',
    }])
  }

  function updateItem(key: string, field: 'name' | 'qty' | 'price' | 'discount_pct', val: string) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: val } : i))
  }

  function stepQty(key: string, delta: number) {
    setItems(prev => prev.map(i => i.key === key
      ? { ...i, qty: String(Math.max(0, r2(num(i.qty) + delta))) }
      : i))
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  /* ── Totales ── */

  const subtotal  = r2(items.reduce((s, i) => s + num(i.qty) * num(i.price), 0))
  const total     = r2(items.reduce((s, i) => s + lineTotal(i), 0))
  const descuento = r2(subtotal - total)
  const totalBs   = r2(total * rate)

  const canSave = items.length > 0 &&
    items.every(i => i.name.trim() !== '' && num(i.qty) > 0 && num(i.price) >= 0)

  /* ── Guardar ── */

  async function save(sendAfter: boolean) {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const payloadItems = items.map(i => ({
        ...(i.product_id ? { product_id: i.product_id } : {}),
        name:      i.name.trim(),
        qty:       num(i.qty),
        price_usd: num(i.price),
        ...(pct(i.discount_pct) > 0 ? { discount_pct: pct(i.discount_pct) } : {}),
      }))

      let id    = quotationId
      let label = number

      if (id === undefined) {
        // POST no acepta null: las claves ausentes se omiten.
        const res = await fetch('/api/quotations', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            ...(client       ? { client_id: client.id }    : {}),
            ...(notes.trim() ? { notes: notes.trim() }     : {}),
            ...(validUntil   ? { valid_until: validUntil } : {}),
            items: payloadItems,
          }),
        })
        const d = await res.json() as { quotation?: { id: number; number: string }; error?: string }
        if (!res.ok || !d.quotation) {
          toast(d.error ?? 'Error al crear la cotización', 'error')
          return
        }
        id    = d.quotation.id
        label = d.quotation.number
      } else {
        // PATCH sí acepta null: así se puede quitar el cliente o la fecha.
        const res = await fetch(`/api/quotations/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            client_id:   client?.id ?? null,
            notes:       notes.trim(),
            valid_until: validUntil || null,
            items:       payloadItems,
          }),
        })
        const d = await res.json() as { error?: string }
        if (!res.ok) {
          toast(d.error ?? 'Error al guardar la cotización', 'error')
          return
        }
      }

      if (sendAfter) {
        const res = await fetch(`/api/quotations/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: 'sent' }),
        })
        if (!res.ok) {
          toast(`${label} se guardó, pero no se pudo marcar como Enviada`, 'warning')
          router.push('/cotizaciones')
          return
        }
      }

      toast(sendAfter ? `${label} guardada y marcada como Enviada` : `${label} guardada`, 'success')
      router.push('/cotizaciones')
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <Loader2 size={18} className={styles.spin} aria-hidden="true" />
          Cargando cotización…
        </div>
      </div>
    )
  }

  const showCreateProduct = productSearch.trim().length >= 2 && !searching && products.length === 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn}
          onClick={() => router.push('/cotizaciones')} aria-label="Volver a cotizaciones">
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div>
          <h1 className={styles.title}>
            {isEdit ? `Editar ${number}` : 'Nueva cotización'}
          </h1>
          <p className={styles.subtitle}>
            {isEdit
              ? 'Los cambios se guardan al presionar Guardar'
              : 'Presupuesto formal para tu cliente'}
          </p>
        </div>
      </header>

      {/* ── Panel izquierdo: catálogo ── */}
      <section className={styles.panel} aria-label="Buscar productos">
        <h2 className={styles.panelTitle}>
          <Package size={12} aria-hidden="true" />
          Catálogo
        </h2>

        <div className={styles.searchRow}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              className={`${styles.input} ${styles.inputPl}`}
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Buscar producto o escanear código…"
              aria-label="Buscar producto"
              autoComplete="off"
            />
          </div>
          <button type="button" className={styles.iconBtn}
            onClick={() => setShowNewProduct(true)}
            aria-label="Crear producto nuevo" title="Crear producto">
            <PackagePlus size={16} aria-hidden="true" />
          </button>
        </div>

        {searching && (
          <div className={styles.hint}>
            <Loader2 size={16} className={styles.spin} aria-hidden="true" />
            Buscando…
          </div>
        )}

        {!searching && products.length > 0 && (
          <ul className={styles.results}>
            {products.map(p => (
              <li key={p.id}>
                <button type="button" className={styles.resultCard} onClick={() => addProduct(p)}>
                  <span className={styles.resultName}>{p.name}</span>
                  <span className={styles.resultPrice}>
                    ${(p.price_per_unit_usd ?? 0).toFixed(2)}
                  </span>
                  <span className={styles.resultUnit}>{p.base_unit_label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {showCreateProduct && (
          <div className={styles.hint}>
            <span>Sin resultados para &ldquo;{productSearch.trim()}&rdquo;</span>
            <button type="button" className={styles.ghostBtn} onClick={() => setShowNewProduct(true)}>
              <Plus size={13} aria-hidden="true" />
              Crear producto
            </button>
          </div>
        )}

        {productSearch.trim().length < 2 && recent.length > 0 && (
          <>
            <h3 className={styles.panelTitle}>Recientes</h3>
            <ul className={styles.results}>
              {recent.map(p => (
                <li key={p.id}>
                  <button type="button" className={styles.resultCard} onClick={() => addProduct(p)}>
                    <span className={styles.resultName}>{p.name}</span>
                    <span className={styles.resultPrice}>
                      ${(p.price_per_unit_usd ?? 0).toFixed(2)}
                    </span>
                    <span className={styles.resultUnit}>{p.base_unit_label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {productSearch.trim().length < 2 && (
          <div className={styles.hint}>
            {recent.length === 0 && (
              <>
                <Search size={20} strokeWidth={1.25} aria-hidden="true" />
                <span>Busca un producto por nombre o escanea su código de barras</span>
              </>
            )}
            <button type="button" className={styles.ghostBtn} onClick={addFreeItem}>
              <Plus size={13} aria-hidden="true" />
              Agregar ítem libre
            </button>
          </div>
        )}
      </section>

      {/* ── Panel derecho: cotización ── */}
      <section className={styles.panel} aria-label="Detalle de la cotización">
        {/* Cliente */}
        <div className={styles.field}>
          <span className={styles.label}>
            <User size={11} aria-hidden="true" />
            Cliente
          </span>
          {client ? (
            <span className={styles.chip}>
              {client.name}
              <button type="button" className={styles.chipRemove}
                onClick={() => setClient(null)} aria-label="Quitar cliente">
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ) : (
            <div className={styles.searchRow}>
              <div className={`${styles.comboWrap} ${styles.searchWrap}`}>
                <input
                  type="text"
                  className={styles.input}
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDD(true) }}
                  onFocus={() => clientSugg.length > 0 && setShowClientDD(true)}
                  onBlur={() => setTimeout(() => setShowClientDD(false), 180)}
                  placeholder="Buscar cliente…"
                  aria-label="Buscar cliente"
                  autoComplete="off"
                />
                {showClientDD && clientSugg.length > 0 && (
                  <ul className={styles.dropdown} role="listbox">
                    {clientSugg.map(c => (
                      <li key={c.id}>
                        <button type="button" className={styles.dropItem}
                          onMouseDown={() => {
                            setClient(c)
                            setClientSearch('')
                            setClientSugg([])
                            setShowClientDD(false)
                          }}>
                          <span>{c.name}</span>
                          {c.phone && <span className={styles.resultUnit}>{c.phone}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className={styles.iconBtn}
                onClick={() => setShowNewClient(true)}
                aria-label="Crear cliente nuevo" title="Crear cliente">
                <UserPlus size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Válida hasta */}
        <div className={styles.field}>
          <label htmlFor="q-valid" className={styles.label}>
            <Calendar size={11} aria-hidden="true" />
            Válida hasta
          </label>
          <input id="q-valid" type="date" className={styles.input}
            value={validUntil} onChange={e => setValid(e.target.value)} />
        </div>

        {/* Ítems */}
        <div className={styles.field}>
          <span className={styles.label}>
            <Package size={11} aria-hidden="true" />
            Ítems ({items.length})
          </span>

          {items.length === 0 ? (
            <p className={styles.emptyItems}>
              Sin ítems todavía. Busca un producto en el panel de la izquierda.
            </p>
          ) : (
            <ul className={styles.items}>
              {items.map(it => (
                <li key={it.key} className={styles.itemRow}>
                  <div className={styles.itemHead}>
                    <input
                      type="text"
                      className={styles.itemName}
                      value={it.name}
                      onChange={e => updateItem(it.key, 'name', e.target.value)}
                      placeholder="Descripción"
                      aria-label="Descripción del ítem"
                      maxLength={120}
                      required
                    />
                    <button type="button" className={styles.removeBtn}
                      onClick={() => removeItem(it.key)}
                      aria-label={`Eliminar ${it.name || 'ítem'}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>

                  <div className={styles.itemControls}>
                    <div className={styles.stepper}>
                      <button type="button" className={styles.stepBtn}
                        onClick={() => stepQty(it.key, -1)}
                        aria-label={`Restar 1 a ${it.name || 'ítem'}`}>
                        <Minus size={13} aria-hidden="true" />
                      </button>
                      <input
                        type="number"
                        className={styles.qtyInput}
                        value={it.qty}
                        onChange={e => updateItem(it.key, 'qty', e.target.value)}
                        min="0" step="any"
                        aria-label="Cantidad"
                      />
                      <button type="button" className={styles.stepBtn}
                        onClick={() => stepQty(it.key, 1)}
                        aria-label={`Sumar 1 a ${it.name || 'ítem'}`}>
                        <Plus size={13} aria-hidden="true" />
                      </button>
                    </div>

                    <label className={styles.field}>
                      <span className={styles.label}>Precio USD</span>
                      <input
                        type="number"
                        className={styles.numInput}
                        value={it.price}
                        onChange={e => updateItem(it.key, 'price', e.target.value)}
                        min="0" step="0.01" placeholder="0.00"
                      />
                    </label>

                    {/* Descuento colapsado: el 99% de los ítems va sin descuento y
                        el campo solo ensuciaba la fila. Se revela con hover/focus
                        (CSS) o con el botón, y queda fijo si el valor es > 0. */}
                    <div className={`${styles.discountSlot} ${
                      pct(it.discount_pct) > 0 || discountOpen.includes(it.key)
                        ? styles.discountOpen : ''
                    }`}>
                      <button
                        type="button"
                        className={styles.discountToggle}
                        onClick={() => setDiscountOpen(prev => [...prev, it.key])}
                        aria-label={`Agregar descuento a ${it.name || 'ítem'}`}
                        title="Descuento"
                      >
                        <Percent size={13} aria-hidden="true" />
                      </button>
                      <label className={styles.discountField}>
                        <span className={styles.label}>Desc. %</span>
                        <input
                          type="number"
                          className={styles.numInput}
                          value={it.discount_pct}
                          onChange={e => updateItem(it.key, 'discount_pct', e.target.value)}
                          min="0" max="100" step="0.01" placeholder="0"
                        />
                      </label>
                    </div>
                  </div>

                  <div className={styles.itemFoot}>
                    <span className={styles.resultUnit}>
                      {num(it.qty)} × ${num(it.price).toFixed(2)}
                      {pct(it.discount_pct) > 0 && ` − ${pct(it.discount_pct)}%`}
                    </span>
                    <span className={styles.itemTotal}>${lineTotal(it).toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Totales */}
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {descuento > 0 && (
            <div className={styles.totalRow}>
              <span>Descuentos</span>
              <span>−${descuento.toFixed(2)}</span>
            </div>
          )}
          <div className={styles.grandRow}>
            <span>Total</span>
            <span className={styles.grandUsd}>${total.toFixed(2)}</span>
          </div>
          <div className={styles.bsRow}>
            <span>Equivalente</span>
            <span>Bs.&nbsp;{fmtBs(totalBs)}</span>
          </div>
          <p className={styles.rateNote}>
            * El monto en Bs es referencial.
            {rate > 0 && ` Tasa usada: Bs. ${fmtBs(rate)} por USD.`}
          </p>
        </div>

        {/* Notas */}
        <div className={styles.field}>
          <label htmlFor="q-notes" className={styles.label}>Notas</label>
          <textarea id="q-notes" className={styles.textarea} value={notes}
            onChange={e => setNotes(e.target.value)} maxLength={2000} rows={3}
            placeholder="Condiciones de pago, observaciones…" />
        </div>

        {/* Acciones */}
        <div className={styles.actions}>
          <button type="button" className={styles.btnSec}
            onClick={() => save(false)} disabled={saving || !canSave}>
            {saving
              ? <Loader2 size={14} className={styles.spin} aria-hidden="true" />
              : <Save size={14} aria-hidden="true" />}
            Guardar borrador
          </button>
          <button type="button" className={styles.btnPri}
            onClick={() => save(true)} disabled={saving || !canSave}>
            {saving
              ? <Loader2 size={14} className={styles.spin} aria-hidden="true" />
              : <Send size={14} aria-hidden="true" />}
            Guardar y enviar
          </button>
        </div>
      </section>

      {showNewProduct && (
        <NewProductModal
          initialName={productSearch.trim()}
          onClose={() => setShowNewProduct(false)}
          onCreated={p => { addProduct(p); setShowNewProduct(false) }}
        />
      )}

      {showNewClient && (
        <NewClientModal
          initialName={clientSearch.trim()}
          onClose={() => setShowNewClient(false)}
          onCreated={c => { setClient(c); setClientSearch(''); setShowNewClient(false) }}
        />
      )}
    </div>
  )
}

export function QuotationEditor({ quotationId }: QuotationEditorProps) {
  return (
    <ToastProvider>
      <EditorContent quotationId={quotationId} />
    </ToastProvider>
  )
}
