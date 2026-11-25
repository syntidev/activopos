'use client'

import { useEffect, useState } from 'react'
import type { QuotationDocBusiness } from '@/types/quotation-document'

export interface QuotationMeta {
  business: QuotationDocBusiness
  attendedBy: string
}

interface BusinessResponse {
  business?: {
    name: string
    rif: string | null
    address: string | null
    phone: string | null
    email: string | null
    logo_path: string | null
    quotation_footer: string | null
  }
}

interface MeResponse { user?: { name?: string } }

/**
 * Datos reales del negocio y del usuario de la sesión para el documento de cotización.
 * Se cargan ANTES del clic para que window.open ocurra dentro del gesto del usuario.
 */
export function useQuotationMeta(enabled = true): { meta: QuotationMeta | null; error: boolean } {
  const [meta, setMeta] = useState<QuotationMeta | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let active = true
    setError(false)
    Promise.all([
      fetch('/api/config/business').then(r => r.json() as Promise<BusinessResponse>),
      fetch('/api/auth/me').then(r => r.json() as Promise<MeResponse>),
    ])
      .then(([b, m]) => {
        if (!active) return
        if (!b.business || !m.user?.name) { setError(true); return }
        setMeta({
          attendedBy: m.user.name,
          business: {
            name:    b.business.name,
            rif:     b.business.rif,
            address: b.business.address,
            phone:   b.business.phone,
            email:   b.business.email,
            footer:  b.business.quotation_footer,
            logoUrl: b.business.logo_path ? `${window.location.origin}${b.business.logo_path}` : null,
          },
        })
      })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [enabled])

  return { meta, error }
}
