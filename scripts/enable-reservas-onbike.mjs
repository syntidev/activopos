// ponytail: uso único — habilita el módulo Reservas para OnBike (única forma
// autorizada de prender el flag, por convención de CLAUDE.md: "Ninguna API de
// tenant escribe el flag: se activa por SQL/script del equipo").
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? '127.0.0.1',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'activopos',
  allowPublicKeyRetrieval: true,
})
const prisma = new PrismaClient({ adapter })

const business = await prisma.business.update({
  where: { catalog_slug: 'onbike' },
  data:  { reservas_enabled: true },
  select: { id: true, name: true, reservas_enabled: true },
})
console.log(JSON.stringify(business))
await prisma.$disconnect()
