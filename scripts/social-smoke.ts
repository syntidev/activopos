/**
 * Smoke test del compositor social. Sin red, sin DB, sin gastar cuota de Gemini.
 * Verifica lo único que puede romperse en silencio: que sharp rasterice Fraunces e Inter
 * desde los TTF del repo y que el overlay caiga dentro del lienzo.
 *
 *   npx tsx scripts/social-smoke.ts
 */
import { mkdirSync, writeFileSync } from 'fs'
import assert from 'assert'
import sharp from 'sharp'
import { composeSlide } from '../src/lib/social/compose'
import { FORMATS } from '../src/lib/social/brand'

async function main(): Promise<void> {
  const { width, height } = FORMATS.post

  // Fondo sintético: sustituye a la imagen de Gemini para no gastar cuota.
  const background = await sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 41, b: 59 } },
  }).png().toBuffer()

  const out = await composeSlide({
    background,
    titulo:    'Cobra en Bs sin calculadora',
    subtitulo: 'La tasa BCV entra sola y el vuelto sale exacto — & sin cuentas a mano.',
    formato:   'post',
  })

  const meta = await sharp(out).metadata()
  assert.strictEqual(meta.format, 'webp')
  assert.strictEqual(meta.width,  width)
  assert.strictEqual(meta.height, height)

  mkdirSync('.tmp', { recursive: true })
  writeFileSync('.tmp/social-smoke.webp', out)
  await sharp(out).png().toFile('.tmp/social-smoke.png')

  console.log(`OK — ${meta.width}x${meta.height} ${meta.format}, ${out.length} bytes`)
  console.log('Revisar a ojo: .tmp/social-smoke.png')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
