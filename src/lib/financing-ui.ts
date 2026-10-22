import type {
  BlockedProduct,
  FinancingAction,
  FinancingActionResult,
  FinancingColumns,
  FinancingStatus,
  TicketFinancing,
} from '@/types/financing'

// Etiquetas del contrato (CLI-A las define en lib/ticket-financing.ts, que importa Prisma y no puede ir al cliente).
export const FINANCING_STATUS_LABEL: Record<FinancingStatus, string> = {
  requested: 'Solicitado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

export const ITEMS_EDIT_WARNING = 'Cambiar los ítems de un pedido aprobado por Cashea exige aprobarlo otra vez.'
export const TICKET_ITEMS_EDIT_WARNING = 'Cambiar los ítems de un ticket aprobado por Cashea exige aprobarlo otra vez.'
export const FINANCING_BCV_NOTE = 'Cashea se paga siempre al precio BCV completo; el precio Divisa no aplica.'

const isStatus = (v: string | null | undefined): v is FinancingStatus =>
  v === 'requested' || v === 'approved' || v === 'rejected'

/** Pide o ya tiene financiamiento vivo (bloquea Divisa y obliga a cobrar con la financiadora). 'rejected' libera. */
export const isFinancingLive = (f: TicketFinancing | null | undefined): boolean =>
  f?.status === 'requested' || f?.status === 'approved'

export function financingFromColumns(c: FinancingColumns): TicketFinancing | null {
  if (!isStatus(c.financing_status)) return null
  return {
    status: c.financing_status,
    status_label: FINANCING_STATUS_LABEL[c.financing_status],
    provider: c.financing_provider ?? null,
    phrase: c.financing_phrase ?? null,
  }
}

interface ActionResponse {
  ticket?: { financing?: TicketFinancing | null }
  error?: string
  blocked_products?: BlockedProduct[]
}

/**
 * PATCH /api/{sales|orders}/{id}/financing. El error del 409 viaja tal cual (en español) junto con los
 * productos que impiden el financiamiento.
 */
export async function patchFinancing(kind: 'sales' | 'orders', id: number, action: FinancingAction): Promise<FinancingActionResult> {
  try {
    const res = await fetch(`/api/${kind}/${id}/financing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => null) as ActionResponse | null
    if (!res.ok || !data?.ticket) {
      return { ok: false, financing: null, error: data?.error ?? 'No se pudo cambiar el financiamiento.', blocked_products: data?.blocked_products }
    }
    return { ok: true, financing: data.ticket.financing ?? null }
  } catch {
    return { ok: false, financing: null, error: 'Error de conexión. Intenta de nuevo.' }
  }
}
