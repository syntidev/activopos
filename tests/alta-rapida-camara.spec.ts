import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import sharp from 'sharp'
import { BASE, BUSINESS_ID, login, sql } from './alta-helpers'

/**
 * Alta rápida con la cámara en vivo, de punta a punta en el negocio 87 (servidor local, puerto 3101).
 *
 * Cámara falsa de Chromium (--use-fake-device-for-media-stream --use-fake-ui-for-media-stream) que
 * reproduce un video con un EAN-13 real dibujado. Chromium de escritorio en Windows NO trae
 * BarcodeDetector, así que si falta se inyecta un sustituto de PRUEBA con @zxing/library que cumple la
 * misma interfaz (detect(video) → [{ rawValue }]). Eso prueba el cableado completo (getUserMedia → video →
 * detect → búsqueda → formulario → guardado → POS), pero NO la decodificación del BarcodeDetector nativo
 * de un teléfono: ver el procedimiento manual en el reporte.
 */
const SHOTS = process.env.ALTA_SHOTS_DIR ?? path.join(__dirname, 'screenshots')
const WORK = path.join(tmpdir(), 'alta-rapida-camara')
const VIDEO = path.join(WORK, 'ean.mjpeg')

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const R = L.map(code => code.replace(/[01]/g, c => (c === '0' ? '1' : '0')))
const G = R.map(code => Array.from(code).reverse().join(''))
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function withCheckDigit(twelve: string): string {
  const sum = Array.from(twelve).reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
  return `${twelve}${(10 - (sum % 10)) % 10}`
}

function ean13Modules(ean: string): string {
  const parity = PARITY[Number(ean[0])]
  const left = Array.from(ean.slice(1, 7)).map((d, i) => (parity[i] === 'L' ? L : G)[Number(d)]).join('')
  const right = Array.from(ean.slice(7)).map(d => R[Number(d)]).join('')
  return `101${left}01010${right}101`
}

