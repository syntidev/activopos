import { test, expect, request as pwRequest } from '@playwright/test'
import { SignJWT } from 'jose'
import path from 'path'
import { envValue, sql } from './alta-helpers'

// Tenant propio de CLI-D (negocio 267 "ZZ D Pruebas"; el 87 es OnBike, cliente real). Helpers en línea porque
// tests/d-tenant.ts todavía no está en main (rama fix/tests-heredados): al mergearla, importar de './d-tenant'.
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 267
const ADMIN_ID = 212

function assertOwnTenant(): void {
  const name = sql(`SELECT name FROM businesses WHERE id=${BUSINESS_ID}`)
  if (!name.startsWith('ZZ D')) throw new Error(`El negocio ${BUSINESS_ID} ("${name}") no es el tenant de pruebas ZZ D`)
}

const tokenFor = (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'ZZ D Admin' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

/**
 * Editor de cotización: el campo de cantidad muestra su valor completo (sin flechas nativas que coman el ancho)
 * y los botones −/+ responden, a 375 px (táctil) y a 1280 px (escritorio). Tenant propio 267 "ZZ D Pruebas".
 * Con COTIZACION_CAPTURA=antes|despues guarda capturas en .doc/cotizacion/.
 */
const TAG = 'ZZ Cant'
const CANTIDADES = ['9', '99', '1250.5', '10000']
const CAPTURA = process.env.COTIZACION_CAPTURA
const OUT = path.join(__dirname, '..', '.doc', 'cotizacion')
const TOUCH_MIN = 44
const DESKTOP_BTN_MAX = 36

const VIEWPORTS = [
  { name: '375', viewport: { width: 375, height: 812 }, touch: true },
  { name: '1280', viewport: { width: 1280, height: 900 }, touch: false },
]

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ timeout: 120_000 })

let quotationId = 0

function cleanup(): void {
  sql(`DELETE qi FROM quotation_items qi JOIN quotations q ON q.id=qi.quotation_id WHERE q.notes='${TAG}'`)
  sql(`DELETE FROM quotations WHERE notes='${TAG}'`)
}

test.beforeAll(async () => {
  assertOwnTenant()
  cleanup()
  const api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor()}` } })
  const r = await api.post('/api/quotations', {
    data: { notes: TAG, items: CANTIDADES.map(q => ({ name: `${TAG} ${q}`, qty: Number(q), price_usd: 10 })) },
  })
  expect(r.status(), await r.text()).toBe(201)
  quotationId = (await r.json()).quotation.id as number
  await api.dispose()
})

test.afterAll(() => { cleanup() })

for (const v of VIEWPORTS) {
  test(`cantidad completa y botones que responden — ${v.name} px`, async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE, viewport: v.viewport, ...(v.touch ? { isMobile: true, hasTouch: true } : {}),
    })
    await context.addCookies([{ name: 'activopos_session', value: await tokenFor(), url: BASE }])
    const page = await context.newPage()
    if (v.touch) {
      // hasTouch solo no apaga (hover: hover) en Chromium: el modo "mobile" de CDP sí (pointer: coarse, hover: none).
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1, configuration: 'mobile' })
    }
    await page.goto(`/cotizaciones/${quotationId}/editar`)
    const tactil = await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)
    expect(tactil, `emulación ${v.name} px: táctil=${v.touch}`).toBe(v.touch)
    await expect(page.getByLabel('Descripción del ítem').first()).toBeVisible({ timeout: 60_000 })

    if (CAPTURA) {
      // Solo para la captura: la lista scrollea adentro y así se ven los 4 ítems a la vez.
      await page.evaluate(() => {
        const ul = document.querySelector('ul[class*="items"]') as HTMLElement | null
        if (ul) { ul.style.maxHeight = 'none'; ul.style.overflow = 'visible' }
      })
      await page.getByRole('region', { name: 'Detalle de la cotización' })
        .screenshot({ path: path.join(OUT, `cantidad-${CAPTURA}-${v.name}.png`) })
    }

    const inputs = page.getByLabel('Cantidad')
    for (const [i, cantidad] of CANTIDADES.entries()) {
      const input = inputs.nth(i)
      await input.scrollIntoViewIfNeeded()
      await expect(input).toHaveValue(cantidad)
      const m = await input.evaluate((el: HTMLInputElement) => ({
        sw: el.scrollWidth, cw: el.clientWidth,
        spin: getComputedStyle(el, '::-webkit-inner-spin-button').getPropertyValue('-webkit-appearance'),
      }))
      expect.soft(m.sw, `${cantidad} cortado a ${v.name} px (scrollWidth ${m.sw} > clientWidth ${m.cw})`).toBeLessThanOrEqual(m.cw)
      // Por defecto la UA pinta la flecha (-webkit-appearance: inner-spin-button); el CSS la apaga.
      expect.soft(m.spin, `flechas nativas visibles en ${cantidad}`).not.toBe('inner-spin-button')
    }

    // La fila de controles no se desborda y los botones tienen el tamaño de su contexto.
    const controls = await page.locator('div[class*="itemControls"]').first().evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    expect(controls.sw).toBeLessThanOrEqual(controls.cw)
    const box = await page.getByRole('button', { name: `Sumar 1 a ${TAG} 99` }).boundingBox()
    expect(box).not.toBeNull()
    if (v.touch) {
      // Chromium emulado reporta a la vez pointer:coarse y pointer:fine, así que el ancho renderizado no distingue
      // el táctil. Se comprueba la regla base de .stepBtn (la que rige sin puntero fino): --touch-min = 44px.
      const base = await page.evaluate(() => {
        for (const sheet of Array.from(document.styleSheets)) {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && /stepBtn/.test(rule.selectorText) && !rule.selectorText.includes(':')) {
              return { minWidth: rule.style.minWidth, touchMin: getComputedStyle(document.documentElement).getPropertyValue('--touch-min').trim() }
            }
          }
        }
        return null
      })
      expect(base).toEqual({ minWidth: 'var(--touch-min)', touchMin: `${TOUCH_MIN}px` })
    } else {
      expect(box!.width).toBeLessThanOrEqual(DESKTOP_BTN_MAX)
    }

    // Los botones responden: + y − sobre el 99 y el 1250.5.
    await page.getByRole('button', { name: `Sumar 1 a ${TAG} 99` }).click()
    await expect(inputs.nth(1)).toHaveValue('100')
    await page.getByRole('button', { name: `Restar 1 a ${TAG} 99` }).click()
    await expect(inputs.nth(1)).toHaveValue('99')
    await page.getByRole('button', { name: `Sumar 1 a ${TAG} 1250.5` }).click()
    await expect(inputs.nth(2)).toHaveValue('1251.5')
    await page.getByRole('button', { name: `Restar 1 a ${TAG} 1250.5` }).click()
    await expect(inputs.nth(2)).toHaveValue('1250.5')
    await context.close()
  })
}
