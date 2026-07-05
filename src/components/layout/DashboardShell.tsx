'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ToastProvider } from '@/components/ui'
import type { SessionUser } from '@/types'
import type { ReactNode } from 'react'
import styles from './DashboardShell.module.css'

interface DashboardShellProps {
  session: SessionUser
  isImpersonating: boolean
  children: ReactNode
}

export function DashboardShell({ session, isImpersonating, children }: DashboardShellProps) {
  const [bcvRate, setBcvRate]               = useState<number | null>(null)
  const [isCollapsed, setIsCollapsed]       = useState(false)
  const [isMobileOpen, setIsMobileOpen]     = useState(false)
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchBcvRate = useCallback(async () => {
    try {
      const res = await fetch('/api/rates/bcv')
      if (res.ok) {
        const data = await res.json() as { rate?: number }
        if (data.rate) setBcvRate(data.rate)
      }
    } catch {
      /* keep previous rate on failure */
    }
  }, [])

  /* ── Fetch enabled modules once on mount ── */
  useEffect(() => {
    fetch('/api/config/business/modules')
      .then(r => r.ok ? r.json() : null)
      .then((j: { modules_enabled?: string[] } | null) => {
        if (Array.isArray(j?.modules_enabled)) setEnabledModules(j!.modules_enabled)
      })
      .catch(() => {})
  }, [])

  /* Polling 30s + refetch al volver al tab/ventana — alimenta el pill USD/VES
     del footer del Sidebar. Antes: 5 min sin refetch en focus, por lo que
     cambiar la tasa (Configuración o modal del Header) no se reflejaba aquí
     hasta la siguiente vuelta del timer o un reload manual. */
  useEffect(() => {
    void fetchBcvRate()
    timerRef.current = setInterval(fetchBcvRate, 30_000)
    const handleFocus = () => { void fetchBcvRate() }
    window.addEventListener('focus', handleFocus)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchBcvRate])

  /* ── Close mobile drawer on desktop resize ── */
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setIsMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleToggleCollapse = useCallback(() => setIsCollapsed((v) => !v), [])
  const handleToggleMobile   = useCallback(() => setIsMobileOpen((v) => !v), [])
  const handleCloseMobile    = useCallback(() => setIsMobileOpen(false), [])

  return (
    <ToastProvider>
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      <div className={styles.root}>
        <Sidebar
          session={session}
          isImpersonating={isImpersonating}
          bcvRate={bcvRate}
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onCloseMobile={handleCloseMobile}
          enabledModules={enabledModules}
        />

        {isMobileOpen && (
          <div
            className={styles.mobileOverlay}
            onClick={handleCloseMobile}
            aria-hidden="true"
          />
        )}

        <div className={`${styles.mainWrapper} ${isCollapsed ? styles.mainCollapsed : ''}`}>
          <Header
            session={session}
            bcvRate={bcvRate}
            isCollapsed={isCollapsed}
            onToggleCollapse={handleToggleCollapse}
            onToggleMobile={handleToggleMobile}
          />
          <main id="main-content" className={styles.content}>
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
