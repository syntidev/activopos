import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS, type PlanTier } from '@/lib/plan-limits'
import { ConfiguracionView } from './ConfiguracionView'

export const metadata = {
  title: 'Configuración — ActivoPOS',
}

export default async function ConfiguracionPage() {
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
    select: { catalog_plan: true },
  })
  const plan = (business?.catalog_plan as PlanTier | null) ?? 'gratis'
  const landingSectionsEnabled = PLAN_LIMITS[plan]?.landing_sections ?? false

  return <ConfiguracionView session={session} landingSectionsEnabled={landingSectionsEnabled} />
}
