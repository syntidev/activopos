'use client'

import { useState, useEffect } from 'react'
import adminStyles from '../admin.module.css'
import styles from './settings.module.css'

interface TenantRow {
  id:         number
  name:       string
  adminEmail: string | null
  plan:       string
  createdAt:  string
}

function isQaTenant(t: TenantRow): boolean {
  const email = t.adminEmail?.toLowerCase() ?? ''
  return email.includes('@test.local') || email.includes('@example.com') || t.name.startsWith('CLI-')
}

type LoadState = 'loading' | 'error' | 'ready'

export function QaCleanupSection() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [tenants, setTenants]     = useState<TenantRow[]>([])

  useEffect(() => {
    fetch('/api/admin/tenants')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((body: { ok: boolean; tenants: TenantRow[] }) => {
        setTenants((body.tenants ?? []).filter(isQaTenant))
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [])

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Limpieza de datos QA</h2>
      <p className={styles.sectionSubtitle}>
        Tenants con email @test.local / @example.com o nombre que empieza con &quot;CLI-&quot; — solo lectura, limpieza manual en DB
      </p>

      {loadState === 'loading' && <div className={adminStyles.emptyState}>Cargando...</div>}
      {loadState === 'error' && <div className={adminStyles.emptyState}>No se pudo cargar la lista de negocios.</div>}
      {loadState === 'ready' && tenants.length === 0 && (
        <div className={adminStyles.emptyState}>Sin datos de QA detectados.</div>
      )}

      {loadState === 'ready' && tenants.length > 0 && (
        <div className={adminStyles.tableWrap}>
          <table className={adminStyles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Creado</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td className={adminStyles.tdName}>{t.name}</td>
                  <td>{t.adminEmail ?? '—'}</td>
                  <td>{new Date(t.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{t.plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
