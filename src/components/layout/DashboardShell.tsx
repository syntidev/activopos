'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ToastProvider } from '@/components/ui'
import { useRate } from '@/context/RateContext'
import type { SessionUser } from '@/types'
import type { ReactNode } from 'react'
import styles from './DashboardShell.module.css'

interface DashboardShellProps {
  session: SessionUser
  isImpersonating: boolean
  children: ReactNode
}

export function DashboardShell({ session, isImpersonating, children }: DashboardShellProps) {
  const { rate: bcvRate }                   = useRate()
  const [isCollapsed, setIsCollapsed]       = useState(false)
  const [isMobileOpen, setIsMobileOpen]     = useState(false)
  const [enabledModules, setEnabledModules]         = useState<string[] | null>(null)
  const [catalogPlanAllowed, setCatalogPlanAllowed] = useState(true)

  /* ── Fetch enabled modules once on mount ── */
  useEffect(() => {
    fetch('/api/config/business/modules')
      .then(r => r.ok ? r.json() : null)
      .then((j: { modules_enabled?: string[]; catalog_plan_allows?: boolean } | null) => {
        if (Array.isArray(j?.modules_enabled)) setEnabledModules(j!.modules_enabled)
        if (typeof j?.catalog_plan_allows === 'boolean') setCatalogPlanAllowed(j.catalog_plan_allows)
      })
      .catch(() => {})
  }, [])

  /* ── Revalidación en tiempo real: TabModulos (configuración) vive en un
     árbol de componentes separado — sin este listener, un toggle guardado
     ahí no se reflejaba en el sidebar hasta un reload completo. ── */
  useEffect(() => {
    function onModulesUpdated(e: Event) {
      const detail = (e as CustomEvent<string[]>).detail
      if (Array.isArray(detail)) setEnabledModules(detail)
    }
    window.addEventListener('activopos:modules-updated', onModulesUpdated)
    return () => window.removeEventListener('activopos:modules-updated', onModulesUpdated)
  }, [])

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
          catalogPlanAllowed={catalogPlanAllowed}
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
