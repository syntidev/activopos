/**
 * Verifica TAREA 1 (segment_slug real → arco narrativo con pains reales) y TAREA 2
 * (style_preset_id → design_rules inyectadas en el prompt). Gasta cuota de NVIDIA/Gemini.
 * Renderiza los slides HTML resultantes a PNG (mismo Puppeteer del pipeline real) para
 * confirmar VISUALMENTE la diferencia, no solo por texto.
 *
 *   npx tsx scripts/social-preset-segment-verify.ts
 */
import { mkdir } from 'fs/promises'
import assert from 'assert'
import { config } from 'dotenv'

config()

const { prisma }              = require('../src/lib/prisma')
const { generateHtmlContent } = require('../src/lib/social/html-generator')
const { renderSlideToPng, closeBrowser } = require('../src/lib/social/render-slide')

const SEGMENT_SLUG = 'ferreterias'
const OBJETIVO     = 'Que el ferretero pruebe ActivoPOS gratis'

// Regla de estilo deliberadamente extrema -- si el modelo la respeta, la diferencia
// visual contra el default es imposible de no ver.
const PRESET_DESIGN_RULES =
  'Fondo NEGRO puro (#000000) en TODOS los slides, sin excepción. Todo el texto en verde ' +
  'neón (#39FF14). Nunca uses los colores de marca azules del punto 6 -- este preset los ' +
  'sobreescribe por completo.'

async function main(): Promise<void> {
  assert.ok(process.env.NVIDIA_API_KEY, 'NVIDIA_API_KEY ausente en .env')
  assert.ok(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY ausente en .env')

  const segment = await prisma.segment.findUnique({ where: { slug: SEGMENT_SLUG } })
  assert.ok(segment, `Segment "${SEGMENT_SLUG}" no existe -- correr contra un slug real`)
  console.log(`Segment real: "${segment.headline}" / pain_1: "${segment.pain_1}"`)

  const business = await prisma.business.findFirst({ select: { id: true } })
  assert.ok(business, 'No hay ningún Business en la DB para el preset de prueba')

  const preset = await prisma.socialStylePreset.create({
    data: {
      business_id:  business.id,
      name:         'Verify: negro+verde neón',
      design_rules: PRESET_DESIGN_RULES,
    },
  })
  console.log(`SocialStylePreset #${preset.id} creado (business_id=${business.id})`)

  await mkdir('.tmp/preset-verify', { recursive: true })

  // 1) TAREA 1 -- segment_slug real, sin topic.
  console.log('\n[1/3] Generando con segment_slug (sin topic)...')
  const viaSegment = await generateHtmlContent({
    segment_slug: SEGMENT_SLUG, segmento: 'ferretería', objetivo: OBJETIVO, formato: 'carrusel',
  })
  assert.ok(viaSegment.slides.length >= 3, 'segment_slug: muy pocos slides')
  const setupText = viaSegment.slides.slice(1, 3).map((s: any) => s.html).join(' ').toLowerCase()
  console.log(`  caption: ${viaSegment.caption}`)
  console.log(`  slide 2-3 (setup) contiene texto de referencia/stock/inventario: ${
    /referenc|stock|invent/.test(setupText)}`)
  await renderSlideToPng(viaSegment.slides[0].html, '4:5')
    .then((png: Buffer) => require('fs').writeFileSync('.tmp/preset-verify/1-segment-slide1.png', png))

  // 2) TAREA 2 -- topic libre + style_preset_id (preset extremo).
  console.log('\n[2/3] Generando con style_preset_id (negro+verde neón)...')
  const viaPreset = await generateHtmlContent({
    topic: 'La caja no cuadra al final del día', segmento: 'bodega', objetivo: OBJETIVO,
    formato: 'carrusel', style_preset_id: preset.id,
  })
  await renderSlideToPng(viaPreset.slides[0].html, '4:5')
    .then((png: Buffer) => require('fs').writeFileSync('.tmp/preset-verify/2-with-preset-slide1.png', png))

  // 3) Baseline -- mismo topic, SIN preset (diseño default de marca).
  console.log('\n[3/3] Generando el mismo topic SIN preset (baseline)...')
  const viaDefault = await generateHtmlContent({
    topic: 'La caja no cuadra al final del día', segmento: 'bodega', objetivo: OBJETIVO,
    formato: 'carrusel',
  })
  await renderSlideToPng(viaDefault.slides[0].html, '4:5')
    .then((png: Buffer) => require('fs').writeFileSync('.tmp/preset-verify/3-default-slide1.png', png))

  await closeBrowser()

  console.log('\nOK -- revisar a ojo:')
  console.log('  .tmp/preset-verify/1-segment-slide1.png   (debe hablar de referencias/stock reales)')
  console.log('  .tmp/preset-verify/2-with-preset-slide1.png (debe ser negro+verde neón)')
  console.log('  .tmp/preset-verify/3-default-slide1.png     (debe ser el azul/marca de siempre)')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
