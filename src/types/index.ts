export type { SessionPayload as SessionUser } from '@/lib/auth'

export type UserRole = 'super_admin' | 'admin' | 'cashier'

export interface ClientRecord {
  id: number
  name: string
  cedula: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_at: Date
  pending_balance_usd: number
}

export interface SaleHistoryItem {
  id: number
  ticket_number: string
  status: 'quote' | 'pending' | 'paid' | 'cancelled'
  total_usd: number
  total_bs: number
  rate_used: number
  sold_at: Date | null
  created_at: Date
  abonos: Array<{ id: number; amount_usd: number; created_at: Date; notes: string | null }>
  balance_remaining: number
}

export interface ClientHistory {
  client: { id: number; name: string; cedula: string | null; phone: string | null; pending_balance_usd: number }
  sales: SaleHistoryItem[]
}
