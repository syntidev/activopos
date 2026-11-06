import { test, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { sql } from './alta-helpers'
import { ensureOwnBusiness, OWN_SLUG } from './helpers/own-business-carta'

/**
 * Capturas de antes/después del pulido de la Carta a 375×812 (PULIDO_FASE=antes|despues). Salida: .doc/carta/capturas-pulido/.
 * Negocio propio 217 (ZZ B Pruebas). No es una puerta de calidad: solo genera imágenes.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const FASE = process.env.PULIDO_FASE === 'despues' ? 'despues' : 'antes'
const OUT = path.join(__dirname, '..', '.doc', 'carta', 'capturas-pulido')

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] }, viewport: { width: 375, height: 812 } })
test.describe.configure({ timeout: 120_000 })

let bid = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))
const idOf = (name: string): number => Number(q("SELECT id FROM products WHERE business_id=@BID AND name='" + name + "'"))

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); bid = ensureOwnBusiness() })

const shot = async (page: Page, name: string, full = false): Promise<void> => {
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(OUT, FASE + '-' + name + '.png'), fullPage: full })
}

test('capturas de pulido', async ({ page }) => {
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  await shot(page, '1-portada')

  await page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + idOf('Punta Burger'))
  await shot(page, '2-ficha-con-tamanos')

  await page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + idOf('Carbonara'))
  await shot(page, '3-ficha-sin-foto')

  await page.goto('/catalogo-carta/' + OWN_SLUG)
  await page.getByTestId('carta-plato').filter({ hasText: 'Smash Burger' }).getByTestId('carta-plato-agregar').click()
  await page.getByTestId('carta-barra-pedido').click()
  await shot(page, '4-carrito')
  await page.evaluate(() => window.localStorage.clear())
})
