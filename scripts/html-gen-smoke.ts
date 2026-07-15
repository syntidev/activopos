/**
 * Smoke de Fase B: genera contenido HTML real para un topic de bodega y escribe cada
 * slide como archivo .html abrible en el navegador (envuelto en un doc mínimo para verlo).
 *
 *   npx tsx scripts/html-gen-smoke.ts
 *   -> abrir .tmp/slide-1.html en el navegador
 */
import { mkdirSync, writeFileSync } from 'fs'
import assert from 'assert'
import { config } from 'dotenv'
config()

async function main(): Promise<void> {
  const { generateHtmlContent } = await import('../src/lib/social/html-generator')

  const content = await generateHtmlContent({
    topic:    'no sabes cuánto es tu utilidad',
    segmento: 'bodega',
    objetivo: 'Enseñar',
    formato:  'carrusel',
  })

  assert.ok(content.slides.length >= 1 && content.slides.length <= 8, 'slides fuera de rango')
  content.slides.forEach(s => assert.ok(!/<script/i.test(s.html), 'slide con <script>'))

  mkdirSync('.tmp', { recursive: true })
  content.slides.forEach((s, i) => {
    const doc = `<!doctype html><meta charset="utf-8"><body style="margin:0">${s.html}</body>`
    writeFileSync(`.tmp/slide-${i + 1}.html`, doc)
  })

  console.log(`OK — ${content.slides.length} slides generados`)
  content.slides.forEach((s, i) => console.log(`  slide ${i + 1}: ${s.notes} (${s.html.length} chars html)`))
  console.log(`caption: ${content.caption}`)
  console.log(`hashtags: ${content.hashtags.join(' ')}`)
  console.log('Abrir a ojo: .tmp/slide-1.html')
}

main().catch(err => { console.error('FALLO:', err.message); process.exit(1) })
