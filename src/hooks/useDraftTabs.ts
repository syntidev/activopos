'use client'

import { useState, useCallback } from 'react'
import { limpiarTicket } from '@/lib/pos'
import type { TicketState } from '@/lib/pos'

export interface DraftTab {
  id: string
  label: string
  snapshot: TicketState
}

export interface CloseTabResult {
  newTicket: TicketState
  switched: boolean
}

interface UseDraftTabsResult {
  tabs: DraftTab[]
  activeId: string
  switchTo: (targetId: string, current: TicketState) => TicketState
  addTab: (current: TicketState) => TicketState | null
  closeTab: (id: string, current: TicketState) => CloseTabResult | null
}

export function useDraftTabs(rate: number, ivaPct: number): UseDraftTabsResult {
  const initialId = `tab-${Date.now()}`
  const [tabs, setTabs] = useState<DraftTab[]>(() => [
    { id: initialId, label: 'Ticket 1', snapshot: limpiarTicket(rate, ivaPct) },
  ])
  const [activeId, setActiveId] = useState(initialId)

  const switchTo = useCallback((targetId: string, current: TicketState): TicketState => {
    setTabs(prev => prev.map(t => t.id === activeId ? { ...t, snapshot: current } : t))
    setActiveId(targetId)
    return tabs.find(t => t.id === targetId)?.snapshot ?? limpiarTicket(rate, ivaPct)
  }, [tabs, activeId, rate, ivaPct])

  const addTab = useCallback((current: TicketState): TicketState | null => {
    if (tabs.length >= 5) return null
    const newId = `tab-${Date.now()}`
    const num = tabs.length + 1
    const fresh = limpiarTicket(rate, ivaPct)
    setTabs(prev => [
      ...prev.map(t => t.id === activeId ? { ...t, snapshot: current } : t),
      { id: newId, label: `Ticket ${num}`, snapshot: fresh },
    ])
    setActiveId(newId)
    return fresh
  }, [tabs, activeId, rate, ivaPct])

  const closeTab = useCallback((id: string, current: TicketState): CloseTabResult | null => {
    if (tabs.length <= 1) return null
    const isActive = id === activeId
    const idx = tabs.findIndex(t => t.id === id)
    const remaining = tabs.filter(t => t.id !== id)

    if (isActive) {
      const newActive = remaining[Math.max(0, idx - 1)]
      setTabs(remaining)
      setActiveId(newActive.id)
      return { newTicket: newActive.snapshot, switched: true }
    } else {
      setTabs(prev =>
        prev
          .filter(t => t.id !== id)
          .map(t => t.id === activeId ? { ...t, snapshot: current } : t)
      )
      return { newTicket: current, switched: false }
    }
  }, [tabs, activeId])

  return { tabs, activeId, switchTo, addTab, closeTab }
}
