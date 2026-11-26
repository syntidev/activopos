'use client'

import { useState, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, LogIn, Trash2 } from 'lucide-react'
import { ADDON_DISPLAY, ADDON_KEYS, PLAN_LIMITS, PLAN_DISPLAY, type AddonKey, type PlanTier } from '@/lib/plan-limits'
import type { PlanGetResponse, PlanPatchResponse, TenantPlanState } from '@/types/plan'
import styles from './admin.module.css'

interface SuspendToggleProps {
  tenantId: number
  active:   boolean
}

export function SuspendToggle({ tenantId, active }: SuspendToggleProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const verb = active ? 'suspender' : 'activar'
    if (!confirm(`¿Seguro que quieres ${verb} este negocio?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ active: !active }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={`${styles.actionLink} ${styles.actionBtn} ${active ? styles.actionDanger : ''}`}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? '...' : active ? 'Suspender' : 'Activar'}
    </button>
  )
}

const PLANS = Object.keys(PLAN_LIMITS) as PlanTier[]

interface PlanStatusFormProps {
  tenantId:  number
  plan:      string          // catalog_plan
  active:    boolean         // subscription_active (distinto de Business.active del SuspendToggle)
  expiresAt: string | null   // YYYY-MM-DD, null = indefinido
  catalogActive: boolean     // businesses.catalog_active: valor REAL de la DB
  /** Add-ons contratados (derecho: solo lo escribe el super_admin desde este formulario). */
  addons:        AddonKey[]
  /** ¿Hoy hay derecho a KDS (nivel o add-on)? Base para saber si un guardado lo QUITA. */
  kdsEntitled:   boolean
  /** Pedidos abiertos en cocina al cargar la página. */
  openKdsOrders: number
}

/* Sección "Plan y estado" del detalle de tenant. Conecta al endpoint
 * tenants/[id]/plan, que escribe catalog_plan + subscription_active +
 * subscription_expires_at + add-ons. Estado 'active'|'suspended' (el endpoint también
 * acepta 'expired', pero acá el admin solo activa o suspende).
 * Planes v2: los add-ons van en ESTE formulario con UN solo botón (sin switches que guardan solos), el cliente envía el conjunto
 * ABSOLUTO deseado y, tras guardar, todo se rehidrata de la respuesta canónica del servidor (sin actualización optimista). */
export function PlanStatusForm({ tenantId, plan: initialPlan, active, expiresAt, catalogActive, addons: initialAddons, kdsEntitled, openKdsOrders }: PlanStatusFormProps) {
  const router = useRouter()
  const [published, setPublished] = useState(catalogActive)
  const [plan, setPlan]       = useState<PlanTier>(PLANS.includes(initialPlan as PlanTier) ? (initialPlan as PlanTier) : 'gratis')
  const [status, setStatus]   = useState<'active' | 'suspended'>(active ? 'active' : 'suspended')
  const [expires, setExpires] = useState(expiresAt ?? '')
  const [addons, setAddons]   = useState<AddonKey[]>(initialAddons)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<string | null>(null)
  // Último estado canónico GUARDADO (del servidor): base para saber qué cambió y si el guardado quita KDS.
  const [saved, setSaved]     = useState({ published: catalogActive, kdsEntitled, open: openKdsOrders })
  // Conteo de pedidos abiertos en cocina que el admin debe confirmar antes de quitar KDS (null = sin confirmación pendiente).
  const [confirmKds, setConfirmKds] = useState<number | null>(null)

  const toggleAddon = (k: AddonKey): void => {
    setConfirmKds(null)
    setAddons(prev => (prev.includes(k) ? prev.filter(a => a !== k) : ADDON_KEYS.filter(x => x === k || prev.includes(x))))
  }

  // ¿Este guardado QUITA el derecho a KDS? Sí si hoy lo hay y ni el nivel elegido ni el add-on lo mantienen.
  const quitaKds = saved.kdsEntitled && !(PLAN_LIMITS[plan].kds || addons.includes('kds'))

  async function leerEstado(): Promise<TenantPlanState | null> {
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/plan`)
      return res.ok ? ((await res.json()) as PlanGetResponse).business : null
    } catch {
      return null
    }
  }

  // Si el guardado quita KDS se lee el conteo ACTUAL de pedidos abiertos en cocina: con alguno, se muestra y se pide confirmación.
  async function handleSave() {
    setMsg(null)
    if (!quitaKds) { await guardar(); return }
    setSaving(true)
    const fresh = await leerEstado()
    setSaving(false)
    if (!fresh) { setMsg('No se pudo verificar los pedidos abiertos en cocina. Intenta de nuevo.'); return }
    setSaved(s => ({ ...s, open: fresh.open_kds_orders }))
    if (fresh.open_kds_orders > 0) { setConfirmKds(fresh.open_kds_orders); return }
    await guardar()
  }

  async function guardar() {
    setConfirmKds(null)
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/plan`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // El interruptor solo viaja si el admin lo movió: si no, el servidor decide (plan con catálogo + Activo = publicar).
        // addons = conjunto ABSOLUTO deseado (nunca "alternar").
        body:    JSON.stringify({ plan, status, expires_at: expires || null, addons, ...(published !== saved.published ? { catalog_active: published } : {}) }),
      })
      if (res.ok) {
        const out = await res.json() as PlanPatchResponse
        const b = out.business
        // Rehidratar SOLO desde la respuesta canónica del servidor.
        setPlan(b.catalog_plan)
        setStatus(b.subscription_active ? 'active' : 'suspended')
        setExpires(b.subscription_expires_at ?? '')
        setPublished(b.catalog_active)
        setAddons(b.addons)
        setSaved({ published: b.catalog_active, kdsEntitled: b.entitlements.kds, open: b.open_kds_orders })
        setMsg(out.addons_changed ? 'Cambios guardados. Add-ons actualizados.' : out.catalog_published_auto ? 'Cambios guardados. Catálogo publicado.' : 'Cambios guardados.')
        router.refresh()
      } else {
        const err = await res.json().catch(() => null) as { error?: string } | null
        setMsg(err?.error ?? 'No se pudo guardar.')
      }
    } catch {
      setMsg('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.planStatusForm}>
      <div className={styles.planStatusField}>
        <label className={styles.infoLabel} htmlFor="ps-plan">Plan actual</label>
        <select id="ps-plan" className={styles.planSelect} value={plan}
          onChange={e => setPlan(e.target.value as PlanTier)} disabled={saving}>
          {PLANS.map(p => <option key={p} value={p}>{PLAN_DISPLAY[p]}</option>)}
        </select>
      </div>
      <div className={styles.planStatusField}>
        <label className={styles.infoLabel} htmlFor="ps-status">Estado</label>
        <select id="ps-status" className={styles.planSelect} value={status}
          onChange={e => setStatus(e.target.value as 'active' | 'suspended')} disabled={saving}>
          <option value="active">Activo</option>
          <option value="suspended">Suspendido</option>
        </select>
      </div>
      <div className={styles.planStatusField}>
        <label className={styles.infoLabel} htmlFor="ps-expires">Vence suscripción</label>
        <input id="ps-expires" type="date" className={styles.planSelect} value={expires}
          onChange={e => setExpires(e.target.value)} disabled={saving} />
        <span className={styles.planStatusHint}>Vacío = plan indefinido (no vence).</span>
      </div>
      <div className={styles.planStatusField}>
        <span className={styles.infoLabel} id="ps-published-label">Catálogo publicado</span>
        <button id="ps-published" type="button" role="switch" aria-checked={published} aria-labelledby="ps-published-label"
          className={`${styles.publishSwitch} ${published ? styles.publishSwitchOn : ''}`}
          onClick={() => setPublished(v => !v)} disabled={saving}>
          {published ? 'Publicado' : 'Apagado'}
        </button>
        <span className={styles.planStatusHint}>Apagado = /c/[slug] da &quot;no disponible&quot;.</span>
      </div>
      <div className={styles.planStatusField}>
        <span className={styles.infoLabel} id="ps-addons-label">Add-ons</span>
        <div className={styles.addonList} role="group" aria-labelledby="ps-addons-label" data-testid="ps-addons">
          {ADDON_KEYS.map(k => (
            <label key={k} className={styles.addonItem}>
              <input type="checkbox" data-testid={`ps-addon-${k}`} checked={addons.includes(k)} onChange={() => toggleAddon(k)} disabled={saving} />
              <span>{ADDON_DISPLAY[k]}</span>
            </label>
          ))}
        </div>
        <span className={styles.planStatusHint}>Se guarda con «Guardar cambios». KDS ya viene incluido en {PLAN_DISPLAY.operacion}.</span>
      </div>
      {confirmKds !== null && (
        <div className={styles.addonConfirm} role="alertdialog" aria-label="Confirmar quitar KDS" data-testid="ps-kds-confirm">
          <p>
            Hay <strong data-testid="ps-kds-count">{confirmKds}</strong> pedido{confirmKds === 1 ? '' : 's'} abierto{confirmKds === 1 ? '' : 's'} en la cocina (KDS).
            Al quitar el KDS, deja de funcionar al usarlo y esos pedidos dejan de verse en la pantalla de cocina. No se borra ningún dato.
          </p>
          <div className={styles.addonConfirmActions}>
            <button type="button" className={`${styles.actionLink} ${styles.actionBtn} ${styles.actionDanger}`} onClick={() => void guardar()} disabled={saving} data-testid="ps-kds-confirm-ok">
              Confirmar y guardar
            </button>
            <button type="button" className={`${styles.actionLink} ${styles.actionBtn}`} onClick={() => setConfirmKds(null)} disabled={saving}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <div className={styles.planStatusActions}>
        <button type="button" className={`${styles.actionLink} ${styles.actionBtn}`} data-testid="ps-guardar"
          onClick={() => void handleSave()} disabled={saving || confirmKds !== null}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {msg && <span className={styles.planStatusMsg} role="status" data-testid="ps-msg">{msg}</span>}
      </div>
    </div>
  )
}

interface ImpersonateButtonProps {
  tenantId:   number
  tenantName: string
}

export function ImpersonateButton({ tenantId, tenantName }: ImpersonateButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!confirm(`¿Entrar al panel de "${tenantName}" como administrador?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/impersonate/${tenantId}`, { method: 'POST' })
      if (res.ok) {
        router.push('/escritorio')
        router.refresh()
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={`${styles.actionLink} ${styles.actionBtn}`}
      onClick={handleClick}
      disabled={loading}
    >
      <LogIn size={14} aria-hidden="true" />
      {loading ? 'Entrando...' : 'Entrar como cliente'}
    </button>
  )
}

interface DeleteTenantButtonProps {
  tenantId:   number
  tenantName: string
}

/* Baja definitiva. El endpoint hace hard delete de todo el tenant y de sus
 * archivos, así que la confirmación nombra al negocio: en una tabla de 20 filas
 * un "¿seguro?" genérico no dice cuál se está por borrar. */
export function DeleteTenantButton({ tenantId, tenantName }: DeleteTenantButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!confirm(`¿Eliminar "${tenantName}"? Esta acción no se puede deshacer.`)) return

    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' })
      const data = await res.json() as { error?: string; orphanDirs?: string[] }
      if (res.ok) {
        if (data.orphanDirs?.length) {
          alert(`Negocio eliminado, pero quedaron archivos sin borrar:\n${data.orphanDirs.join('\n')}`)
        }
        router.refresh()
      } else {
        alert(data.error ?? 'No se pudo eliminar el negocio')
        setLoading(false)
      }
    } catch {
      alert('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={`${styles.actionLink} ${styles.actionBtn} ${styles.actionDanger}`}
      onClick={handleClick}
      disabled={loading}
      aria-label={`Eliminar ${tenantName}`}
    >
      <Trash2 size={14} aria-hidden="true" />
      {loading ? 'Eliminando...' : 'Eliminar'}
    </button>
  )
}

export function BusinessFilters() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [q, setQ] = useState(searchParams.get('q') ?? '')

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQ(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateParams({ q: value }), 350)
  }

  return (
    <div className={styles.filterBar}>
      <div className={styles.searchField}>
        <Search size={14} aria-hidden="true" />
        <input
          type="text"
          value={q}
          onChange={handleSearchChange}
          placeholder="Buscar por nombre..."
          aria-label="Buscar negocio por nombre"
        />
      </div>
      <select
        className={styles.planSelect}
        value={searchParams.get('plan') ?? ''}
        onChange={e => updateParams({ plan: e.target.value })}
        aria-label="Filtrar por plan"
      >
        <option value="">Todos los planes</option>
        {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  )
}
