/**
 * End-to-end real del generador social: Gemini (copy + imagen) → compose → disco → DB.
 * Gasta cuota de Gemini. Ejecuta la misma cadena que POST /api/admin/social/generate,
 * saltándose solo la capa HTTP/auth.
 *
 *   npx tsx scripts/social-e2e.ts
 */
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import assert from 'assert'
import { config } from 'dotenv'

config()

// Import diferido: src/lib/prisma construye el adapter MariaDB leyendo process.env,
// así que dotenv tiene que haber corrido antes.
const { prisma }             = require('../src/lib/prisma')
const { generateCopy }       = require('../src/lib/social/gemini')   // copy: Gemini
const { generateBackground } = require('../src/lib/social/image')    // imagen: NVIDIA NIM
const { composeSlide }       = require('../src/lib/social/compose')

const NICHO    = 'bodega'
const GANCHO   = 'Cierro la caja y no me cuadra el efectivo'
const OBJETIVO = 'Que el dueño de bodega pruebe ActivoPOS gratis'

async function main(): Promise<void> {
  assert.ok(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY ausente en .env')
  assert.ok(process.env.NVIDIA_API_KEY, 'NVIDIA_API_KEY ausente en .env')

  const post = await prisma.socialPost.create({
    data: { tipo: 'post', nicho: NICHO, titulo: GANCHO.slice(0, 200), estado: 'pendiente' },
  })
  console.log(`SocialPost #${post.id} creado (pendiente)`)

  const copy = await generateCopy({
    tipo: 'post', nicho: NICHO, gancho: GANCHO, objetivo: OBJETIVO, slides: 1,
  })
  const slide = copy.slides[0]
  assert.ok(slide?.titulo && slide.subtitulo && slide.escena, 'copy incompleto')
  console.log(`Copy   -> "${slide.titulo}" / "${slide.subtitulo}"`)

  const t0         = Date.now()
  const background = await generateBackground(slide.escena, NICHO, 'post')
  console.log(`Fondo  -> ${background.length} bytes en ${((Date.now() - t0) / 1000).toFixed(1)}s (NVIDIA NIM)`)

  const composed = await composeSlide({
    background, titulo: slide.titulo, subtitulo: slide.subtitulo, formato: 'post',
  })

  const filename = `${randomUUID()}.webp`
  const dir      = join(process.cwd(), 'public', 'uploads', 'social')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), composed)
  const url = `/uploads/social/${filename}`

  const updated = await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      titulo: slide.titulo, caption: copy.caption, hashtags: copy.hashtags,
      estado: 'generado', imagen_url: url,
      assets: { create: [{ orden: 0, imagen_url: url, titulo: slide.titulo, subtitulo: slide.subtitulo }] },
    },
    include: { assets: true },
  })

  assert.strictEqual(updated.estado, 'generado')
  assert.strictEqual(updated.assets.length, 1)
  console.log(`DB     -> estado=${updated.estado}, assets=${updated.assets.length}`)
  console.log(`Imagen -> public${url}`)
  console.log(`Caption-> ${updated.caption}`)
}

main()
  .catch(err => { console.error('FALLO:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
