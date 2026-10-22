import { test, expect, request as pwRequest } from '@playwright/test'
import { BASE, SLUG } from './p0-helpers'

/**
 * Búsqueda pública del catálogo (GET /api/catalog/[slug]/search): además del tope por IP (60/min) hay un tope por
 * SLUG (300/min), para que muchas IPs juntas no puedan raspar un mismo catálogo.
 * Cada petición lleva una IP distinta (X-Real-IP), así el tope por IP nunca salta y solo puede saltar el del slug.
 * Va en su propio archivo y espera a que cierre la ventana de 60 s al terminar: agota el cupo de `onbike`.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })

test('el tope por slug corta el raspado desde muchas IPs distintas', async () => {
  test.setTimeout(240_000)
  const api = await pwRequest.newContext({ baseURL: BASE })
  const statuses: number[] = []
  for (let i = 0; i < 340; i += 20) {
    const lote = await Promise.all(Array.from({ length: 20 }, (_, k) => {
      const n = i + k
      return api.get(`/api/catalog/${SLUG}/search?q=zz`, { headers: { 'x-real-ip': `10.77.${Math.floor(n / 250)}.${(n % 250) + 1}` } })
    }))
    statuses.push(...lote.map(r => r.status()))
  }
  // Las primeras 100 pasan (ninguna IP repite, el tope por IP no interviene) y después el slug se agota con 429.
  expect(statuses.slice(0, 100).every(s => s === 200)).toBe(true)
  expect(statuses.filter(s => s === 429).length).toBeGreaterThanOrEqual(30)
  await api.dispose()
  // deja pasar la ventana de 60 s para no dejar `onbike` sin cupo al resto de la suite
  await new Promise(r => setTimeout(r, 62_000))
})
