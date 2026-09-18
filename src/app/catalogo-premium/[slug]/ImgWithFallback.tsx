'use client'

import { useState, type ReactNode } from 'react'

interface Props {
  src:       string
  className: string
  fallback:  ReactNode
  loading?:  'lazy' | 'eager'
}

// Reemplaza el ícono nativo de imagen rota por un fallback elegante (mismo
// criterio que ya usan las cards de producto/colección) — data de prueba con
// paths que 404 mostraba el ícono feo del navegador. `fallback` es JSX libre
// para que cada sección use su propio patrón (letra+fondo, textura, etc).
export function ImgWithFallback({ src, className, fallback, loading }: Props) {
  const [broken, setBroken] = useState(false)

  if (broken || !src) return <>{fallback}</>

  return (
    <img
      src={src}
      alt=""
      className={className}
      loading={loading}
      aria-hidden="true"
      onError={() => setBroken(true)}
    />
  )
}
