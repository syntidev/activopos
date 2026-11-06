import { test, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { sql } from './alta-helpers'
import { ensureOwnBusiness, OWN_SLUG } from './helpers/own-business-carta'

/**
 * Capturas de revisión de la Carta C2 (375 y 1280): portada, ficha con tamaños, ficha con opciones obligatorias, carrito con opciones y
 * nota, mensaje de WhatsApp, estado cerrado y agotado. Salida: .doc/carta/capturas-c2/. Negocio propio 217 (ZZ B Pruebas); al final se
 * restaura con el seed. No es una puerta de calidad: solo genera imágenes.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const OUT = path.join(__dirname, '..', '.doc', 'carta', 'capturas-c2')
const VIEWPORTS = [{ w: 375, h: 812 }, { w: 1280, h: 900 }]
const CLOSED = "JSON_OBJECT('lun',JSON_ARRAY(),'mar',JSON_ARRAY(),'mie',JSON_ARRAY(),'jue',JSON_ARRAY(),'vie',JSON_ARRAY(),'sab',JSON_ARRAY(),'dom',JSON_ARRAY())"

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let bid = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))
const idOf = (name: string): number => Number(q("SELECT id FROM products WHERE business_id=@BID AND name='" + name + "'"))
const limpiar = (): void => {
  const orders = q("SELECT id FROM orders WHERE business_id=@BID AND client_name LIKE 'ZZB %'").split('\n').filter(Boolean).join(',')
  if (orders) { q('DELETE FROM order_items WHERE order_id IN (' + orders + ')'); q('DELETE FROM orders WHERE id IN (' + orders + ')') }
  q("DELETE FROM inventory_entries WHERE business_id=@BID AND notes LIKE 'Reserva pedido catálogo%'")
  q("DELETE FROM clients WHERE business_id=@BID AND name LIKE 'ZZB %'")
}

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); bid = ensureOwnBusiness(); limpiar() })
test.afterAll(() => { limpiar(); ensureOwnBusiness() })

const shot = async (page: Page, name: string, w: number, full = false): Promise<void> => {
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, name + '-' + w + '.png'), fullPage: full })
}

for (const { w, h } of VIEWPORTS) {
  test('capturas ' + w, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    const opcion = (g: string, o: string) => page.locator('[data-testid="carta-opcion"][data-grupo="' + g + '"][data-opcion="' + o + '"]')

    await page.goto('/catalogo-carta/' + OWN_SLUG)
    await shot(page, '01-portada', w)
    await shot(page, '02-lista', w, true)

    await page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + idOf('Punta Burger'))
    await shot(page, '03-ficha-tamanos', w, true)

    await page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + idOf('Carbonara'))
    await shot(page, '04-ficha-opciones-obligatorias-bloqueada', w, true)
    await opcion('Proteína', 'Pavo').click()
    await opcion('Papas', 'Air fryer').click()
    await opcion('Extras', 'Tocineta').click()
    await page.getByTestId('carta-nota').fill('Sin cebolla, por favor')
    await shot(page, '05-ficha-opciones-elegidas', w, true)
    await page.getByTestId('carta-ficha-agregar').click()

    await page.getByTestId('carta-barra-pedido').click()
    await shot(page, '06-carrito-opciones-y-nota', w)
    await page.getByTestId('carta-linea-editar').click()
    await shot(page, '07-carrito-editando-linea', w)
    await page.getByTestId('carta-linea-editar').click()

    await page.getByTestId('carta-modalidad-llevar').click()
    await page.getByTestId('carta-nombre-cliente').fill('ZZB Maria Perez')
    await page.getByTestId('carta-telefono').fill('0414555' + String(2000 + w))
    await page.getByTestId('carta-cedula').fill('V9' + String(200000 + w))
    await page.getByTestId('carta-enviar').click()
    await page.getByTestId('carta-mensaje-wa').waitFor({ timeout: 30_000 })
    await shot(page, '08-mensaje-whatsapp', w)

    // Estado cerrado: horario vacío todos los días.
    q("UPDATE businesses SET settings=JSON_SET(settings, '$.carta_hours', " + CLOSED + ") WHERE id=@BID")
    await page.goto('/catalogo-carta/' + OWN_SLUG)
    await shot(page, '09-estado-cerrado-portada', w)
    await page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + idOf('Smash Burger'))
    await page.getByTestId('carta-ficha-agregar').click()
    await page.getByTestId('carta-barra-pedido').click()
    await shot(page, '10-estado-cerrado-carrito', w)
    await page.getByRole('button', { name: 'Cerrar mi pedido' }).click()
    ensureOwnBusiness() // horario abierto otra vez

    // Agotado del día.
    q("UPDATE products SET sold_out_date=CURDATE() WHERE id=" + idOf('Smash Burger'))
    await page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + idOf('Smash Burger'))
    await shot(page, '11-agotado-ficha', w)
    await page.goto('/catalogo-carta/' + OWN_SLUG)
    await page.getByTestId('carta-plato').filter({ hasText: 'Smash Burger' }).scrollIntoViewIfNeeded()
    await shot(page, '12-agotado-lista', w)
    q('UPDATE products SET sold_out_date=NULL WHERE business_id=@BID')
    await page.evaluate(() => window.localStorage.clear())
    limpiar()
  })
}
