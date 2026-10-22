'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TicketState } from '@/lib/pos'
import { ticketToApiItems } from '@/hooks/useDraftTabs'
import { financingFromColumns, isFinancingLive, patchFinancing } from '@/lib/financing-ui'
import type { BlockedProduct, FinancingAction, FinancingColumns, TicketFinancing } from '@/types/financing'

const RESYNC_DEBOUNCE_MS = 600

class DraftSyncError extends Error {
  constructor(message: string, readonly blocked: BlockedProduct[] = []) {
    super(message)
  }
}

interface DraftPatchResponse {
  draft?: FinancingColumns
  error?: string
  blocked_products?: BlockedProduct[]
}

/** Guarda los ítems del ticket en su borrador (el servidor revalida la elegibilidad de Cashea y degrada 'aprobado'). */
async function syncDraft(draftId: number, ticket: TicketState): Promise<TicketFinancing | null> {
  const res = await fetch(`/api/pos/drafts/${draftId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: ticketToApiItems(ticket), notes: ticket.notes || undefined, price_mode: ticket.price_mode }),
  })
  const data = await res.json().catch(() => null) as DraftPatchResponse | null
  if (!res.ok || !data?.draft) throw new DraftSyncError(data?.error ?? 'No se pudo guardar el ticket.', data?.blocked_products)
  return financingFromColumns(data.draft)
}

interface UseTicketFinancingParams {
  ticket: TicketState
  /** Venta pendiente ya creada (flujo de descuento con PIN): sus ítems están fijados, no se resincronizan. */
  pendingSaleId: number | null
  /** Borrador de la pestaña activa (undefined si es local, sin servidor). */
  draftId: number | undefined
  setFinancing: (financing: TicketFinancing | null) => void
}

/**
 * Cashea en el POS: el estado vive en el ticket (restaurado del borrador), las acciones van a
 * PATCH /api/sales/{id}/financing y, mientras el financiamiento esté vivo, editar ítems guarda el borrador
 * para que el servidor degrade 'aprobado' a 'solicitado' (y el aviso sea verdad).
 */
export function useTicketFinancing({ ticket, pendingSaleId, draftId, setFinancing }: UseTicketFinancingParams) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState<BlockedProduct[]>([])

  const itemsKey = JSON.stringify(ticket.items.map(i => [i.product_id, i.variant_id ?? null, i.quantity, i.discount_usd, i.price_per_unit_usd]))
  // Ítems tal como están guardados en el servidor; cualquier diferencia es una edición sin guardar.
  const savedKey = useRef(itemsKey)
  const status = ticket.financing?.status
  useEffect(() => { savedKey.current = itemsKey }, [draftId, status]) // eslint-disable-line react-hooks/exhaustive-deps

  const saleId = pendingSaleId ?? draftId

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : 'No se pudo cambiar el financiamiento.')
    setBlocked(e instanceof DraftSyncError ? e.blocked : [])
  }, [])

  const act = useCallback(async (action: FinancingAction): Promise<void> => {
    if (saleId === undefined || saleId === null) { setError('Guarda el ticket antes de pedir Cashea.'); return }
    setBusy(true)
    setError('')
    setBlocked([])
    try {
      if (pendingSaleId === null && (action === 'request' || action === 'reopen')) {
        await syncDraft(saleId, ticket)
        savedKey.current = itemsKey
      }
      const result = await patchFinancing('sales', saleId, action)
      if (!result.ok) { setError(result.error ?? 'No se pudo cambiar el financiamiento.'); setBlocked(result.blocked_products ?? []); return }
      setFinancing(result.financing)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }, [saleId, pendingSaleId, ticket, itemsKey, setFinancing, fail])

  // Editar ítems con Cashea vivo: se guarda el borrador (con pausa) y se toma el estado que devuelve el servidor.
  useEffect(() => {
    if (!isFinancingLive(ticket.financing) || pendingSaleId !== null || draftId === undefined || itemsKey === savedKey.current) return
    const timer = setTimeout(() => {
      syncDraft(draftId, ticket)
        .then(f => { savedKey.current = itemsKey; setError(''); setBlocked([]); setFinancing(f) })
        .catch(fail)
    }, RESYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [itemsKey, ticket, pendingSaleId, draftId, setFinancing, fail])

  /**
   * Antes de cobrar con Cashea: deja guardados los ítems y confirma que sigue 'aprobado'. Devuelve la venta a
   * cobrar con PATCH /pay (undefined = sin Cashea, cobro normal). Lanza con el mensaje a mostrar.
   */
  const prepareCobro = useCallback(async (): Promise<number | undefined> => {
    if (!isFinancingLive(ticket.financing)) return undefined
    if (pendingSaleId !== null) return undefined
    if (draftId === undefined) throw new Error('Guarda el ticket antes de cobrar con Cashea.')
    let current: TicketFinancing | null = ticket.financing ?? null
    if (itemsKey !== savedKey.current) {
      current = await syncDraft(draftId, ticket)
      savedKey.current = itemsKey
      setFinancing(current)
    }
    if (current?.status !== 'approved') throw new Error('Cashea volvió a "solicitado" porque cambiaron los ítems. Apruébalo otra vez antes de cobrar.')
    return draftId
  }, [ticket, pendingSaleId, draftId, itemsKey, setFinancing])

  return { busy, error, blocked, act, prepareCobro }
}
