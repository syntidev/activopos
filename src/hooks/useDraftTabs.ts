'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { limpiarTicket } from '@/lib/pos'
import type { TicketState, TicketItem } from '@/lib/pos'
import type { SaleMode } from '@/types/products'

export interface DraftTab {
  id:       string   // DB Sale.id as string, or 'local-{ts}' when API unavailable
  label:    string
  snapshot: TicketState
}

export interface CloseTabResult {
  newTicket: TicketState
  switched:  boolean
}

// ── API response shapes ────────────────────────────────────────────────────

interface ApiDraftItem {
  product_id:         number
  product_name:       string
  sale_mode:          string
  unit_label:         string
  quantity:           number
  price_per_unit_usd: number
  subtotal_usd:       number
  subtotal_bs:        number
  rate_used:          number
  discount_usd:       number
  variant_id?:        number | null
}

interface ApiDraft {
  id:           number
  ticket_number:string
  notes:        string | null
  items:        ApiDraftItem[]
}

// ── Converters ────────────────────────────────────────────────────────────

function draftToTicketState(draft: ApiDraft, rate: number, ivaPct: number): TicketState {
  return {
    items: draft.items.map((item): TicketItem => ({
      product_id:         item.product_id,
      product_name:       item.product_name,
      sale_mode:          item.sale_mode as SaleMode,
      unit_label:         item.unit_label,
      quantity:           Number(item.quantity),
      price_per_unit_usd: Number(item.price_per_unit_usd),
      cost_per_unit_usd:  0,
      subtotal_usd:       Number(item.subtotal_usd),
      subtotal_bs:        Number(item.subtotal_bs),
      rate_used:          Number(item.rate_used),
      discount_usd:       Number(item.discount_usd),
      variant_id:         item.variant_id ?? undefined,
      variant_label:      '',
      precio_extra_usd:   0,
    })),
    client_id:           null,
    client_name:         '',
    client_phone:        '',
    notes:               draft.notes ?? '',
    discount_global_pct: 0,
    cargo_global_pct:    0,
    iva_pct:             ivaPct,
    status:              'open',
    rate,
  }
}

function ticketToApiItems(ticket: TicketState) {
  return ticket.items.map(item => ({
    product_id:   item.product_id,
    quantity:     item.quantity,
    variant_id:   item.variant_id,
    discount_usd: item.discount_usd,
  }))
}

// ── API helpers (fire-and-forget or awaited) ───────────────────────────────

function isLocalId(id: string) { return id.startsWith('local-') }

async function postDraft(items: ReturnType<typeof ticketToApiItems> = [], notes?: string): Promise<ApiDraft | null> {
  try {
    const res = await fetch('/api/pos/drafts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ items, notes }),
    })
    if (!res.ok) return null
    const data = await res.json() as { draft: ApiDraft }
    return data.draft
  } catch {
    return null
  }
}

