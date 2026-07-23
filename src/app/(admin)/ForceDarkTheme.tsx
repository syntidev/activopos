'use client'

import { useEffect } from 'react'

// El panel admin siempre es dark, sin excepción (mismo patrón que el login
// forzado). Fuerza data-theme="dark" directo en <html> — necesario porque los
// modales (Modal.tsx) usan Radix Dialog.Portal, que renderiza su contenido
// fuera del árbol React donde vive este layout, así que un data-theme puesto
// en un div local nunca los alcanza. No usa next-themes/setTheme: eso escribe
// localStorage global y el cleanup no siempre corre en navegación client-side,
// dejando el resto del sistema pegado en dark. Al desmontar, restaura desde
// localStorage (fuente real del tema del tenant) en vez de un ref en memoria.
export function ForceDarkTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    return () => {
      const saved = localStorage.getItem('activopos-theme')
      document.documentElement.setAttribute('data-theme', saved ?? 'light')
    }
  }, [])

  return null
}
