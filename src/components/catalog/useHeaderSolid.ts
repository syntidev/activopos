'use client'

import { useEffect, useState, type RefObject } from 'react'

const SCROLL_THRESHOLD_PX = 8

/** Mayor desplazamiento vertical entre la ventana y los ancestros del header (el scroll vive en `.root`, en `.page` o en la ventana según la ruta). */
function scrollOffset(header: HTMLElement | null): number {
  let max = window.scrollY
  for (let el = header?.parentElement; el; el = el.parentElement) max = Math.max(max, el.scrollTop)
  return max
}

/**
 * ÚNICA fuente de verdad del fondo del header del catálogo premium.
 * - `overHero` = la ruta tiene hero justo debajo (solo la portada): transparente hasta el primer scroll.
 * - Cualquier otra ruta (/tienda, /marca, /p, /200k, /guia): sólido desde el primer píxel.
 * Escucha el scroll en fase de captura (los eventos `scroll` no burbujean), así sirve igual si scrollea la ventana o un contenedor.
 */
export function useHeaderSolid(headerRef: RefObject<HTMLElement>, overHero: boolean): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!overHero) return
    const update = (): void => setScrolled(scrollOffset(headerRef.current) > SCROLL_THRESHOLD_PX)
    update()
    document.addEventListener('scroll', update, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', update, { capture: true })
  }, [headerRef, overHero])
  return !overHero || scrolled
}

/** Sube al tope de la página: el scroll puede vivir en la ventana o en un contenedor ancestro de `desde` (el mismo enlace a la URL actual no hace nada). */
export function subirAlTope(desde: Element | null): void {
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  window.scrollTo({ top: 0, behavior })
  for (let el = desde?.parentElement; el; el = el.parentElement) if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior })
}
