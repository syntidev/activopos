import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { sql } from './alta-helpers'

/**
 * Capturas de la ficha de la Carta (1440 y 390): con foto, sin foto y relacionados al final del scroll.
 * Negocio propio 217 (zzb-pruebas). A "Beef Burger" se le pone una foto SOLO durante la prueba y se restaura a NULL. No es puerta de calidad.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const SLUG = 'zzb-pruebas'
const OUT = path.join(__dirname, '..', '.doc', 'carta', 'ficha')
const FOTO = '["/storage/tenants/1/products/70200bcb-2f48-4e3f-b76f-51127b3249d6.webp"]'
const VIEWPORTS = [{ n: '1440', w: 1440, h: 900 }, { n: '390', w: 390, h: 844 }]

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const idOf = (name: string): number => Number(sql(`SELECT id FROM products WHERE business_id=217 AND name='${name}'`))

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); sql(`UPDATE products SET images='${FOTO}' WHERE id=${idOf('Beef Burger')}`) })
test.afterAll(() => { sql(`UPDATE products SET images=NULL WHERE id=${idOf('Beef Burger')}`) })

for (const vp of VIEWPORTS) {
  test(`ficha con foto, sin foto y relacionados @${vp.n}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    for (const [nombre, plato] of [['con-foto', 'Beef Burger'], ['sin-foto', 'Smash Burger']] as const) {
      await page.goto(`/catalogo-carta/${SLUG}/p/${idOf(plato)}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(plato)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(800)
      await page.screenshot({ path: path.join(OUT, `ficha-${nombre}-${vp.n}.png`) })
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(OUT, `relacionados-${nombre}-${vp.n}.png`) })
      // Alineación: ficha y relacionados comparten borde izquierdo (mismo contenedor).
      const izq = await page.evaluate(() => ['[data-testid="carta-ficha"]', '[data-testid="carta-relacionados"]']
        .map(s => Math.round((document.querySelector(s) as HTMLElement).getBoundingClientRect().left)))
      expect(izq[0], JSON.stringify(izq)).toBe(izq[1])
      // La última tarjeta no queda detrás de la barra fija.
      const libre = await page.evaluate(() => {
        const tarjetas = document.querySelectorAll('[data-testid="carta-relacionados"] [data-testid="carta-plato"]')
        const ult = tarjetas[tarjetas.length - 1]?.getBoundingClientRect().bottom ?? 0
        const barra = document.querySelector('[data-testid="carta-ficha-agregar"]')?.parentElement as HTMLElement | null
        const top = barra && getComputedStyle(barra).position === 'fixed' ? barra.getBoundingClientRect().top : window.innerHeight
        return top - ult
      })
      expect(libre).toBeGreaterThanOrEqual(0)
    }
  })
}
