/**
 * Capturas de referencia visual — tuproveedor.com.ve (index/catálogo/producto)
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/capture-referencia.ts
 */
import { chromium } from 'playwright'
import fs from 'fs'

const OUT = '.e2e-screenshots/referencia-catalogo'
fs.mkdirSync(OUT, { recursive: true })

const URLS = {
  index:    'https://www.tuproveedor.com.ve/',
  catalogo: 'https://www.tuproveedor.com.ve/catalogo',
  producto: 'https://www.tuproveedor.com.ve/producto.html?id=6485520000005121058',
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
  })
  const page = await ctx.newPage()

  // INDEX — top
  await page.goto(URLS.index, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/01-index-top.png` })

  // INDEX — footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/02-index-footer.png` })

  // CATÁLOGO — top
  await page.goto(URLS.catalogo, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/03-catalogo-top.png` })

  // CATÁLOGO — footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/04-catalogo-footer.png` })

  // PRODUCTO — full page
  await page.goto(URLS.producto, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/05-producto-full.png`, fullPage: true })

  await ctx.close()
  await browser.close()
  console.log('✅ 5 capturas en', OUT)
}

main().catch(console.error)
