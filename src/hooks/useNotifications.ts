'use client'

import { useState, useEffect, useCallback } from 'react'

export interface NotificationItem {
  id:          number
  type:        'credit_vencido' | 'low_stock' | 'info'
  title:       string
  description: string
  created_at:  string
  read:        boolean
}

interface NotificationsState {
  items:       NotificationItem[]
  unread:      number
  loading:     boolean
  markAllRead: () => Promise<void>
  refresh:     () => void
}

export function useNotifications(): NotificationsState {
  const [items,   setItems]   = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const j = await res.json()
      setItems(j.notifications ?? [])
    } catch {
      // API not yet available — silent fail, shows empty state
    } finally {
      setLoading(false)
    }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      setItems(prev => prev.map(n => ({ ...n, read: true })))
    } catch {
      // silent fail
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unread = items.filter(n => !n.read).length

  return { items, unread, loading, markAllRead, refresh: fetchNotifications }
}