function patchDraft(draftId: string, ticket: TicketState): void {
  if (isLocalId(draftId)) return
  fetch(`/api/pos/drafts/${draftId}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ items: ticketToApiItems(ticket), notes: ticket.notes || undefined }),
  }).catch(() => {})
}

function deleteDraft(draftId: string): void {
  if (isLocalId(draftId)) return
  fetch(`/api/pos/drafts/${draftId}`, { method: 'DELETE' }).catch(() => {})
}

// ── Hook ──────────────────────────────────────────────────────────────────

interface UseDraftTabsResult {
  tabs:            DraftTab[]
  activeId:        string
  loading:         boolean
  switchTo:        (targetId: string, current: TicketState) => TicketState
  addTab:          (current: TicketState) => Promise<TicketState | null>
  closeTab:        (id: string, current: TicketState) => CloseTabResult | null
  paymentComplete: () => Promise<TicketState>
}

export function useDraftTabs(rate: number, ivaPct: number): UseDraftTabsResult {
  const [tabs,     setTabs]     = useState<DraftTab[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading,  setLoading]  = useState(true)
  const initRef = useRef(false)

  // ── Initialization: restore from DB or create first draft ──────────────

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        const res    = await fetch('/api/pos/drafts')
        const data   = res.ok ? await res.json() as { drafts: ApiDraft[] } : { drafts: [] }
        const drafts = data.drafts ?? []

        if (drafts.length > 0) {
          const restored = drafts.map((d, i) => ({
            id:       String(d.id),
            label:    `Ticket ${i + 1}`,
            snapshot: draftToTicketState(d, rate, ivaPct),
          }))
          setTabs(restored)
          setActiveId(restored[0].id)
        } else {
          const fresh   = limpiarTicket(rate, ivaPct)
          const created = await postDraft()
          const id      = created ? String(created.id) : `local-${Date.now()}`
          setTabs([{ id, label: 'Ticket 1', snapshot: fresh }])
          setActiveId(id)
        }
      } catch {
        const id = `local-${Date.now()}`
        setTabs([{ id, label: 'Ticket 1', snapshot: limpiarTicket(rate, ivaPct) }])
        setActiveId(id)
      } finally {
        setLoading(false)
      }
    }

    void init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── switchTo — save current to DB before switching ─────────────────────

  const switchTo = useCallback((targetId: string, current: TicketState): TicketState => {
    setTabs(prev => prev.map(t => t.id === activeId ? { ...t, snapshot: current } : t))
    setActiveId(targetId)
    patchDraft(activeId, current)
    return tabs.find(t => t.id === targetId)?.snapshot ?? limpiarTicket(rate, ivaPct)
  }, [tabs, activeId, rate, ivaPct])

  // ── addTab — create new draft in DB ────────────────────────────────────

  const addTab = useCallback(async (current: TicketState): Promise<TicketState | null> => {
    if (tabs.length >= 5) return null

    // Persist current tab before creating new one
    setTabs(prev => prev.map(t => t.id === activeId ? { ...t, snapshot: current } : t))
    patchDraft(activeId, current)

    const fresh   = limpiarTicket(rate, ivaPct)
    const created = await postDraft()
    if (!created && !isLocalId(activeId)) {
      // Server returned MAX_DRAFTS or error
      return null
    }

    const newId  = created ? String(created.id) : `local-${Date.now()}`
    const num    = tabs.length + 1
    setTabs(prev => [...prev, { id: newId, label: `Ticket ${num}`, snapshot: fresh }])
    setActiveId(newId)
    return fresh
  }, [tabs, activeId, rate, ivaPct])

  // ── closeTab — remove tab + delete from DB ─────────────────────────────

  const closeTab = useCallback((id: string, current: TicketState): CloseTabResult | null => {
    if (tabs.length <= 1) return null
    const isActive  = id === activeId
    const idx       = tabs.findIndex(t => t.id === id)
    const remaining = tabs.filter(t => t.id !== id)

    deleteDraft(id)

    if (isActive) {
      const newActive = remaining[Math.max(0, idx - 1)]
      setTabs(remaining)
      setActiveId(newActive.id)
      return { newTicket: newActive.snapshot, switched: true }
    } else {
      setTabs(
        tabs
          .filter(t => t.id !== id)
          .map(t => t.id === activeId ? { ...t, snapshot: current } : t)
      )
      return { newTicket: current, switched: false }
    }
  }, [tabs, activeId])

  // ── paymentComplete — called after successful payment ──────────────────
  // procesarPago already cleared pos.ticket; this cleans up the draft tab.

  const paymentComplete = useCallback(async (): Promise<TicketState> => {
    const id = activeId
    deleteDraft(id)

    if (tabs.length <= 1) {
      // Only tab — create a fresh draft
      const fresh   = limpiarTicket(rate, ivaPct)
      const created = await postDraft()
      const newId   = created ? String(created.id) : `local-${Date.now()}`
      setTabs([{ id: newId, label: 'Ticket 1', snapshot: fresh }])
      setActiveId(newId)
      return fresh
    }

    // Close active tab, switch to adjacent
    const idx       = tabs.findIndex(t => t.id === id)
    const remaining = tabs.filter(t => t.id !== id)
    const newActive = remaining[Math.max(0, idx - 1)]
    setTabs(remaining)
    setActiveId(newActive.id)
    return newActive.snapshot
  }, [tabs, activeId, rate, ivaPct])

  return { tabs, activeId, loading, switchTo, addTab, closeTab, paymentComplete }
}
