/**
 * Seed de SocialScenePreset -- un preset de Personaje/Escena/Acción por cada uno de los
 * 26 Segment reales de la tabla (verificado contra la DB, no una lista adivinada), así el
 * selector del Generador cubre todo el catálogo real de negocios, no solo los más usados.
 *
 * Fenotipo explícito y distinto en cada uno a propósito: sin dirección, un difusor
 * (FLUX) tiende a repetir el mismo look "por defecto" para "Venezuela" en generaciones
 * sucesivas. Foco estricto en comercio popular venezolano real (bodegas, abastos,
 * ferreterías, farmacias, talleres) -- mestizo/a (el más común, base de la población),
 * descendencia europea (español/canario/italiano/portugués, presente en comercio de
 * generaciones), descendencia árabe (libanesa/siria, muy presente en el comercio real),
 * afrodescendiente/zambo (especialmente costa/oriente), y mezclas combinadas entre esos.
 * Sin perfiles profesionales/médicos ni comunidades indígenas específicas -- no
 * representan al dueño típico de este tipo de negocio, se siente forzado en vez de
 * auténtico. Se reparte un fenotipo distinto de esas familias entre los 26, ninguno
 * repetido literalmente, ninguno el default oscuro/caribeño único.
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
    personaje: 'dueño de repuestos, mezcla mestiza con ascendencia europea, piel trigueña, pómulos marcados, cabello negro entrecano, 45 años, overol de trabajo',
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
  {
    name:      'Óptica — mostrador',
    personaje: 'óptico, ascendencia canaria, piel clara con pecas, cabello castaño rojizo, lentes de marco fino',
    escena:    'detrás del mostrador con vitrinas de lentes',
    accion:    'ajustando un armazón de lentes a un cliente',
  },
  {
    name:      'Belleza — salón',
    personaje: 'estilista, mulata, piel canela oscura, cabello afro voluminoso',
    escena:    'en el salón, sillas y espejos alrededor',
    accion:    'peinando a una clienta con secador',
  },
  {
    name:      'Bisutería — vitrina',
    personaje: 'vendedora, descendencia portuguesa, piel clara, cabello rubio ceniza recogido',
    escena:    'junto a la vitrina de aretes y collares',
    accion:    'mostrando una pieza de bisutería a una clienta',
  },
  {
    name:      'Carnicería — mostrador',
    personaje: 'carnicero, mestizo robusto, piel trigueña oscura, bigote grueso, gorro de trabajo',
    escena:    'detrás del mostrador refrigerado con cortes de carne',
    accion:    'cortando un trozo de carne con cuchillo',
  },
  {
    name:      'Clínica — consultorio',
    personaje: 'doctora, mestiza, piel trigueña, cabello negro liso corto, bata blanca',
    escena:    'en el consultorio, escritorio con instrumentos médicos',
    accion:    'revisando una carpeta de historia clínica',
  },
  {
    name:      'Comida Rápida — plancha',
    personaje: 'joven cocinero, zambo, piel oscura brillante, cabello rizado corto, gorra',
    escena:    'detrás de la plancha con luces de neón',
    accion:    'volteando una hamburguesa en la plancha',
  },
  {
    name:      'Deportes — estantería',
    personaje: 'vendedor, afrodescendiente joven, piel oscura, complexión atlética, cabello corto rapado',
    escena:    'entre estantes de zapatos deportivos y balones',
    accion:    'acomodando cajas de zapatos deportivos',
  },
  {
    name:      'Distribuidora — bodega',
    personaje: 'dueño, descendencia española, piel clara, cabello cano, complexión robusta, 55 años',
    escena:    'bodega grande con pallets y cajas apiladas',
    accion:    'revisando una lista de inventario en una tablilla',
  },
  {
    name:      'Electrónica — mostrador',
    personaje: 'técnica joven, mulata, piel canela clara, cabello rizado corto',
    escena:    'mostrador con celulares y televisores exhibidos',
    accion:    'mostrando un celular a un cliente',
  },
  {
    name:      'Frutería — puesto',
    personaje: 'vendedora, mestiza campesina, piel morena tostada por el sol, cabello negro trenzado',
    escena:    'puesto con cajas de frutas y verduras frescas',
    accion:    'pesando frutas en una balanza',
  },
  {
    name:      'Gestoría y Trámites — oficina',
    personaje: 'gestor, ascendencia española andaluza, piel clara, calvo, lentes, camisa formal',
    escena:    'oficina pequeña con archivador y computadora',
    accion:    'sellando un documento',
  },
  {
    name:      'Juguetería — estantes',
    personaje: 'vendedora joven, ascendencia árabe-siria, piel dorada, cabello negro rizado',
    escena:    'estantes llenos de juguetes de colores',
    accion:    'envolviendo un juguete para regalo',
  },
  {
    name:      'Lavandería — máquinas',
    personaje: 'dueña, zamba mayor, piel oscura curtida, cabello canoso rizado, 60 años',
    escena:    'entre lavadoras industriales y ropa colgada',
    accion:    'doblando ropa recién lavada',
  },
  {
    name:      'Licorería — estantes',
    personaje: 'dueño, mulato, piel canela oscura, barba entrecana, 50 años',
    escena:    'estantes de botellas iluminados detrás del mostrador',
    accion:    'envolviendo una botella para el cliente',
  },
  {
    name:      'Mascotas — mostrador',
    personaje: 'veterinaria joven, mestiza clara, pecas, cabello castaño ondulado',
    escena:    'detrás del mostrador con jaulas y alimento para mascotas',
    accion:    'cargando un cachorro con cuidado',
  },
  {
    name:      'Mueblería — taller',
    personaje: 'carpintero, afrodescendiente mayor, piel muy oscura, canoso, manos curtidas, 60 años',
    escena:    'taller con muebles de madera a medio terminar',
    accion:    'lijando una silla de madera',
  },
  {
    name:      'Papelería — estantes',
    personaje: 'dueña, descendencia portuguesa madeirense, piel clara, cabello negro liso corto',
    escena:    'estantes de cuadernos y útiles escolares',
    accion:    'organizando cuadernos en un estante',
  },
  {
    name:      'Servicios y Oficina — escritorio',
    personaje: 'asistente, mestiza urbana, piel trigueña clara, cabello liso teñido, ropa formal',
    escena:    'oficina con escritorio y computadora',
    accion:    'atendiendo una llamada telefónica',
  },
  {
    name:      'Tecnología — taller',
    personaje: 'técnico joven, mezcla mestiza con ascendencia árabe, piel trigueña, cabello negro corto, barba corta',
    escena:    'mesa de trabajo con computadoras desarmadas',
    accion:    'reparando una laptop con un destornillador',
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
