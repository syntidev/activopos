'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SidebarCounts {
  pendingOrders: number
  cxpVencidas: number
}

export function useSidebarNotifications(): SidebarCounts {
  const [counts, setCounts] = useState<SidebarCounts>({ pendingOrders: 0, cxpVencidas: 0 })

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/counts')
      if (!res.ok) return
      const data = await res.json() as { pending_orders: number; cxp_vencidas: number }
      setCounts({ pendingOrders: data.pending_orders ?? 0, cxpVencidas: data.cxp_vencidas ?? 0 })
    } catch {
      // non-critical — sidebar stays as-is on error
    }
  }, [])

  useEffect(() => {
    void fetchCounts()
    const interval = setInterval(() => { void fetchCounts() }, 60_000)
    return () => clearInterval(interval)
  }, [fetchCounts])

  return counts
}
