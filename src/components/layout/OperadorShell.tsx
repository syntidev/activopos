'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SessionUser } from '@/types'
import styles from './OperadorShell.module.css'

interface OperadorShellProps {
  session: SessionUser
  children: ReactNode
}

/**
 * Shell mínimo del rol `operador_reservas`: sin sidebar, sin caja, sin tasa ni
 * notificaciones del negocio. Solo el nombre de quien opera y "Salir". Así el
 * operador no ve (ni dispara llamadas a) nada fuera del módulo Reservas.
 */
export function OperadorShell({ session, children }: OperadorShellProps) {
  const router = useRouter()

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }, [router])

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <ClipboardList size={20} aria-hidden="true" />
          <span className={styles.title}>Reservas</span>
        </div>
        <div className={styles.user}>
          <span className={styles.userName}>{session.name}</span>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            Salir
          </button>
        </div>
      </header>
      <main id="main-content" className={styles.content}>
        {children}
      </main>
    </div>
  )
}
