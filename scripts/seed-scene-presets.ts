/**
 * Seed inicial de SocialScenePreset -- 7 combinaciones reales de Personaje/Escena/Acción
 * para los segmentos más usados, así el selector del Generador no arranca vacío.
 * Idempotente: usa upsert por name, se puede correr de nuevo sin duplicar.
 *
 *   npx tsx scripts/seed-scene-presets.ts
 */
import { config } from 'dotenv'
config()

const { prisma } = require('../src/lib/prisma')

const PRESETS = [
  {
    name:      'Bodega — mañana',
    personaje: 'dueña de bodega, 40 años, delantal',
    escena:    'detrás del mostrador, luz de mañana entrando por la puerta',
    accion:    'contando billetes con alivio',
  },
  {
    name:      'Ferretería — mostrador',
    personaje: 'dueño de ferretería, 55 años, camisa a cuadros',
    escena:    'entre estantes de tornillos y herramientas colgadas',
    accion:    'mostrando una herramienta a un cliente',
  },
  {
    name:      'Panadería — horno',
    personaje: 'panadero joven, delantal blanco con harina',
    escena:    'junto al horno, vapor y luz cálida',
    accion:    'sacando pan recién horneado con las manos',
  },
  {
    name:      'Tienda de ropa — perchero',
    personaje: 'dueña de boutique, elegante, 30 años',
    escena:    'junto al perchero de ropa doblada',
    accion:    'acomodando prendas con cuidado',
  },
  {
    name:      'Repuestos — estantería',
    personaje: 'dueño de repuestos, overol de trabajo, 45 años',
    escena:    'estantería llena de piezas y cajas etiquetadas',
    accion:    'buscando una pieza específica en un estante',
  },
  {
    name:      'Farmacia — mostrador',
    personaje: 'farmacéutica, bata blanca, lentes',
    escena:    'detrás del mostrador con estantes de medicinas al fondo',
    accion:    'entregando una bolsa a un cliente',
  },
  {
    name:      'Restaurante — cocina',
    personaje: 'mesera joven de restaurante',
    escena:    'frente a una parrilla humeante',
    accion:    'sirviendo un plato recién hecho',
  },
]

async function main(): Promise<void> {
  for (const p of PRESETS) {
    const existing = await prisma.socialScenePreset.findFirst({ where: { name: p.name } })
    if (existing) {
      console.log(`= ya existe: ${p.name}`)
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
