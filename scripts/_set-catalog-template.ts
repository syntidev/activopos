// ponytail: uso único — setea catalog_template='premium' para OnBike (business_id=33) en produccion.
// Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/_set-catalog-template.ts 33 premium
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import fs from 'fs'
import path from 'path'

// Script standalone (ts-node, sin Next.js) -- mismo replicado de precedencia de env
// que scripts/seed-demo.ts, Next.js carga .env automatico pero un script suelto no.
function loadEnvFile(file: string): void {
  const full = path.join(__dirname, '..', file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) process.env[match[1]] = process.env[match[1]] ?? match[2].trim()
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

// Mismo patron de adapter que src/lib/prisma.ts y scripts/seed-demo.ts -- Prisma 7
// en este proyecto usa driver adapters (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME), no DATABASE_URL simple.
const dbHost = process.env.DB_HOST ?? '127.0.0.1'
const isLoopback = dbHost === '127.0.0.1' || dbHost === 'localhost'
const adapter = new PrismaMariaDb({
  host: dbHost,
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'activopos',
  connectionLimit: 5,
  ...(isLoopback ? { allowPublicKeyRetrieval: true } : {}),
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const id = Number(process.argv[2])
  const template = process.argv[3]
  if (!Number.isInteger(id) || (template !== 'generic' && template !== 'premium')) {
    throw new Error('uso: ts-node _set-catalog-template.ts <business_id> <generic|premium>')
  }

  const business = await prisma.business.update({
    where: { id },
    data: { catalog_template: template },
    select: { id: true, name: true, catalog_template: true },
  })

  console.log(JSON.stringify(business))
}

main().finally(() => prisma.$disconnect())
