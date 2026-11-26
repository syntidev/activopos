import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { BILLING_CYCLES, INSTALACION_DESDE_USD, LADDER_NAME, PLAN_LIMITS, PRICES_PUBLISHED, WORKING_BILLING_CYCLES, type BillingCycleKey } from '../src/lib/plan-limits'

/**
 * /planes pública guiada por PRICES_PUBLISHED. Con el flag en false se ve exactamente lo de hoy; con true (o con ?vista=v2 fuera de
 * producción, que es como se revisa sin publicar) se ve la escalera v2: Gratis / Entrada / Operación leyendo WORKING_BILLING_CYCLES.
 * La página es pública y no toca datos de ningún negocio (no hay nada que sembrar en el 217). NINGÚN precio está escrito aquí: todo sale de plan-limits.ts,
 * así que el spec cubre ambos valores del flag sin cambiarlo. Capturas en .doc/planes-publica/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const OUT = path.join(__dirname, '..', '.doc', 'planes-publica')
const ESCALERA = PRICES_PUBLISHED ? '/planes' : '/planes?vista=v2'
const VIEWPORTS = [{ n: '1280', w: 1280, h: 900 }, { n: '375', w: 375, h: 812 }]

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }) })

const usd = (n: number): string => '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2))
const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const UNIDAD: Record<BillingCycleKey, string> = { mensual: 'al mes', trimestral: 'cada 3 meses', semestral: 'cada 6 meses', anual: 'al año' }

test.describe('flag PRICES_PUBLISHED = false (hoy)', () => {
  test.skip(PRICES_PUBLISHED, 'con el flag en true /planes ya muestra la escalera v2')

  test('/planes sigue siendo lo de hoy: sin escalera v2 ni precios de trabajo', async ({ page }) => {
    await page.goto('/planes')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('planes-v2')).toHaveCount(0)
    // El precio publicado de Negocio Activo (BILLING_CYCLES) sigue a la vista; la escalera v2 no existe.
    await expect(page.getByText(BILLING_CYCLES.negocio_activo.mensual.totalAmount.toFixed(2)).first()).toBeVisible()
    await expect(page.getByText(LADDER_NAME.operacion, { exact: true })).toHaveCount(0)
    await expect(page.getByText('Precio fijo por el período')).toHaveCount(0)
    await expect(page.getByTestId('instalacion-precio')).toHaveCount(0)
    // Los precios de trabajo no se filtran a la vitrina actual.
    expect(BILLING_CYCLES.negocio_activo.mensual.totalAmount).not.toBe(WORKING_BILLING_CYCLES.negocio_activo.mensual.totalAmount)
  })
})

test.describe('flag PRICES_PUBLISHED = true (escalera v2; con false se revisa con ?vista=v2)', () => {
  test('con el flag en true la vitrina lee los precios de trabajo', () => {
    test.skip(!PRICES_PUBLISHED, 'el flag está en false: BILLING_CYCLES conserva el precio publicado')
    expect(BILLING_CYCLES.negocio_activo.mensual.totalAmount).toBe(WORKING_BILLING_CYCLES.negocio_activo.mensual.totalAmount)
  })

  for (const vp of VIEWPORTS) {
    test(`escalera: precios de WORKING_PRICES, selector Mensual/Anual con otros períodos y precio fijo @${vp.n}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h })
      await page.goto(ESCALERA)
      await expect(page.getByTestId('planes-v2')).toBeVisible()
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0)

      // Tres niveles; los precios salen de plan-limits (nada escrito en el spec).
      for (const tier of ['negocio_activo', 'operacion'] as const) {
        await expect(page.getByTestId(`precio-${tier}`)).toContainText(usd(WORKING_BILLING_CYCLES[tier].mensual.totalAmount))
        await expect(page.getByTestId(`plan-${tier}`).getByRole('heading', { level: 3 })).toHaveText(LADDER_NAME[tier])
      }
      await expect(page.getByTestId('plan-gratis')).toBeVisible()
      await expect(page.getByTestId('precio-fijo')).toHaveCount(2) // insignia en las dos tarjetas de pago
      await expect(page.getByTestId('precio-fijo').first()).toHaveText('Precio fijo por el período')
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(OUT, `planes-escalera-${vp.n}.png`) }) // estado inicial: Mensual, "Otros períodos" cerrado

      // Mensual / Anual: el precio cambia al total del período (con "≈ al mes" y ahorro).
      await expect(page.getByTestId('periodo-mensual')).toHaveAttribute('aria-checked', 'true')
      expect((await page.getByTestId('periodo-anual').boundingBox())!.height).toBeGreaterThanOrEqual(43.5)
      await page.getByTestId('periodo-anual').click()
      await expect(page.getByTestId('periodo-anual')).toHaveAttribute('aria-checked', 'true')
      for (const tier of ['negocio_activo', 'operacion'] as const) {
        const a = WORKING_BILLING_CYCLES[tier].anual
        await expect(page.getByTestId(`precio-${tier}`)).toContainText(usd(a.totalAmount))
        await expect(page.getByTestId(`precio-${tier}`)).toContainText(UNIDAD.anual)
        await expect(page.getByTestId(`plan-${tier}`)).toContainText(`Ahorras ${a.savingsPct}%`)
      }

      // "Otros períodos": trimestral y semestral están ocultos hasta abrir la bandeja.
      await expect(page.getByTestId('otros-periodos')).toHaveCount(0)
      await page.getByTestId('otros-periodos-btn').click()
      await expect(page.getByTestId('otros-periodos')).toBeVisible()
      for (const k of ['trimestral', 'semestral'] as const) {
        await page.getByTestId(`periodo-${k}`).click()
        for (const tier of ['negocio_activo', 'operacion'] as const) {
          await expect(page.getByTestId(`precio-${tier}`)).toContainText(usd(WORKING_BILLING_CYCLES[tier][k].totalAmount))
          await expect(page.getByTestId(`precio-${tier}`)).toContainText(UNIDAD[k])
        }
      }
      await page.getByTestId('periodo-mensual').click()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(OUT, `planes-escalera-periodos-${vp.n}.png`) }) // con la bandeja de otros períodos abierta
    })

    test(`instalación, tabla comparativa por categoría y nada de KDS ni fiscal @${vp.n}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h })
      await page.goto(ESCALERA)
      await expect(page.getByTestId('instalacion-precio')).toHaveText(`desde ${usd(INSTALACION_DESDE_USD)}`)

      const tabla = page.getByTestId('planes-tabla')
      await expect(tabla.getByRole('columnheader', { name: LADDER_NAME.negocio_activo })).toBeVisible()
      await expect(tabla.getByRole('columnheader', { name: LADDER_NAME.operacion })).toBeVisible()
      for (const g of ['base', 'capacidad', 'venta', 'catalogo', 'clientes', 'proveedores', 'finanzas', 'equipo', 'operacion']) {
        await expect(page.getByTestId(`grupo-${g}`)).toHaveCount(1)
        expect(await page.getByTestId(`grupo-${g}`).locator('tr').count(), `grupo ${g} con filas`).toBeGreaterThan(1)
      }
      // Los límites salen de PLAN_LIMITS.
      const productos = tabla.getByRole('row', { name: /^Productos/ })
      await expect(productos).toContainText(`Hasta ${PLAN_LIMITS.gratis.products}`)
      await expect(productos).toContainText('Ilimitados')
      // Restaurante: solo Operación lo incluye.
      const restaurante = tabla.getByRole('row', { name: /Restaurante/ })
      await expect(restaurante.locator('td').nth(0)).toContainText('No incluido')
      await expect(restaurante.locator('td').nth(2)).toContainText('Incluido')
      expect(await sinDesborde(page)).toBeLessThanOrEqual(0) // la tabla scrollea dentro de su contenedor, no la página

      // El add-on KDS no se ofrece (hasta certificar R3) y no hay nada fiscal.
      // Solo el contenido de la página (el pie de marketing es del layout compartido y ya menciona facturación SENIAT desde antes).
      const texto = await page.getByTestId('planes-v2').innerText()
      expect(texto).not.toMatch(/\bkds\b|cocina/i)
      expect(texto).not.toMatch(/fiscal|seniat|impuesto|\biva\b|factura/i)

      // Captura de la instalación y el inicio de la tabla, debajo del menú fijo.
      await page.getByTestId('instalacion-precio').scrollIntoViewIfNeeded()
      await page.evaluate(() => window.scrollBy(0, -140))
      await page.screenshot({ path: path.join(OUT, `planes-tabla-${vp.n}.png`) })
    })
  }

  test('JSON-LD: tres productos con las ofertas por período de los precios de trabajo y sin KDS', async ({ page }) => {
    await page.goto(ESCALERA)
    const bloques = await page.locator('script[type="application/ld+json"]').allTextContents()
    const productos = bloques.flatMap(b => JSON.parse(b) as Array<{ name: string; offers: unknown }>)
    expect(productos.map(p => p.name)).toEqual([`ActivoPOS Gratis`, `ActivoPOS ${LADDER_NAME.negocio_activo}`, `ActivoPOS ${LADDER_NAME.operacion}`])
    const precios = (offers: unknown): string[] => (Array.isArray(offers) ? offers : [offers]).map(o => (o as { price: string }).price)
    for (const tier of ['negocio_activo', 'operacion'] as const) {
      const p = productos.find(x => x.name.endsWith(LADDER_NAME[tier]))!
      expect(precios(p.offers)).toEqual((['mensual', 'trimestral', 'semestral', 'anual'] as const).map(c => WORKING_BILLING_CYCLES[tier][c].totalAmount.toFixed(2)))
    }
    expect(JSON.stringify(productos)).not.toMatch(/kds|cocina/i)
  })
})
