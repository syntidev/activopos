import { prisma } from '../src/lib/prisma'
import { KitConfigSchema, type KitConfig } from '../src/lib/kit-config'

// Siembra kit200k_config para OnBike con los valores HOY hardcodeados (para
// que nada cambie visualmente cuando CLI-B rewiree Kit200KForm.tsx/page.tsx
// a leer esto en vez del literal):
//   - badge_hero / nombre_evento / fecha_texto <- Kit200KForm.tsx (heroBadge)
//   - seo_title / seo_description              <- kit-200k/page.tsx (metadata)
//   - activo: true, mostrar_en_header: true    <- comportamiento actual (sin gate)
// Idempotente: si el negocio YA tiene kit200k_config (seed previo o editado
// por Carlos desde admin), no lo toca -- nunca pisa una config real.
const SEED_DATA: Record<string, KitConfig> = {
  onbike: {
    nombre_evento:     'Gran Fondo Virgen del Valle',
    fecha_texto:        '8 Septiembre 2027',
    badge_hero:        'GRAN FONDO VIRGEN DEL VALLE — 8 SEPTIEMBRE 2027',
    seo_title:         'Kit Oficial 200K — Reserva | OnBike Margarita',
    seo_description:   'Reserva tu Kit Oficial 200K del Gran Fondo Virgen del Valle — Maillot y Medias oficiales del evento, franela incluida.',
    activo:            true,
    mostrar_en_header: true,
  },
}

async function main() {
  for (const [slug, config] of Object.entries(SEED_DATA)) {
    KitConfigSchema.parse(config) // falla rápido si el seed mismo quedó mal tipeado

    const business = await prisma.business.findFirst({
      where:  { catalog_slug: slug },
      select: { id: true, kit200k_config: true },
    })
    if (!business) {
      console.log(`[skip] negocio con catalog_slug="${slug}" no existe`)
      continue
    }
    if (business.kit200k_config !== null) {
      console.log(`[skip] business_id=${business.id} ya tiene kit200k_config -- no se pisa`)
      continue
    }

    await prisma.business.update({
      where: { id: business.id },
      data:  { kit200k_config: config },
    })
    console.log(`[ok] business_id=${business.id} (${slug}) -- kit200k_config sembrado`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
