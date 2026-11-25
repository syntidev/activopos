'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChefHat, LogOut, UtensilsCrossed } from 'lucide-react'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/context/ConfirmContext'
import type { SessionUser } from '@/types'
import styles from './OperadorShell.module.css'

interface MeseroShellProps {
  session: SessionUser
  children: ReactNode
  /** 'kitchen' = cocinero (misma carcasa mínima, título y glifo de cocina). */
  variant?: 'waiter' | 'kitchen'
}

/**
 * Shell mínimo del rol `waiter` (mesonero): sin sidebar del negocio, sin caja, tasa del POS ni notificaciones.
 * Solo el nombre de quien atiende y "Salir". El mesonero no ve (ni dispara llamadas a) nada fuera del módulo
 * Restaurante: su lista blanca vive en middleware.ts. Comparte el marco del OperadorShell.
 */
export function MeseroShell({ session, children, variant = 'waiter' }: MeseroShellProps) {
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
    <ToastProvider>
      <ConfirmProvider>
        <div className={styles.root}>
          <header className={styles.header}>
            <div className={styles.brand}>
              {variant === 'kitchen' ? <ChefHat size={20} aria-hidden="true" /> : <UtensilsCrossed size={20} aria-hidden="true" />}
              <span className={styles.title}>{variant === 'kitchen' ? 'Cocina' : 'Salón'}</span>
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
      </ConfirmProvider>
    </ToastProvider>
  )
}
