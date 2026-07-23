'use client'

import { useState, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, LogIn, Trash2 } from 'lucide-react'
import { PLAN_LIMITS, PLAN_DISPLAY, type PlanTier } from '@/lib/plan-limits'
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

interface PlanSelectProps {
  tenantId: number
  plan:     string
}

const PLANS = Object.keys(PLAN_LIMITS) as PlanTier[]

export function PlanSelect({ tenantId, plan }: PlanSelectProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newPlan = e.target.value
    if (newPlan === plan) return
    if (!confirm(`¿Cambiar el plan a "${newPlan}"?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: newPlan }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <select
      className={styles.planSelect}
      value={plan}
      onChange={e => void handleChange(e)}
      disabled={loading}
      aria-label="Cambiar plan"
    >
      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  )
}

interface PlanStatusFormProps {
  tenantId:  number
  plan:      string          // catalog_plan
  active:    boolean         // subscription_active (distinto de Business.active del SuspendToggle)
  expiresAt: string | null   // YYYY-MM-DD, null = indefinido
}

/* Sección "Plan y estado" del detalle de tenant. Conecta al endpoint existente
 * tenants/[id]/plan, que escribe catalog_plan + subscription_active +
 * subscription_expires_at. Estado 'active'|'suspended' (el endpoint también
 * acepta 'expired', pero acá el admin solo activa o suspende). */
export function PlanStatusForm({ tenantId, plan: initialPlan, active, expiresAt }: PlanStatusFormProps) {
  const router = useRouter()
  const [plan, setPlan]       = useState<PlanTier>(initialPlan === 'negocio_activo' ? 'negocio_activo' : 'gratis')
  const [status, setStatus]   = useState<'active' | 'suspended'>(active ? 'active' : 'suspended')
  const [expires, setExpires] = useState(expiresAt ?? '')
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/plan`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, status, expires_at: expires || null }),
      })
      if (res.ok) {
        setMsg('Cambios guardados.')
        router.refresh()
      } else {
        setMsg('No se pudo guardar.')
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
      <div className={styles.planStatusActions}>
        <button type="button" className={`${styles.actionLink} ${styles.actionBtn}`}
          onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {msg && <span className={styles.planStatusMsg}>{msg}</span>}
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
