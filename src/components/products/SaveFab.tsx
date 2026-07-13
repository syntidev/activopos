'use client'

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import styles from './SaveFab.module.css'

interface SaveFabProps {
  formId: string
  isSaving: boolean
  disabled?: boolean
}

const SCROLL_THRESHOLD = 200

/**
 * Respaldo de "Guardar" fijo (no sticky) para cuando el usuario ya
 * scrolleó lejos del header del formulario. Escucha el scroll de
 * #main-content (el scroller real del dashboard, ver
 * DashboardShell.module.css .content) en vez de window -- el body
 * no scrollea en el shell del dashboard.
 */
export function SaveFab({ formId, isSaving, disabled = false }: SaveFabProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const scrollRoot = document.getElementById('main-content')
    if (!scrollRoot) return

    const onScroll = () => setVisible(scrollRoot.scrollTop > SCROLL_THRESHOLD)
    onScroll()
    scrollRoot.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollRoot.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="submit"
      form={formId}
      className={`${styles.fab} ${visible ? styles.fabVisible : ''}`}
      disabled={isSaving || disabled}
      aria-label={isSaving ? 'Guardando...' : 'Guardar'}
    >
      {isSaving ? <span className={styles.spinner} aria-hidden="true" /> : <Save size={20} aria-hidden="true" />}
    </button>
  )
}
