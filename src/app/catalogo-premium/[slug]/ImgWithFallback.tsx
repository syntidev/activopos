'use client'

import { useState, type ReactNode } from 'react'

interface Props {
  src:       string
  className: string
  fallback:  ReactNode
  loading?:  'lazy' | 'eager'
  // Opcionales — el grid principal de productos anima un fade-in on-load
  // (opacity:0 → clase agregada en onLoad/ya-cacheada); el resto de usos
  // (Landing Sections) los omite y se comporta igual que antes.
  onLoad?: (img: HTMLImageElement) => void
  imgRef?: (img: HTMLImageElement | null) => void
}

// Reemplaza el ícono nativo de imagen rota por un fallback elegante (mismo
// criterio que ya usan las cards de producto/colección) — data de prueba con
// paths que 404 mostraba el ícono feo del navegador. `fallback` es JSX libre
// para que cada sección use su propio patrón (letra+fondo, textura, etc).
export function ImgWithFallback({ src, className, fallback, loading, onLoad, imgRef }: Props) {
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
      onLoad={onLoad ? e => onLoad(e.currentTarget) : undefined}
      // Páginas server-renderizadas: el <img src> ya está en el HTML inicial,
      // así que el navegador dispara el fetch (y su error 404) ANTES de que
      // React hidrate y conecte onError — el evento nativo se pierde y la
      // imagen rota se queda ahí para siempre. Al momento de conectar el ref
      // el elemento YA existe con su resultado resuelto: complete=true +
      // naturalWidth=0 es la firma de "ya falló", se detecta acá en vez de
      // depender solo del evento.
      ref={img => {
        if (img?.complete && img.naturalWidth === 0) setBroken(true)
        imgRef?.(img)
      }}
    />
  )
}
