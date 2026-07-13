'use client'

import { useEffect } from 'react'

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prevBody = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    /* En el dashboard el scroll real ocurre dentro de #main-content
       (ver DashboardShell.module.css .content), no en <body> -- bloquear
       solo body dejaba el fondo scrolleable detrás de cualquier modal
       ahí. En páginas sin ese id (marketing/catálogo) el body sigue
       siendo el scroller real y este bloque no hace nada. */
    const scrollRoot = document.getElementById('main-content')
    const prevRoot = scrollRoot?.style.overflow
    if (scrollRoot) scrollRoot.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      if (scrollRoot) scrollRoot.style.overflow = prevRoot ?? ''
    }
  }, [active])
}
