'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initPulso, setPulsoAttribution, track } from '@/lib/pulso-client'
import { externalReferrerHost, parseUtm } from '@/lib/pulso-attribution'

interface PulsoTrackerProps {
  slug: string
}

const WHATSAPP_PREFIXES = ['https://wa.me/', 'https://api.whatsapp.com/', 'whatsapp://']

export default function PulsoTracker({ slug }: PulsoTrackerProps): null {
  const pathname = usePathname()

  // Sesión + UTM/referrer: una vez al montar el layout (navegación interna no lo remonta).
  useEffect(() => {
    try {
      initPulso(slug)
      setPulsoAttribution({
        ...parseUtm(window.location.search),
        referrer_host: externalReferrerHost(document.referrer, window.location.host),
      })
    } catch {
      // analítica nunca debe romper el catálogo
    }
  }, [slug])

  useEffect(() => {
    track({ type: 'page_view', path: pathname })
  }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      try {
        const target = e.target
        if (!(target instanceof Element)) return
        const href = target.closest('a')?.getAttribute('href')
        if (!href) return
        if (WHATSAPP_PREFIXES.some(p => href.startsWith(p))) track({ type: 'whatsapp_click' })
        else if (href.startsWith('tel:')) track({ type: 'call_click' })
      } catch {
        // analítica nunca debe romper el catálogo
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
