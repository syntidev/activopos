'use client'

import { useState, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { PLAN_LIMITS, type PlanTier } from '@/lib/plan-limits'
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
