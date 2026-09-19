// ponytail: uso único, mirror exacto de PATCH /api/admin/tenants/[id] (plan:'negocio_activo')
// Sustituye esa llamada real porque no había credencial super_admin de produccion disponible.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const id = Number(process.argv[2])
  if (!Number.isInteger(id)) throw new Error('uso: ts-node _activate-onbike-plan.ts <business_id>')

  const business = await prisma.business.update({
    where: { id },
    data: {
      catalog_plan: 'negocio_activo',
      catalog_active: true,
      subscription_active: true,
    },
    select: { id: true, name: true, catalog_plan: true, catalog_active: true, subscription_active: true },
  })

  console.log(JSON.stringify(business))
}

main().finally(() => prisma.$disconnect())
