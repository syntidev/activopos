/**
 * Seed de SocialStylePreset -- 2 presets de marca reales y definitivos (Alto contraste,
 * Claro editorial). "Default" NO tiene fila aquí: es código (BRAND en html-generator.ts,
 * rule 6 del prompt), no un override -- el dropdown de Estilo lo representa con la opción
 * hardcodeada "Diseño default" en page.tsx, no via SocialStylePreset.
 *
 * business_id no tiene significado real (el módulo social es contenido de marca, no
 * multi-tenant -- ver SocialPost/SocialScenePreset), pero la columna es NOT NULL heredada
 * de un diseño anterior. Se ancla al primer negocio real de la instancia (portable entre
 * entornos -- local y producción tienen ids distintos para el mismo negocio de referencia).
 *
 * Upsert real por name (update si ya existe, create si no) -- se puede correr de nuevo
 * sin duplicar filas ni perder el id.
 *
 *   npx tsx scripts/seed-style-presets.ts
 */
import { config } from 'dotenv'
config()

const { prisma } = require('../src/lib/prisma')

const PRESETS = [
  {
    name:         'Alto contraste',
    design_rules: 'Fondo PERSIAN BLUE sólido (#0038BD) en todos los slides -- sin gradiente, sin foto de fondo. Todo el texto principal en blanco (#FFFFFF) para máximo contraste. El acento (barra, badge, ícono, CTA) siempre en ÁMBAR (#EF8E01) -- es el único color que rompe el azul, úsalo con intención en un solo elemento por slide, nunca en bloques grandes de texto. NUNCA uses Navy en este preset -- Navy está reservado para Hero/Footer del sitio, no para contenido social.',
  },
  {
    name:         'Claro editorial',
    design_rules: 'Fondo SAND sólido (#FBF3E7) en todos los slides -- sin gradiente, sin foto de fondo, sin overlays oscuros. Todo el texto en NAVY (#0D1B2E) -- nunca blanco sobre este fondo claro. Composición minimalista: mucho espacio en blanco, sin bloques de color adicionales, sin badges ni acentos saturados. Si hace falta un acento sutil, usa Persian Blue (#0038BD) solo en líneas finas o subrayados, nunca en bloques.',
  },
]

async function main(): Promise<void> {
  const anchor = await prisma.business.findFirst({ orderBy: { id: 'asc' }, select: { id: true, name: true } })
  if (!anchor) {
    console.error('No hay ningún negocio en la DB -- no se puede anclar business_id')
    process.exit(1)
  }
  console.log(`Ancla: business_id ${anchor.id} (${anchor.name})\n`)

  for (const p of PRESETS) {
    const existing = await prisma.socialStylePreset.findFirst({ where: { name: p.name } })
    if (existing) {
      await prisma.socialStylePreset.update({
        where: { id: existing.id },
        data:  { design_rules: p.design_rules },
      })
      console.log(`~ actualizado: ${p.name}`)
      continue
    }
    await prisma.socialStylePreset.create({ data: { ...p, business_id: anchor.id } })
    console.log(`+ creado: ${p.name}`)
  }
  const total = await prisma.socialStylePreset.count()
  console.log(`\nOK -- ${total} presets en total`)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
