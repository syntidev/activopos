'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

interface Props { theme: 'dark' | 'light' }

// Sincroniza el theme guardado en DB (leído server-side en dashboard/layout.tsx)
// hacia next-themes/localStorage al montar — sin esto, next-themes solo lee
// localStorage y una sesión/dispositivo nuevo nunca ve lo que el negocio guardó.
export function ThemeSync({ theme }: Props) {
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme(theme)
  }, [theme, setTheme])

  return null
}
