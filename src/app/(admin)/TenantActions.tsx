'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

const PLANS = ['trial', 'starter', 'pro'] as const

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
