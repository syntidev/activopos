import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAuthenticatedTenant } from '@/lib/tenant'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { AccountError } from '@/lib/restaurante-server'
import type { AccountDTO } from '@/types/restaurante'
import { CuentaMesero } from './CuentaMesero'

export const metadata: Metadata = { title: 'Cuenta de mesa' }
export const dynamic = 'force-dynamic'

/** Cuenta de una mesa. El flag lo valida restaurante/layout.tsx; la cuenta se busca solo dentro del negocio de la sesión. */
export default async function CuentaPage({ params }: { params: { id: string } }) {
  const { session, db } = await getAuthenticatedTenant()
  if (session.role === 'kitchen') notFound()
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  let account: AccountDTO
  try {
    account = await loadAccount(db, id)
  } catch (err) {
    if (err instanceof AccountError) notFound()
    throw err
  }
  return <CuentaMesero initial={account} />
}
