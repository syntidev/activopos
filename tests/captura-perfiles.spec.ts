import { test, expect, type Page } from '@playwright/test'
import { BASE, BUSINESS_ID, login, sql } from './alta-helpers'

/**
 * Captura de etiquetas por perfil de marca (/captura-etiquetas), negocio 87, servidor local en el puerto 3101
 * con LABEL_CAPTURE_BUSINESS_IDS=87. Perfil On + regresión del perfil Safetti (formato de API y CSV originales).
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

const TAG = String(Date.now()).slice(-4)
const STYLE = `3MZ${TAG}0001`
const ON_FIELDS = { profile: 'on', model_name: 'ZZ Cloudboom Volt', colorway: 'White | Black', gender: 'M' }

function withCheck(body12: string): string {
  const sum = Array.from(body12, Number).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  return `${body12}${(10 - (sum % 10)) % 10}`
}
const ean = (n: number): string => withCheck(`98${TAG}${String(n).padStart(6, '0')}`)
const EAN_A = ean(1)
const EAN_B = ean(2)
const EAN_BAD_STYLE = ean(3)
const EAN_BAD_GENDER = ean(4)
const EAN_UI = ean(5)
const EAN_SAFETTI = ean(6)
const ALL_EANS = [EAN_A, EAN_B, EAN_BAD_STYLE, EAN_BAD_GENDER, EAN_UI, EAN_SAFETTI]

interface Item { id: number; ean: string; style: string; size: string; units: number; status: string; notes: string | null; profile: string }

async function postOn(page: Page, body: Record<string, string>): Promise<{ status: number; json: { item: Item; added: boolean } }> {
  const res = await page.request.post('/api/label-capture', { data: { ...ON_FIELDS, ...body } })
  return { status: res.status(), json: await res.json() }
}

test.afterAll(() => {
  const list = ALL_EANS.map(e => `'${e}'`).join(',')
  sql(`DELETE FROM label_captures WHERE business_id=${BUSINESS_ID} AND ean IN (${list})`)
})

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('On: 2 EAN del mismo estilo en tallas distintas = 1 producto con 2 variantes', async ({ page }) => {
  const a = await postOn(page, { ean: EAN_A, style: STYLE, us: '9', eu: '42.5', uk: '8.5', jp: '27' })
  const b = await postOn(page, { ean: EAN_B, style: STYLE, us: '10', eu: '44', uk: '9.5', jp: '28' })
  expect(a.status).toBe(201)
  expect(b.status).toBe(201)
  expect(a.json.item.size).toBe('US 9 · EU 42.5')
  expect(a.json.item.status).toBe('ok')

  const list = (await (await page.request.get('/api/label-capture?profile=on')).json()) as { items: Item[] }
  const mine = list.items.filter(i => i.style === STYLE)
  expect(mine.map(i => i.size).sort()).toEqual(['US 10 · EU 44', 'US 9 · EU 42.5'])
  expect(sql(`SELECT COUNT(DISTINCT style), COUNT(*) FROM label_captures WHERE business_id=${BUSINESS_ID} AND profile='on' AND style='${STYLE}'`)).toBe('1\t2')
  expect(sql(`SELECT ref FROM label_captures WHERE business_id=${BUSINESS_ID} AND ean='${EAN_A}'`)).toBe(`3MZ${TAG}`)
})

test('On: mismo EAN dos veces = cantidad 2 (sin fila nueva) y deshacer lo baja', async ({ page }) => {
  const again = await postOn(page, { ean: EAN_A, style: STYLE, us: '9', eu: '42.5' })
  expect(again.status).toBe(200)
  expect(again.json.added).toBe(true)
  expect(again.json.item.units).toBe(2)
  expect(sql(`SELECT COUNT(*) FROM label_captures WHERE business_id=${BUSINESS_ID} AND ean='${EAN_A}'`)).toBe('1')

  const undo = await page.request.patch(`/api/label-capture/${again.json.item.id}`, { data: { sub_unit: true } })
  expect(((await undo.json()) as { item: Item }).item.units).toBe(1)
  // Nunca baja de 1: quitar la captura entera es el DELETE.
  const floor = await page.request.patch(`/api/label-capture/${again.json.item.id}`, { data: { sub_unit: true } })
  expect(((await floor.json()) as { item: Item }).item.units).toBe(1)
})

test('On: estilo inválido y género distinto al del estilo se guardan en revisión', async ({ page }) => {
  const badStyle = await postOn(page, { ean: EAN_BAD_STYLE, style: 'XYZ-123', us: '8', eu: '41' })
  expect(badStyle.status).toBe(201)
  expect(badStyle.json.item.status).toBe('review')
  expect(badStyle.json.item.style).toBe('XYZ123')
  expect(badStyle.json.item.notes).toContain('estilo con formato inesperado')

  const badGender = await postOn(page, { ean: EAN_BAD_GENDER, style: STYLE, gender: 'W', us: '8', eu: '41' })
  expect(badGender.json.item.status).toBe('review')
  expect(badGender.json.item.notes).toContain('no coincide con el estilo')
})

test('On: exporta una fila por EAN con las columnas de la fase C', async ({ page }) => {
  const res = await page.request.get('/api/label-capture/export?profile=on&format=csv')
  const csv = await res.text()
  const lines = csv.replace(/^﻿/, '').split('\r\n')
  expect(lines[0]).toBe('estilo,modelo,genero,colorway,US,EU,UK,JP,EAN,cantidad,en_revision')
  expect(lines).toContain(`${STYLE},ZZ Cloudboom Volt,M,White | Black,9,42.5,8.5,27,${EAN_A},1,no`)
  expect(lines.find(l => l.includes(EAN_BAD_STYLE))?.endsWith(',si')).toBe(true)
})

test('Safetti sigue idéntico: API, duplicado, suma, lista y CSV originales', async ({ page }) => {
  const created = await page.request.post('/api/label-capture', { data: { ean: EAN_SAFETTI, ref: '12345A', model_name: 'ZZ Safetti', size: 'M' } })
  expect(created.status()).toBe(201)
  const item = ((await created.json()) as { item: Item }).item
  expect(item.profile).toBe('safetti')
  expect(item.status).toBe('review') // la ref no existe como producto del negocio

  const dup = await page.request.post('/api/label-capture', { data: { ean: EAN_SAFETTI, ref: '12345A', size: 'M' } })
  expect(dup.status()).toBe(409)
  expect(((await dup.json()) as { code: string; units: number }).code).toBe('duplicate')

  const plus = await page.request.patch(`/api/label-capture/${item.id}`, { data: { add_unit: true } })
  expect(((await plus.json()) as { item: Item }).item.units).toBe(2)

  const list = (await (await page.request.get('/api/label-capture')).json()) as { items: Item[] }
  expect(list.items.some(i => i.ean === EAN_SAFETTI)).toBe(true)
  expect(list.items.some(i => i.profile === 'on')).toBe(false)

  const csv = (await (await page.request.get('/api/label-capture/export')).text()).replace(/^﻿/, '')
  expect(csv.split('\r\n')[0]).toBe('ean,ref,modelo,color_etiqueta,prenda,talla,genero,unidades,color_real,estado,notas')

  // Un EAN de Safetti no se puede capturar como On.
  const cross = await postOn(page, { ean: EAN_SAFETTI, style: STYLE, us: '9' })
  expect(cross.status).toBe(409)
})

test('móvil 375: selector de marca, tarjeta On, guardar, +1 con deshacer y sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/captura-etiquetas')
  const brand = (name: string) => page.getByRole('group', { name: 'Marca' }).getByRole('button', { name, exact: true })
  await expect(brand('Safetti')).toHaveAttribute('aria-pressed', 'true')
  await brand('On').click()
  await expect(page.getByRole('heading', { name: /Captura de etiquetas · On/ })).toBeVisible()

  const card = page.getByRole('group', { name: 'Confirmar etiqueta' })
  const fill = async (label: string, value: string): Promise<void> => card.getByLabel(label, { exact: true }).fill(value)
  await fill('EAN', EAN_UI)
  await fill('Estilo', STYLE)
  await fill('Modelo', 'ZZ Cloudboom Volt')
  await fill('Colorway', 'White | Black')
  await card.getByRole('group', { name: 'Género' }).getByRole('button', { name: 'M', exact: true }).click()
  await fill('US', '11')
  await fill('EU', '45')
  await page.screenshot({ path: 'tests/__capturas__/captura-on-375-tarjeta.png' })
  await card.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'guardada' })).toBeVisible()
  await expect(page.getByText('US 11 · EU 45', { exact: true })).toBeVisible()

  // Tras guardar quedan los datos de la caja para la siguiente talla; el EAN y las tallas se limpian.
  await expect(card.getByLabel('Estilo', { exact: true })).toHaveValue(STYLE)
  await expect(card.getByLabel('EAN', { exact: true })).toHaveValue('')

  // Mismo EAN otra vez = +1; Deshacer lo revierte.
  await fill('EAN', EAN_UI)
  await fill('US', '11')
  await card.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '+1 (ahora 2)' })).toBeVisible()
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'deshecho' })).toBeVisible()
  expect(sql(`SELECT units FROM label_captures WHERE business_id=${BUSINESS_ID} AND ean='${EAN_UI}'`)).toBe('1')

  await page.getByRole('button', { name: 'Siguiente caja' }).click()
  await expect(card.getByLabel('Estilo', { exact: true })).toHaveValue('')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: 'tests/__capturas__/captura-on-375-lista.png', fullPage: true })

  // Recuerda la última marca usada.
  await page.reload()
  await expect(page.getByRole('heading', { name: /Captura de etiquetas · On/ })).toBeVisible()
  await expect(brand('On')).toHaveAttribute('aria-pressed', 'true')
})
