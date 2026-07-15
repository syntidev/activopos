/**
 * Smoke de Fase C: genera un slide (Fase B) → PNG con Puppeteer (Fase C) → Cloudinary (Fase A).
 *
 *   npx tsx scripts/render-smoke.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import assert from 'assert'
import { config } from 'dotenv'
config()

async function main(): Promise<void> {
  const { generateHtmlContent } = await import('../src/lib/social/html-generator')
  const { renderSlideToPng, closeBrowser, ASPECT_DIMENSIONS } = await import('../src/lib/social/render-slide')
  const { uploadImage } = await import('../src/lib/social/cloudinary')
  const sharp = (await import('sharp')).default

  const content = await generateHtmlContent({
    topic: 'no sabes cuánto es tu utilidad', segmento: 'bodega', objetivo: 'Enseñar', formato: 'carrusel',
  })
  const slide = content.slides[0]
  console.log(`slide generado (${slide.notes})`)

  const png = await renderSlideToPng(slide.html, '4:5')
  await closeBrowser()

  const meta = await sharp(png).metadata()
  console.log(`PNG local: ${meta.width}x${meta.height} ${meta.format}, ${png.length} bytes`)
  assert.strictEqual(meta.format, 'png')
  assert.strictEqual(meta.width, ASPECT_DIMENSIONS['4:5'].width)
  assert.strictEqual(meta.height, ASPECT_DIMENSIONS['4:5'].height)

  mkdirSync('.tmp', { recursive: true })
  writeFileSync('.tmp/render-smoke.png', png)

  const url = await uploadImage(png, 'image/png')
  console.log('secure_url:', url)
}

main().catch(err => { console.error('FALLO:', err.message); process.exit(1) })
