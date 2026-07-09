'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

// El panel admin siempre es dark, sin excepción (mismo patrón que el login
// forzado). Fuerza data-theme="dark" en <html> vía next-themes — necesario
// porque los modales (Modal.tsx) usan Radix Dialog.Portal, que renderiza su
// contenido fuera del árbol React donde vive este layout, así que un
// data-theme puesto en un div local nunca los alcanza. Restaura el tema
// previo al salir para no afectar el dashboard del tenant.
export function ForceDarkTheme() {
  const { theme, setTheme } = useTheme()
  const prevTheme = useRef<string | undefined>(undefined)

  useEffect(() => {
    prevTheme.current = theme
    setTheme('dark')
    return () => {
      if (prevTheme.current) setTheme(prevTheme.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
