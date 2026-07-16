/**
 * Verifica PIEZA 1 (personaje/escena/acción dirigen el prompt de FLUX, no genérico) y
 * PIEZA 2 (aspect selector llega de verdad a GEN_SIZE/ASPECT_DIMENSIONS). Gasta cuota de
 * NVIDIA. Se salta la capa HTTP/auth -- mismo criterio que social-e2e.ts.
 *
 *   npx tsx scripts/social-direction-aspect-verify.ts
 */
import { mkdir } from 'fs/promises'
import assert from 'assert'
import { config } from 'dotenv'

config()

const { generateBackground } = require('../src/lib/social/image')
const { composeSlide }       = require('../src/lib/social/compose')
const sharp                  = require('sharp')

async function main(): Promise<void> {
  assert.ok(process.env.NVIDIA_API_KEY, 'NVIDIA_API_KEY ausente en .env')
  await mkdir('.tmp/direction-verify', { recursive: true })

  // Imagen A -- ferretería, aspect 3:4 (grid nuevo).
  console.log('[1/2] Generando con dirección: dueño de ferretería...')
  const bgA = await generateBackground(
    'a small business counter', 'ferretería', '3:4',
    {
      personaje: 'dueño de ferretería, 55 años, camisa a cuadros',
      lugar:     'entre estantes de tornillos y herramientas colgadas',
      accion:    'mostrando un martillo a un cliente',
    },
  )
  const metaA = await sharp(bgA).metadata()
  console.log(`  fondo A: ${metaA.width}x${metaA.height} (esperado GEN_SIZE['3:4'] = 960x1280)`)
  assert.strictEqual(metaA.width, 960)
  assert.strictEqual(metaA.height, 1280)
  const composedA = await composeSlide({
    background: bgA, titulo: 'Cada tornillo, contado', subtitulo: 'Inventario real, sin adivinar',
    formato: 'post', aspect: '3:4',
  })
  const outMetaA = await sharp(composedA).metadata()
  console.log(`  compuesto A: ${outMetaA.width}x${outMetaA.height} (esperado ASPECT_DIMENSIONS['3:4'] = 1080x1440)`)
  assert.strictEqual(outMetaA.width, 1080)
  assert.strictEqual(outMetaA.height, 1440)
  await sharp(composedA).png().toFile('.tmp/direction-verify/A-ferreteria-3x4.png')

  // Imagen B -- restaurante, aspect 9:16 (story), personaje/lugar/acción DISTINTOS.
  console.log('\n[2/2] Generando con dirección: mesera de restaurante...')
  const bgB = await generateBackground(
    'a small business counter', 'restaurante', '9:16',
    {
      personaje: 'mesera joven de restaurante',
      lugar:     'frente a una parrilla humeante',
      accion:    'sirviendo un plato recién hecho',
    },
  )
  const metaB = await sharp(bgB).metadata()
  console.log(`  fondo B: ${metaB.width}x${metaB.height} (esperado GEN_SIZE['9:16'] = 768x1344)`)
  assert.strictEqual(metaB.width, 768)
  assert.strictEqual(metaB.height, 1344)
  const composedB = await composeSlide({
    background: bgB, titulo: 'Recién servido', subtitulo: 'Tu cocina, siempre a tiempo',
    formato: 'story', aspect: '9:16',
  })
  const outMetaB = await sharp(composedB).metadata()
  console.log(`  compuesto B: ${outMetaB.width}x${outMetaB.height} (esperado ASPECT_DIMENSIONS['9:16'] = 1080x1920)`)
  assert.strictEqual(outMetaB.width, 1080)
  assert.strictEqual(outMetaB.height, 1920)
  await sharp(composedB).png().toFile('.tmp/direction-verify/B-restaurante-9x16.png')

  console.log('\nOK -- dimensiones exactas confirmadas por assert. Revisar a ojo:')
  console.log('  .tmp/direction-verify/A-ferreteria-3x4.png   (ferretero con martillo, NO vitrina genérica)')
  console.log('  .tmp/direction-verify/B-restaurante-9x16.png (mesera con plato, NO vitrina genérica)')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
