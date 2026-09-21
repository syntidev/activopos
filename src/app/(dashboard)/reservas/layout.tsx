import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Puerta del lado servidor de /reservas: si el negocio de la sesión no tiene
 * Business.reservas_enabled, la ruta no existe (404). Esconder el link del
 * sidebar no basta: alguien podría escribir la URL a mano.
 */
export default async function ReservasLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const business = session
    ? await prisma.business.findUnique({
        where:  { id: session.businessId },
        select: { reservas_enabled: true },
      })
    : null

  if (!business?.reservas_enabled) notFound()

  return <>{children}</>
}
