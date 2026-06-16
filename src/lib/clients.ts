import { prisma } from './prisma'
import type { ClientRecord, ClientHistory, SaleHistoryItem } from '@/types'

export async function getClientsWithBalance(businessId: number): Promise<ClientRecord[]> {
  type PendingRow = { client_id: number; pending_usd: string }
  type AbonoRow  = { client_id: number; abonos_usd: string }

  const [clients, pendingRows, abonoRows] = await Promise.all([
    prisma.client.findMany({
      where: { business_id: businessId, is_active: true },
      orderBy: { name: 'asc' },
      select: {
        id:         true,
        name:       true,
        cedula:     true,
        phone:      true,
        email:      true,
        notes:      true,
        created_at: true,
      },
    }),
    prisma.$queryRaw<PendingRow[]>`
      SELECT client_id, SUM(total_usd) AS pending_usd
      FROM sales
      WHERE business_id = ${businessId}
        AND status = 'pending'
        AND client_id IS NOT NULL
      GROUP BY client_id
    `,
    prisma.$queryRaw<AbonoRow[]>`
      SELECT s.client_id, SUM(sa.amount_usd) AS abonos_usd
      FROM sale_abonos sa
      JOIN sales s ON s.id = sa.sale_id
      WHERE s.business_id = ${businessId}
        AND s.status = 'pending'
        AND s.client_id IS NOT NULL
      GROUP BY s.client_id
    `,
  ])

  const pendingMap = new Map(pendingRows.map((r) => [r.client_id, parseFloat(r.pending_usd) || 0]))
  const abonosMap  = new Map(abonoRows.map((r) => [r.client_id, parseFloat(r.abonos_usd) || 0]))

  return clients.map((c) => ({
    ...c,
    pending_balance_usd: Math.max(
      0,
      (pendingMap.get(c.id) ?? 0) - (abonosMap.get(c.id) ?? 0)
    ),
  }))
}

export async function getClientHistory(
  clientId: number,
  businessId: number
): Promise<ClientHistory | null> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, business_id: businessId, is_active: true },
    select: { id: true, name: true, cedula: true, phone: true },
  })

  if (!client) return null

  const salesRaw = await prisma.sale.findMany({
    where: { client_id: clientId, business_id: businessId },
    orderBy: { created_at: 'desc' },
    select: {
      id:            true,
      ticket_number: true,
      status:        true,
      total_usd:     true,
      total_bs:      true,
      rate_used:     true,
      sold_at:       true,
      created_at:    true,
      abonos: {
        select: {
          id:         true,
          amount_usd: true,
          created_at: true,
          notes:      true,
        },
      },
    },
  })

  const sales: SaleHistoryItem[] = salesRaw.map((s) => {
    const abonosTotal = s.abonos.reduce((acc, a) => acc + Number(a.amount_usd), 0)
    const balanceRemaining =
      s.status === 'pending'
        ? Math.max(0, Number(s.total_usd) - abonosTotal)
        : 0
    return {
      id:               s.id,
      ticket_number:    s.ticket_number,
      status:           s.status,
      total_usd:        Number(s.total_usd),
      total_bs:         Number(s.total_bs),
      rate_used:        Number(s.rate_used),
      sold_at:          s.sold_at,
      created_at:       s.created_at,
      abonos:           s.abonos.map((a) => ({
        id:         a.id,
        amount_usd: Number(a.amount_usd),
        created_at: a.created_at,
        notes:      a.notes,
      })),
      balance_remaining: balanceRemaining,
    }
  })

  const pendingBalance = sales
    .filter((s) => s.status === 'pending')
    .reduce((acc, s) => acc + s.balance_remaining, 0)

  return {
    client: { ...client, pending_balance_usd: pendingBalance },
    sales,
  }
}
