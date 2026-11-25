import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import { PLAN_LIMITS, type PlanTier } from '@/lib/plan-limits'
import { loadSalon } from '@/lib/restaurante-server'
import { rsFontClasses } from '../restaurante/scope'
import { ConfiguracionView } from './ConfiguracionView'

export const metadata = {
  title: 'Configuración — ActivoPOS',
}

interface ConfiguracionPageProps {
  /** ?tab=restaurante abre esa pestaña (lo usa el menú lateral › Restaurante › Configurar). */
  searchParams?: { tab?: string }
}

export default async function ConfiguracionPage({ searchParams }: ConfiguracionPageProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (session.role === 'cashier') {
    redirect('/escritorio')
  }

  // Gate de plan (mismo mecanismo que access_theme) — se resuelve acá, server
  // side, para que la pestaña de Configuración ni se muestre sin el flag, en
  // vez de mostrarla y bloquear recién al guardar.
  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { catalog_plan: true, reservas_enabled: true, catalog_template: true, restaurante_enabled: true },
  })
  const plan = (business?.catalog_plan as PlanTier | null) ?? 'gratis'
  const landingSectionsEnabled = PLAN_LIMITS[plan]?.landing_sections ?? false

  // Pestaña Restaurante: solo existe con el flag del negocio. Sin él no se carga nada del módulo.
  const restauranteEnabled = business?.restaurante_enabled === true
  const salon = restauranteEnabled ? await loadSalon(getTenantPrisma(session.businessId)) : null

  return (
    <ConfiguracionView
      session={session}
      landingSectionsEnabled={landingSectionsEnabled}
      identidadEnabled={PLAN_LIMITS[plan]?.catalog ?? false}
      kitEnabled={business?.reservas_enabled ?? false}
      isCarta={business?.catalog_template === 'carta'}
      restauranteEnabled={restauranteEnabled}
      salon={salon}
      restauranteFontClass={restauranteEnabled ? rsFontClasses : ''}
      initialTab={searchParams?.tab}
    />
  )
}
