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
  children: ReactNode
}

export function DashboardShell({ session, children }: DashboardShellProps) {
  const [bcvRate, setBcvRate]           = useState<number | null>(null)
  const [isCollapsed, setIsCollapsed]   = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
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

  /* ── BCV polling every 5 min ── */
  useEffect(() => {
    void fetchBcvRate()
    timerRef.current = setInterval(fetchBcvRate, 5 * 60 * 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
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
          bcvRate={bcvRate}
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onCloseMobile={handleCloseMobile}
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
