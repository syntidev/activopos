import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readImpersonation, clearImpersonationCookie } from '@/lib/impersonation'

// Terminar impersonación: solo borra la cookie firmada del propio navegador.
// No requiere guardia — limpiar tu propia cookie es inocuo.
export async function DELETE() {
  const imp = await readImpersonation()
  const session = await getSession()
  if (imp && session) {
    await prisma.activityLog.create({
      data: {
        business_id: imp.businessId,
        user_id:     session.userId,
        action:      'impersonation_end',
        model_type:  'Business',
        model_id:    imp.businessId,
      },
    })
  }

  clearImpersonationCookie()
  return NextResponse.json({ ok: true })
}
