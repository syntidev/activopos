import type { Browser } from 'puppeteer'
import puppeteer from 'puppeteer'
import sharp from 'sharp'
import { type Aspect, ASPECT_DIMENSIONS } from './brand'

/**
 * Pipeline de render: HTML de slide → PNG a dimensiones exactas de Instagram.
 *
 * Adaptado de TempSocialia/Referencia_OpenCarrusel/src/lib/export-slides.ts. El slide es
 * HTML de nivel body (lo genera html-generator.ts); wrapSlideHtml lo mete en un documento
 * completo con el contenedor a tamaño exacto. Puppeteer lo screenshotea y sharp fuerza sRGB.
 *
 * Aspect y ASPECT_DIMENSIONS viven en brand.ts -- única fuente de verdad para el lienzo
 * final, compartida con compose.ts (pipeline de difusión).
 */
export type { Aspect }

// Chromium filtra memoria si se acumulan páginas/instancias. Se reinicia el browser cada
// N renders (mismo patrón que la referencia) para acotar el crecimiento del proceso.
const RESTART_EVERY = 30

let browser: Browser | null = null
let sinceRestart = 0

async function getBrowser(): Promise<Browser> {
  if (browser && sinceRestart >= RESTART_EVERY) {
    await browser.close().catch(() => {})
    browser = null
    sinceRestart = 0
  }
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      // --no-sandbox: el proceso corre como root en el VPS (pm2); sin esto Chromium no arranca.
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  }
  return browser
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
    sinceRestart = 0
  }
}

export function wrapSlideHtml(bodyHtml: string, width: number, height: number): string {
  // El bodyHtml ya trae su propio <style> con el @import de fuentes (lo inyecta
  // html-generator). Aquí solo se fija el lienzo exacto y se quita cualquier margen.
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0}
  #canvas{width:${width}px;height:${height}px;overflow:hidden}
</style></head>
<body><div id="canvas">${bodyHtml}</div></body></html>`
}

export async function renderSlideToPng(bodyHtml: string, aspect: Aspect = '4:5'): Promise<Buffer> {
  const { width, height } = ASPECT_DIMENSIONS[aspect]
  const b    = await getBrowser()
  const page = await b.newPage()
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    await page.setContent(wrapSlideHtml(bodyHtml, width, height), { waitUntil: 'load' })
    // Las fuentes del @import cargan async; sin esperar, el screenshot sale con la fuente
    // de fallback en vez de Fraunces/DM Sans.
    await page.evaluate(() => document.fonts.ready)

    const canvas = await page.$('#canvas')
    if (!canvas) throw new Error('no se encontró #canvas en el slide')
    const raw = await canvas.screenshot({ type: 'png' })

    sinceRestart++

    // Instagram ignora los perfiles ICC: se fuerza sRGB antes de subir para que el color
    // no se corra respecto a lo que se vio en el navegador.
    return await sharp(Buffer.from(raw)).toColorspace('srgb').png().toBuffer()
  } finally {
    await page.close().catch(() => {})
  }
}
