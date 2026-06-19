import { prisma } from './prisma'

// Marca reportes del período como pending para procesamiento por n8n.
// No genera PDFs — eso lo hace generateMonthlyPDF() al primer acceso.
export async function markMonthlyReportsPending(period: string): Promise<void> {
  const businesses = await prisma.business.findMany({
    where: { active: true },
    select: { id: true },
  })

  await Promise.allSettled(
    businesses.map(b =>
      prisma.monthlyReport.upsert({
        where: {
          business_id_period: { business_id: b.id, period },
        },
        create: {
          business_id: b.id,
          period,
          status: 'pending',
        },
        update: { status: 'pending' },
      })
    )
  )
}
