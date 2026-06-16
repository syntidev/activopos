import { NextResponse } from 'next/server'
import { getSession, signToken, setSessionCookie } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  await prisma.business.update({
    where: { id: session.businessId },
    data: { onboarding_completed: true },
  })

  // Re-issue token with updated onboardingCompleted flag
  const newToken = await signToken({
    userId: session.userId,
    businessId: session.businessId,
    role: session.role,
    name: session.name,
    onboardingCompleted: true,
  })
  setSessionCookie(newToken)

  return NextResponse.json({ ok: true })
}

// Allow resetting onboarding (from Ayuda → Reiniciar Tour)
export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  await prisma.business.update({
    where: { id: session.businessId },
    data: { onboarding_completed: false },
  })

  const newToken = await signToken({
    userId: session.userId,
    businessId: session.businessId,
    role: session.role,
    name: session.name,
    onboardingCompleted: false,
  })
  setSessionCookie(newToken)

  return NextResponse.json({ ok: true })
}