async function writeBarcodeVideo(ean: string): Promise<void> {
  const MODULE = 5
  const modules = ean13Modules(ean)
  const x0 = Math.round((640 - modules.length * MODULE) / 2)
  const bars = Array.from(modules)
    .map((m, i) => (m === '1' ? `<rect x="${x0 + i * MODULE}" y="110" width="${MODULE}" height="260" fill="black"/>` : ''))
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="white"/>${bars}</svg>`
  const frame = await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer()
  mkdirSync(WORK, { recursive: true })
  writeFileSync(VIDEO, Buffer.concat(Array.from({ length: 60 }, () => frame)))
}

test.use({
  baseURL: BASE,
  storageState: { cookies: [], origins: [] },
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
      '--no-sandbox',
    ],
  },
})

const EAN = withCheckDigit(`97${String(Date.now()).slice(-10)}`)
const TITLE = 'ZZ Prueba Cámara Alta Rápida'

test.beforeAll(async () => {
  await writeBarcodeVideo(EAN)
})

test('cámara en vivo: lee el EAN, crea el producto, el POS lo encuentra y la venta descuenta stock', async ({ page }) => {
  await page.addInitScript({ path: path.join(__dirname, '..', 'node_modules', '@zxing', 'library', 'umd', 'index.min.js') })
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    w.__nativeDetector = 'BarcodeDetector' in window
    // Registro de las pistas abiertas, para comprobar que "Cerrar cámara" las apaga.
    const media = navigator.mediaDevices
    const original = media.getUserMedia.bind(media)
    const streams: MediaStream[] = []
    w.__streams = streams
    media.getUserMedia = async constraints => {
      const stream = await original(constraints)
      streams.push(stream)
      return stream
    }
    if (w.BarcodeDetector) return
    const Z = w.ZXing as typeof import('@zxing/library')
    w.BarcodeDetector = class {
      async detect(video: HTMLVideoElement): Promise<{ rawValue: string }[]> {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx || !canvas.width) return []
        ctx.drawImage(video, 0, 0)
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const lum = new Uint8ClampedArray(width * height)
        for (let i = 0; i < lum.length; i++) lum[i] = (data[i * 4] * 306 + data[i * 4 + 1] * 601 + data[i * 4 + 2] * 117) >> 10
        const reader = new Z.MultiFormatReader()
        reader.setHints(new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13]]]))
        try {
          const result = reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, width, height))))
          return [{ rawValue: result.getText() }]
        } catch {
          return []
        }
      }
    }
  })

  await login(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/captura-etiquetas')
  await page.getByRole('tab', { name: 'Alta rápida' }).click()

  await page.getByRole('button', { name: 'Escanear con la cámara' }).click()
  await expect(page.getByLabel('Cámara para leer el código de barras')).toBeVisible()
  // Sin escribir nada: el código llega solo desde la cámara.
  await expect(page.getByLabel('Título')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Código de barras', { exact: true })).toHaveValue(EAN)
  const info = await page.evaluate(() => {
    const v = document.querySelector('video')
    return `video ${v ? `${v.videoWidth}x${v.videoHeight}` : 'ausente'}; BarcodeDetector nativo: ${String((window as unknown as { __nativeDetector: boolean }).__nativeDetector)}`
  })
  await page.screenshot({ path: path.join(SHOTS, 'alta-camara-leido.png'), fullPage: true })

  await page.getByLabel('Título').fill(TITLE)
  await page.getByLabel('Cantidad', { exact: true }).fill('4')
  await page.locator('select').selectOption({ label: 'Accesorios' })
  await page.getByLabel('Precio al público (USD)').fill('9.90')
  await page.getByLabel('Precio al mayor (USD)').fill('7.5')
  await page.getByRole('button', { name: 'Guardar y siguiente' }).click()
  await expect(page.getByText(`Guardado: ${TITLE}`)).toBeVisible()

  // Con la cámara aún abierta, el mismo código recién guardado NO se vuelve a procesar solo.
  await page.waitForTimeout(1500)
  await expect(page.getByLabel('Título')).toHaveCount(0)
  await expect(page.getByText(/Ya existe:/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Cerrar cámara' }).click()
  const live = await page.evaluate(() =>
    ((window as unknown as { __streams: MediaStream[] }).__streams).flatMap(s => s.getTracks()).filter(t => t.readyState === 'live').length)
  expect(live, 'pistas de cámara aún vivas tras cerrar').toBe(0)

  const cols = sql(`SELECT id, name, barcode, price_per_unit_usd, has_variants, active, is_available, available_in_pos FROM products WHERE business_id=${BUSINESS_ID} AND barcode='${EAN}'`).split('\t')
  const productId = Number(cols[0])
  expect(cols.slice(1)).toEqual([TITLE, EAN, '9.90', '0', '1', '1', '1'])
  expect(sql(`SELECT SUM(quantity - waste) FROM inventory_entries WHERE business_id=${BUSINESS_ID} AND product_id=${productId}`)).toBe('4.000')

  const found = await page.request.get(`/api/products/search?q=${EAN}`)
  const hit = ((await found.json()) as { products: { id: number }[] }).products.find(p => p.id === productId)
  expect(hit, 'el POS debe encontrarlo por barcode').toBeTruthy()

  const rate = Number(sql('SELECT rate FROM dollar_rates ORDER BY fetched_at DESC LIMIT 1'))
  const sale = await page.request.post('/api/sales', {
    data: {
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit' }],
      status: 'paid',
      origin: 'pos',
      payments: [{ payment_method_id: 341, amount_usd: 9.9, amount_bs: Math.round(9.9 * rate * 100) / 100 }],
    },
  })
  expect(sale.status(), await sale.text()).toBe(201)
  expect(sql(`SELECT SUM(quantity - waste) FROM inventory_entries WHERE business_id=${BUSINESS_ID} AND product_id=${productId}`)).toBe('3.000')

  test.info().annotations.push({ type: 'camara', description: `EAN ${EAN}; ${info}` })
})
