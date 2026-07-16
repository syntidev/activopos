/**
 * Seed de SocialScenePreset -- 7 combinaciones reales de Personaje/Escena/Acción para los
 * segmentos más usados, así el selector del Generador no arranca vacío.
 *
 * Fenotipo explícito y distinto en cada uno a propósito: sin dirección, un difusor
 * (FLUX) tiende a repetir el mismo look "por defecto" para "Venezuela" en las 7
 * generaciones. Venezuela es mezcla real europea/árabe (herencia siria-libanesa muy
 * presente en el comercio)/indígena/afrodescendiente -- se reparte un fenotipo de cada
 * familia entre los 7, ninguno repetido, ninguno el default oscuro/caribeño único.
 *
 * Upsert real por name (update si ya existe, create si no) -- se puede correr de nuevo
 * para corregir texto sin duplicar filas ni perder el id.
 *
 *   npx tsx scripts/seed-scene-presets.ts
 */
import { config } from 'dotenv'
config()

const { prisma } = require('../src/lib/prisma')

const PRESETS = [
  {
    name:      'Bodega — mañana',
    personaje: 'dueña de bodega, mestiza, 40 años, piel morena clara, cabello negro liso recogido, delantal',
    escena:    'detrás del mostrador, luz de mañana entrando por la puerta',
    accion:    'contando billetes con alivio',
  },
  {
    name:      'Ferretería — mostrador',
    personaje: 'dueño de ferretería, descendencia europea, 55 años, piel clara, cabello canoso, camisa a cuadros',
    escena:    'entre estantes de tornillos y herramientas colgadas',
    accion:    'mostrando una herramienta a un cliente',
  },
  {
    name:      'Panadería — horno',
    personaje: 'panadero joven, rasgos árabes/libaneses, piel trigueña, cabello negro ondulado, cejas pobladas, delantal blanco con harina',
    escena:    'junto al horno, vapor y luz cálida',
    accion:    'sacando pan recién horneado con las manos',
  },
  {
    name:      'Tienda de ropa — perchero',
    personaje: 'dueña de boutique, afrodescendiente, 30 años, piel oscura, cabello rizado natural, elegante',
    escena:    'junto al perchero de ropa doblada',
    accion:    'acomodando prendas con cuidado',
  },
  {
    name:      'Repuestos — estantería',
    personaje: 'dueño de repuestos, rasgos indígenas marcados, pómulos altos, piel cobriza, cabello negro lacio, 45 años, overol de trabajo',
    escena:    'estantería llena de piezas y cajas etiquetadas',
    accion:    'buscando una pieza específica en un estante',
  },
  {
    name:      'Farmacia — mostrador',
    personaje: 'farmacéutica, descendencia italiana, piel clara rosada, ojos claros, cabello castaño, bata blanca, lentes',
    escena:    'detrás del mostrador con estantes de medicinas al fondo',
    accion:    'entregando una bolsa a un cliente',
  },
  {
    name:      'Restaurante — cocina',
    personaje: 'mesera joven, zamba, piel canela, cabello ondulado oscuro',
    escena:    'frente a una parrilla humeante',
    accion:    'sirviendo un plato recién hecho',
  },
]

async function main(): Promise<void> {
  for (const p of PRESETS) {
    const existing = await prisma.socialScenePreset.findFirst({ where: { name: p.name } })
    if (existing) {
      await prisma.socialScenePreset.update({
        where: { id: existing.id },
        data:  { personaje: p.personaje, escena: p.escena, accion: p.accion },
      })
      console.log(`~ actualizado: ${p.name}`)
      continue
    }
    await prisma.socialScenePreset.create({ data: p })
    console.log(`+ creado: ${p.name}`)
  }
  const total = await prisma.socialScenePreset.count()
  console.log(`\nOK -- ${total} presets en total`)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
