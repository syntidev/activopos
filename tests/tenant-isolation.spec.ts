import { test, expect } from '@playwright/test'
import { Prisma } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { getTenantPrisma } from '../src/lib/prisma-tenant'

/**
 * Test de AISLAMIENTO de tenant — integración real contra la DB.
 *
 * No es un E2E HTTP: ejercita directamente getTenantPrisma() (la unidad bajo
 * prueba) creando dos negocios reales y verificando que uno no puede ver ni
 * tocar los datos del otro. Crea sus propios datos throwaway y limpia al final.
 *
 * Correr:  npx playwright test tests/tenant-isolation.spec.ts
 * Requiere MariaDB local accesible (prisma.ts usa 127.0.0.1/root/activopos por
 * defecto, sin .env).
 */
test.describe('Tenant isolation — getTenantPrisma', () => {
  let bizA = 0
  let bizB = 0
  let prodA = 0
  let prodB = 0

  test.beforeAll(async () => {
    const a = await prisma.business.create({ data: { name: 'ISOLATION_TEST_A' } })
    const b = await prisma.business.create({ data: { name: 'ISOLATION_TEST_B' } })
    bizA = a.id
    bizB = b.id

    const pa = await prisma.product.create({ data: { business_id: bizA, name: 'A-only product' } })
    const pb = await prisma.product.create({ data: { business_id: bizB, name: 'B-only product' } })
    prodA = pa.id
    prodB = pb.id
  })

  test.afterAll(async () => {
    // Limpieza — borrar hijos antes que el negocio (FK)
    await prisma.product.deleteMany({ where: { business_id: { in: [bizA, bizB] } } })
    await prisma.business.deleteMany({ where: { id: { in: [bizA, bizB] } } })
  })

  test('1. findMany solo devuelve productos del propio tenant', async () => {
    const dbA = getTenantPrisma(bizA)
    const rows = await dbA.product.findMany()

    expect(rows.some(p => p.id === prodA)).toBe(true)   // ve lo suyo
    expect(rows.some(p => p.id === prodB)).toBe(false)  // NO ve lo ajeno
    expect(rows.every(p => p.business_id === bizA)).toBe(true)
  })

  test('2. create inyecta business_id automáticamente', async () => {
    const dbA = getTenantPrisma(bizA)
    // El tenant layer inyecta business_id en runtime; el tipo estático aún lo
    // exige, de ahí el cast.
    const created = await dbA.product.create({
      data: { name: 'auto-injected' } as Prisma.ProductUncheckedCreateInput,
    })

    expect(created.business_id).toBe(bizA)
    await prisma.product.delete({ where: { id: created.id } })
  })

  test('3. findUnique de producto ajeno → null', async () => {
    const dbA = getTenantPrisma(bizA)

    const stolen = await dbA.product.findUnique({ where: { id: prodB } })
    expect(stolen).toBeNull()

    const own = await dbA.product.findUnique({ where: { id: prodA } })
    expect(own?.id).toBe(prodA)
  })

  test('4. update de producto ajeno no lo afecta', async () => {
    const dbA = getTenantPrisma(bizA)

    // El row de B no matchea el WHERE scoped → P2025
    await expect(
      dbA.product.update({ where: { id: prodB }, data: { name: 'HACKED' } }),
    ).rejects.toThrow()

    const untouched = await prisma.product.findUnique({ where: { id: prodB } })
    expect(untouched?.name).toBe('B-only product')
  })

  test('5. delete de producto ajeno no lo borra', async () => {
    const dbA = getTenantPrisma(bizA)

    await expect(
      dbA.product.delete({ where: { id: prodB } }),
    ).rejects.toThrow()

    const stillThere = await prisma.product.findUnique({ where: { id: prodB } })
    expect(stillThere).not.toBeNull()
  })
})
