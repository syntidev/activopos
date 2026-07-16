/**
 * PIEZA 2 -- confirma visualmente que 3 de los 7 presets corregidos producen personajes
 * con fenotipo distinto entre sí (europeo, árabe/libanés, indígena), no el mismo default
 * repetido. Gasta cuota de NVIDIA -- mínimo pedido por el criterio de éxito (2-3 generaciones).
 *
 *   npx tsx scripts/scene-preset-phenotype-verify.ts
 */
import { mkdir } from 'fs/promises'
import assert from 'assert'
import { config } from 'dotenv'
config()

const { prisma }             = require('../src/lib/prisma')
const { generateBackground } = require('../src/lib/social/image')
const { composeSlide }       = require('../src/lib/social/compose')
const sharp                  = require('sharp')

const NAMES = ['Ferretería — mostrador', 'Panadería — horno', 'Repuestos — estantería']

async function main(): Promise<void> {
  assert.ok(process.env.NVIDIA_API_KEY, 'NVIDIA_API_KEY ausente en .env')
  await mkdir('.tmp/phenotype-verify', { recursive: true })

  for (let i = 0; i < NAMES.length; i++) {
    const name   = NAMES[i]
    const preset = await prisma.socialScenePreset.findFirst({ where: { name } })
    assert.ok(preset, `preset "${name}" no existe -- correr scripts/seed-scene-presets.ts primero`)

    console.log(`\n[${i + 1}/${NAMES.length}] ${name}`)
    console.log(`  personaje: ${preset.personaje}`)

    const bg = await generateBackground(
      'a small business counter', name.split(' — ')[0].toLowerCase(), '3:4',
      { personaje: preset.personaje, lugar: preset.escena, accion: preset.accion },
    )
    const composed = await composeSlide({
      background: bg, titulo: name.split(' — ')[0], subtitulo: 'preset de escena',
      formato: 'post', aspect: '3:4',
    })
    const file = `.tmp/phenotype-verify/${i + 1}-${name.split(' — ')[0].toLowerCase()}.png`
    await sharp(composed).png().toFile(file)
    console.log(`  guardado: ${file}`)
  }

  console.log('\nOK -- revisar a ojo que los 3 personajes se vean claramente distintos entre sí.')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
