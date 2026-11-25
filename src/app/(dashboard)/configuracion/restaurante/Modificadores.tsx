'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui'
import { confirmAction } from '@/context/ConfirmContext'
import { callApi } from '@/lib/restaurante-client'
import { formatUsd } from '@/lib/restaurante'
import type { CatalogDTO, CatalogProductDTO, ModifierDTO } from '@/types/restaurante'
import styles from './config.module.css'

type Scope = 'todo' | 'categoria' | 'producto'
const SCOPES: ReadonlyArray<{ value: Scope; label: string }> = [
  { value: 'todo', label: 'Todo el negocio' }, { value: 'categoria', label: 'Una categoría' }, { value: 'producto', label: 'Un producto' },
]

/** Configuración › Restaurante › Modificadores: "Sin cebolla", "Extra queso +$1.00", con grupos y opciones obligatorias. */
export function Modificadores() {
  const { toast } = useToast()
  const [list, setList] = useState<ModifierDTO[] | null>(null)
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [price, setPrice] = useState('0')
  const [required, setRequired] = useState(false)
  const [scope, setScope] = useState<Scope>('todo')
  const [categoryId, setCategoryId] = useState(0)
  const [productQ, setProductQ] = useState('')
  const [found, setFound] = useState<CatalogProductDTO[]>([])
  const [product, setProduct] = useState<CatalogProductDTO | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const [mods, cat] = await Promise.all([
      callApi<{ modificadores: ModifierDTO[] }>('/api/restaurante/modificadores', 'GET'),
      callApi<CatalogDTO>('/api/restaurante/productos', 'GET'),
    ])
    if (mods.ok) setList(mods.data.modificadores); else toast(mods.error, 'error')
    if (cat.ok) setCategories(cat.data.categories)
  }, [toast])

  useEffect(() => { void load() }, [load])

  // Búsqueda de producto para el ámbito "Un producto" (la misma búsqueda del POS).
  useEffect(() => {
    if (scope !== 'producto' || productQ.trim().length < 2) { setFound([]); return }
    const handle = setTimeout(async () => {
      const res = await callApi<CatalogDTO>(`/api/restaurante/productos?q=${encodeURIComponent(productQ.trim())}`, 'GET')
      if (res.ok) setFound(res.data.products.slice(0, 6))
    }, 250)
    return () => clearTimeout(handle)
  }, [scope, productQ])

  const priceNum = Number(price.replace(',', '.'))
  const scopeOk = scope === 'todo' || (scope === 'categoria' && categoryId > 0) || (scope === 'producto' && product !== null)
  const valid = name.trim().length > 0 && Number.isFinite(priceNum) && priceNum >= 0 && scopeOk

  async function create(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const res = await callApi('/api/restaurante/modificadores', 'POST', {
      name: name.trim(), group_name: group.trim() || null, price_usd: priceNum, required,
      ...(scope === 'categoria' ? { category_id: categoryId } : {}), ...(scope === 'producto' && product ? { product_id: product.id } : {}),
    })
    setBusy(false)
    if (!res.ok) { toast(res.error, 'error'); return }
    toast(`«${name.trim()}» agregado`, 'success')
    setName(''); setPrice('0'); setRequired(false)
    await load()
  }

  async function setActive(m: ModifierDTO, active: boolean): Promise<void> {
    const res = await callApi(`/api/restaurante/modificadores/${m.id}`, 'PATCH', { active })
    if (!res.ok) { toast(res.error, 'error'); return }
    await load()
  }

  async function remove(m: ModifierDTO): Promise<void> {
    const ok = await confirmAction({
      title: `Eliminar «${m.name}»`,
      message: 'Las cuentas que ya lo llevan conservan su registro. Si solo quieres dejar de ofrecerlo, desactívalo.',
      confirmLabel: 'Eliminar modificador',
    })
    if (!ok) return
    const res = await callApi(`/api/restaurante/modificadores/${m.id}`, 'DELETE')
    if (!res.ok) { toast(res.error, 'error'); return }
    toast('Modificador eliminado', 'success')
    await load()
  }

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <h2 className={styles.title}>Modificadores</h2>
      </header>

      <form className={styles.card} onSubmit={create} aria-labelledby="rs-mod-nuevo">
        <h3 id="rs-mod-nuevo" className={styles.cardTitle}>Nuevo modificador</h3>
        <div className={styles.grid3}>
          <label className={styles.field}><span>Nombre</span>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Extra queso" autoComplete="off" />
          </label>
          <label className={styles.field}><span>Grupo (opcional)</span>
            <input className={styles.input} value={group} onChange={e => setGroup(e.target.value)} maxLength={60} placeholder="Extras" autoComplete="off" />
          </label>
          <label className={styles.field}><span>Precio extra (USD)</span>
            <input className={styles.input} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} />
          </label>
        </div>
        <div className={styles.field}><span id="rs-mod-ambito">Se ofrece en</span>
          <div className={styles.seg} role="radiogroup" aria-labelledby="rs-mod-ambito">
            {SCOPES.map(s => (
              <button key={s.value} type="button" role="radio" aria-checked={scope === s.value} className={`${styles.segBtn} ${scope === s.value ? styles.segOn : ''}`} onClick={() => setScope(s.value)}>{s.label}</button>
            ))}
          </div>
        </div>
        {scope === 'categoria' && (
          <label className={styles.field}><span>Categoría</span>
            <select className={styles.input} value={categoryId} onChange={e => setCategoryId(Number(e.target.value))}>
              <option value={0}>Elige una categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {scope === 'producto' && (
          <div className={styles.field}><span>Producto</span>
            {product ? (
              <button type="button" className={styles.pick} onClick={() => { setProduct(null); setProductQ('') }}>
                <span>{product.name}</span><span>Cambiar</span>
              </button>
            ) : (
              <>
                <label className={styles.search}><Search size={16} aria-hidden="true" />
                  <input type="search" value={productQ} onChange={e => setProductQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" maxLength={60} autoComplete="off" />
                </label>
                <div className={styles.picks}>
                  {found.map(p => <button key={p.id} type="button" className={styles.pick} onClick={() => setProduct(p)}><span>{p.name}</span><span>{p.category_name ?? ''}</span></button>)}
                </div>
              </>
            )}
          </div>
        )}
        <label className={styles.checkRow}>
          <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
          <span>Obligatorio: hay que elegir una opción de su grupo para poder agregar el ítem</span>
        </label>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || !valid}>Agregar modificador</button>
        <p className={styles.hint}>El precio extra se suma al del producto en cada cuenta; el servidor lo calcula, nunca el teléfono del mesonero.</p>
      </form>

      <section className={styles.card} aria-labelledby="rs-mod-lista">
        <h3 id="rs-mod-lista" className={styles.cardTitle}>Modificadores del negocio</h3>
        {list === null ? (
          <p className={styles.hint}>Cargando…</p>
        ) : list.length === 0 ? (
          <p className={styles.hint}>Aún no hay modificadores. Crea el primero arriba.</p>
        ) : (
          <ul className={styles.list}>
            {list.map(m => (
              <li key={m.id} className={`${styles.row} ${styles.rowTable} ${m.active ? '' : styles.rowOff}`}>
                <div className={styles.rowDetail}>
                  <b>{m.name}</b>{m.required && <> <span className={styles.badge}>Obligatorio</span></>}
                  <div>{m.group_name ? `${m.group_name} · ` : ''}{m.scope_label}</div>
                </div>
                <span className={styles.price}>{m.price_usd > 0 ? `+${formatUsd(m.price_usd)}` : formatUsd(0)}</span>
                <button type="button" role="switch" aria-checked={m.active} aria-label={`${m.name} activo`} className={styles.switchHit} onClick={() => { void setActive(m, !m.active) }}>
                  <span className={`${styles.switch} ${m.active ? styles.switchOn : ''}`} aria-hidden="true" />
                </button>
                <button type="button" className={styles.iconBtn} aria-label={`Eliminar ${m.name}`} onClick={() => { void remove(m) }}><Trash2 size={18} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
