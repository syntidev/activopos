import { NextResponse } from 'next/server'
import { clearImpersonationCookie } from '@/lib/impersonation'

// Terminar impersonación: solo borra la cookie firmada del propio navegador.
// No requiere guardia — limpiar tu propia cookie es inocuo.
export async function DELETE() {
  clearImpersonationCookie()
  return NextResponse.json({ ok: true })
}
