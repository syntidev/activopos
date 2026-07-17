/**
 * Seed de SocialScenePreset -- 2 variantes de Personaje por cada uno de los 26 Segment
 * reales (verificado contra la DB, no una lista adivinada), 52 filas en total. Antes había
 * 1 personaje fijo por segmento; Carlos pidió variación real de género/fenotipo dentro del
 * mismo rubro -- "Farmacia" no siempre debe salir con la misma farmacéutica. El generador
 * (page.tsx, applyScenePreset) elige al azar entre las variantes del mismo `name` cada vez
 * que se selecciona ese segmento en el dropdown.
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
 * auténtico. Cada variante B usa género y familia de fenotipo distintos a su variante A
 * del mismo segmento -- la variación real que se pidió, no un simple cambio de adjetivo.
 * Misma escena/acción entre A y B de un mismo segmento -- lo que varía es el personaje.
 *
 * Upsert real por (name + personaje) -- ambas variantes comparten `name` (es la clave de
 * agrupación que lee el frontend), personaje distingue cuál fila es cuál. Se puede correr
 * de nuevo para corregir texto sin duplicar filas ni perder el id.
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
    name:      'Bodega — mañana',
    personaje: 'dueño de bodega, afrodescendiente, 50 años, piel oscura, cabello corto canoso, camisa de rayas',
    escena:    'detrás del mostrador, luz de mañana entrando por la puerta',
    accion:    'contando billetes con alivio',
  },
  {
    name:      'Ferretería — mostrador',
    personaje: 'dueña de ferretería, descendencia europea, 55 años, piel clara, cabello canoso, camisa a cuadros',
    escena:    'entre estantes de tornillos y herramientas colgadas',
    accion:    'mostrando una herramienta a un cliente',
  },
  {
    name:      'Ferretería — mostrador',
    personaje: 'dueño de ferretería, mestizo, 35 años, piel trigueña, cabello negro corto, gorra de trabajo',
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
    name:      'Panadería — horno',
    personaje: 'panadera, afrodescendiente, 45 años, piel oscura, cabello rizado recogido en pañuelo, delantal blanco con harina',
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
    name:      'Tienda de ropa — perchero',
    personaje: 'dueño de boutique, descendencia europea, 40 años, piel clara, cabello castaño peinado, camisa elegante',
    escena:    'junto al perchero de ropa doblada',
    accion:    'acomodando prendas con cuidado',
  },
  {
    name:      'Repuestos — estantería',
    personaje: 'dueña de repuestos, mezcla mestiza con ascendencia europea, piel trigueña, pómulos marcados, cabello negro entrecano, 45 años, overol de trabajo',
    escena:    'estantería llena de piezas y cajas etiquetadas',
    accion:    'buscando una pieza específica en un estante',
  },
  {
    name:      'Repuestos — estantería',
    personaje: 'dueño de repuestos, afrodescendiente, 38 años, piel oscura, cabello corto, overol de trabajo',
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
    name:      'Farmacia — mostrador',
    personaje: 'farmacéutico, mestizo, 50 años, piel trigueña, cabello negro canoso en las sienes, bata blanca, lentes',
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
    name:      'Restaurante — cocina',
    personaje: 'mesero joven, descendencia europea, piel clara, cabello castaño corto',
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
    name:      'Óptica — mostrador',
    personaje: 'óptica, afrodescendiente, piel oscura, cabello rizado corto, lentes de marco grueso',
    escena:    'detrás del mostrador con vitrinas de lentes',
    accion:    'ajustando un armazón de lentes a un cliente',
  },
  {
    name:      'Belleza — salón',
    personaje: 'estilista, mulato, piel canela oscura, cabello afro voluminoso',
    escena:    'en el salón, sillas y espejos alrededor',
    accion:    'peinando a una clienta con secador',
  },
  {
    name:      'Belleza — salón',
    personaje: 'estilista, mestiza, 35 años, piel trigueña, cabello negro liso largo',
    escena:    'en el salón, sillas y espejos alrededor',
    accion:    'peinando a una clienta con secador',
  },
  {
    name:      'Bisutería — vitrina',
    personaje: 'vendedor, descendencia portuguesa, piel clara, cabello rubio ceniza corto',
    escena:    'junto a la vitrina de aretes y collares',
    accion:    'mostrando una pieza de bisutería a una clienta',
  },
  {
    name:      'Bisutería — vitrina',
    personaje: 'vendedora, afrodescendiente joven, piel oscura, cabello rizado con accesorios',
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
    name:      'Carnicería — mostrador',
    personaje: 'carnicera, descendencia europea, 45 años, piel clara, cabello rubio recogido, gorro de trabajo',
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
    name:      'Clínica — consultorio',
    personaje: 'doctor, afrodescendiente, piel oscura, cabello corto canoso, bata blanca',
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
    name:      'Comida Rápida — plancha',
    personaje: 'joven cocinera, mestiza, piel trigueña, cabello negro recogido, gorra',
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
    name:      'Deportes — estantería',
    personaje: 'vendedora, descendencia árabe, piel dorada, cabello negro recogido, complexión atlética',
    escena:    'entre estantes de zapatos deportivos y balones',
    accion:    'acomodando cajas de zapatos deportivos',
  },
  {
    name:      'Distribuidora — bodega',
    personaje: 'dueña, descendencia española, piel clara, cabello cano, complexión robusta, 55 años',
    escena:    'bodega grande con pallets y cajas apiladas',
    accion:    'revisando una lista de inventario en una tablilla',
  },
  {
    name:      'Distribuidora — bodega',
    personaje: 'dueño, afrodescendiente, piel oscura, cabello corto canoso, complexión robusta, 55 años',
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
    name:      'Electrónica — mostrador',
    personaje: 'técnico joven, descendencia europea, piel clara, cabello castaño corto',
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
    name:      'Frutería — puesto',
    personaje: 'vendedor, afrodescendiente, piel oscura curtida por el sol, cabello corto canoso',
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
    name:      'Gestoría y Trámites — oficina',
    personaje: 'gestora, mestiza, piel trigueña, cabello negro recogido, lentes, camisa formal',
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
    name:      'Juguetería — estantes',
    personaje: 'vendedor joven, afrodescendiente, piel oscura, cabello corto rapado',
    escena:    'estantes llenos de juguetes de colores',
    accion:    'envolviendo un juguete para regalo',
  },
  {
    name:      'Lavandería — máquinas',
    personaje: 'dueño, zambo mayor, piel oscura curtida, cabello canoso rizado, 60 años',
    escena:    'entre lavadoras industriales y ropa colgada',
    accion:    'doblando ropa recién lavada',
  },
  {
    name:      'Lavandería — máquinas',
    personaje: 'dueña, mestiza mayor, piel trigueña, cabello canoso corto, 58 años',
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
    name:      'Licorería — estantes',
    personaje: 'dueña, descendencia europea, piel clara, cabello rubio ceniza, 45 años',
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
    name:      'Mascotas — mostrador',
    personaje: 'veterinario joven, afrodescendiente, piel oscura, cabello corto rapado',
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
    name:      'Mueblería — taller',
    personaje: 'carpintera, mestiza, piel trigueña, cabello negro recogido, manos curtidas, 45 años',
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
    name:      'Papelería — estantes',
    personaje: 'dueño, afrodescendiente, piel oscura, cabello corto canoso, 50 años',
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
    name:      'Servicios y Oficina — escritorio',
    personaje: 'asistente, descendencia árabe, piel dorada, cabello negro corto, ropa formal',
    escena:    'oficina con escritorio y computadora',
    accion:    'atendiendo una llamada telefónica',
  },
  {
    name:      'Tecnología — taller',
    personaje: 'técnico joven, mezcla mestiza con ascendencia árabe, piel trigueña, cabello negro corto, barba corta',
    escena:    'mesa de trabajo con computadoras desarmadas',
    accion:    'reparando una laptop con un destornillador',
  },
  {
    name:      'Tecnología — taller',
    personaje: 'técnica joven, afrodescendiente, piel oscura, cabello rizado corto',
    escena:    'mesa de trabajo con computadoras desarmadas',
    accion:    'reparando una laptop con un destornillador',
  },
]

async function main(): Promise<void> {
  for (const p of PRESETS) {
    const existing = await prisma.socialScenePreset.findFirst({ where: { name: p.name, personaje: p.personaje } })
    if (existing) {
      await prisma.socialScenePreset.update({
        where: { id: existing.id },
        data:  { escena: p.escena, accion: p.accion },
      })
      console.log(`~ actualizado: ${p.name} (${p.personaje.slice(0, 30)}...)`)
      continue
    }
    await prisma.socialScenePreset.create({ data: p })
    console.log(`+ creado: ${p.name} (${p.personaje.slice(0, 30)}...)`)
  }
  const total = await prisma.socialScenePreset.count()
  console.log(`\nOK -- ${total} presets en total (52 esperados -- 26 segmentos x 2 variantes)`)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
