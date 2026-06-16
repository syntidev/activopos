import { prisma } from './prisma'

type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export const generateTicketNumber = async (
  businessId: number,
  tx: TxClient
): Promise<string> => {
  const business = await tx.business.findUnique({
    where: { id: businessId },
    select: { ticket_prefix: true },
  })

  const prefix = business?.ticket_prefix ?? 'ACT'

  const last = await tx.sale.findFirst({
    where: {
      business_id: businessId,
      ticket_number: { startsWith: `${prefix}-` },
    },
    orderBy: { id: 'desc' },
    select: { ticket_number: true },
  })

  let nextNum = 1
  if (last) {
    const parts = last.ticket_number.split('-')
    const num = parseInt(parts[parts.length - 1] ?? '0', 10)
    nextNum = num >= 99999 ? 1 : num + 1
  }

  return `${prefix}-${nextNum.toString().padStart(5, '0')}`
}
