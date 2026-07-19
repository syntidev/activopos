/**
 * Seed de SocialScenePreset -- 2 variantes de Personaje por cada uno de los 26 Segment
 * reales (verificado contra la DB, no una lista adivinada), 52 filas en total. Antes había
 * 1 personaje fijo por segmento; Carlos pidió variación real de género/fenotipo dentro del
 * mismo rubro -- "Farmacia" no siempre debe salir con la misma farmacéutica. El generador
 * (page.tsx, applyScenePreset) elige al azar entre las variantes del mismo `name` cada vez
 * que se selecciona ese segmento en el dropdown.
 *
 * GÉNERO EXPLÍCITO (pedido repetido, no solo concordancia gramatical): cada personaje
 * incluye la palabra literal "hombre" o "mujer" además del sustantivo de rol ya concordado
 * (dueña/dueño, farmacéutica/farmacéutico, etc). No basta con la concordancia de género del
 * sustantivo -- el modelo de difusión (FLUX) no siempre la respeta de forma confiable, así
 * que el género queda inequívoco como palabra suelta en el prompt.
 *
 * Fenotipo explícito y distinto en cada uno a propósito: sin dirección, un difusor
 * tiende a repetir el mismo look "por defecto" para "Venezuela" en generaciones sucesivas.
 * Foco estricto en comercio popular venezolano real (bodegas, abastos, ferreterías,
 * farmacias, talleres) -- mestizo/a (el más común, base de la población), descendencia
 * europea (español/canario/italiano/portugués, presente en comercio de generaciones),
 * descendencia árabe (libanesa/siria, muy presente en el comercio real), afrodescendiente/
 * zambo (especialmente costa/oriente), y mezclas combinadas entre esos. Cada variante B usa
 * género y familia de fenotipo distintos a su variante A del mismo segmento. Misma escena/
 * acción entre A y B de un mismo segmento -- lo que varía es el personaje.
 *
 * Reseed completo por name (delete + create) -- el texto del personaje cambia entre
 * revisiones de este script, así que un upsert por (name+personaje) dejaría filas viejas
 * huérfanas en vez de reemplazarlas. Correr de nuevo siempre deja exactamente estas 52.
 *
 *   npx tsx scripts/seed-scene-presets.ts
 */
import { config } from 'dotenv'
config()

const { prisma } = require('../src/lib/prisma')

const PRESETS = [
  {
    name:      'Bodega — mañana',
    personaje: 'dueña de bodega, mujer, mestiza, 40 años, piel morena clara, cabello negro liso recogido, delantal',
    escena:    'detrás del mostrador, neveras de bebidas con puertas de vidrio iluminadas por LED al fondo, estantería metálica ordenada, luz de mañana entrando por la puerta',
    accion:    'cobrando con una tablet de punto de venta y un lector de tarjetas sobre el mostrador',
  },
  {
    name:      'Bodega — mañana',
    personaje: 'dueño de bodega, hombre, afrodescendiente, 50 años, piel oscura, cabello corto canoso, camisa de rayas',
    escena:    'detrás del mostrador, neveras de bebidas con puertas de vidrio iluminadas por LED al fondo, estantería metálica ordenada, luz de mañana entrando por la puerta',
    accion:    'cobrando con una tablet de punto de venta y un lector de tarjetas sobre el mostrador',
  },
  {
    name:      'Ferretería — mostrador',
    personaje: 'dueña de ferretería, mujer, descendencia europea, 55 años, piel clara, cabello canoso, camisa a cuadros',
    escena:    'entre estanterías metálicas modernas y ordenadas, taladros inalámbricos y herramientas eléctricas actuales colgadas en paneles perforados',
    accion:    'mostrando un taladro inalámbrico actual a un cliente',
  },
  {
    name:      'Ferretería — mostrador',
    personaje: 'dueño de ferretería, hombre, mestizo, 35 años, piel trigueña, cabello negro corto, gorra de trabajo',
    escena:    'entre estanterías metálicas modernas y ordenadas, taladros inalámbricos y herramientas eléctricas actuales colgadas en paneles perforados',
    accion:    'mostrando un taladro inalámbrico actual a un cliente',
  },
  {
    name:      'Panadería — horno',
    personaje: 'panadero joven, hombre, rasgos árabes/libaneses, piel trigueña, cabello negro ondulado, cejas pobladas, delantal blanco con harina',
    escena:    'junto al horno rotativo de acero inoxidable, vitrina de vidrio iluminada por LED, vapor y luz cálida',
    accion:    'sacando una bandeja de acero con pan recién horneado',
  },
  {
    name:      'Panadería — horno',
    personaje: 'panadera, mujer, afrodescendiente, 45 años, piel oscura, cabello rizado recogido en pañuelo, delantal blanco con harina',
    escena:    'junto al horno rotativo de acero inoxidable, vitrina de vidrio iluminada por LED, vapor y luz cálida',
    accion:    'sacando una bandeja de acero con pan recién horneado',
  },
  {
    name:      'Tienda de ropa — perchero',
    personaje: 'dueña de boutique, mujer, afrodescendiente, 30 años, piel oscura, cabello rizado natural, elegante',
    escena:    'junto a percheros metálicos minimalistas con ropa actual bien espaciada, luz LED cálida y espejo de cuerpo entero',
    accion:    'acomodando prendas de temporada actual con cuidado',
  },
  {
    name:      'Tienda de ropa — perchero',
    personaje: 'dueño de boutique, hombre, descendencia europea, 40 años, piel clara, cabello castaño peinado, camisa elegante',
    escena:    'junto a percheros metálicos minimalistas con ropa actual bien espaciada, luz LED cálida y espejo de cuerpo entero',
    accion:    'acomodando prendas de temporada actual con cuidado',
  },
  {
    name:      'Repuestos — estantería',
    personaje: 'dueña de repuestos, mujer, mezcla mestiza con ascendencia europea, piel trigueña, pómulos marcados, cabello negro entrecano, 45 años, overol de trabajo',
    escena:    'estantería metálica moderna con cajas etiquetadas y organizadas por código, iluminación LED clara',
    accion:    'buscando una pieza y confirmando el código en una tablet',
  },
  {
    name:      'Repuestos — estantería',
    personaje: 'dueño de repuestos, hombre, afrodescendiente, 38 años, piel oscura, cabello corto, overol de trabajo',
    escena:    'estantería metálica moderna con cajas etiquetadas y organizadas por código, iluminación LED clara',
    accion:    'buscando una pieza y confirmando el código en una tablet',
  },
  {
    name:      'Farmacia — mostrador',
    personaje: 'farmacéutica, mujer, descendencia italiana, piel clara rosada, ojos claros, cabello castaño, bata blanca, lentes',
    escena:    'detrás de un mostrador blanco moderno, estantes iluminados por LED con cajas de medicinas de empaque actual',
    accion:    'entregando una bolsa a un cliente',
  },
  {
    name:      'Farmacia — mostrador',
    personaje: 'farmacéutico, hombre, mestizo, 50 años, piel trigueña, cabello negro canoso en las sienes, bata blanca, lentes',
    escena:    'detrás de un mostrador blanco moderno, estantes iluminados por LED con cajas de medicinas de empaque actual',
    accion:    'entregando una bolsa a un cliente',
  },
  {
    name:      'Restaurante — cocina',
    personaje: 'mesera joven, mujer, zamba, piel canela, cabello ondulado oscuro',
    escena:    'en el salón de estética actual, mesas de madera clara, lámparas colgantes y cocina abierta de acero inoxidable al fondo',
    accion:    'sirviendo un plato emplatado con cuidado',
  },
  {
    name:      'Restaurante — cocina',
    personaje: 'mesero joven, hombre, descendencia europea, piel clara, cabello castaño corto',
    escena:    'en el salón de estética actual, mesas de madera clara, lámparas colgantes y cocina abierta de acero inoxidable al fondo',
    accion:    'sirviendo un plato emplatado con cuidado',
  },
  {
    name:      'Óptica — mostrador',
    personaje: 'óptico, hombre, ascendencia canaria, piel clara con pecas, cabello castaño rojizo, lentes de marco fino',
    escena:    'detrás del mostrador con vitrinas de vidrio iluminadas por LED y armazones actuales de acetato y metal fino',
    accion:    'ajustando un armazón moderno a un cliente',
  },
  {
    name:      'Óptica — mostrador',
    personaje: 'óptica, mujer, afrodescendiente, piel oscura, cabello rizado corto, lentes de marco grueso',
    escena:    'detrás del mostrador con vitrinas de vidrio iluminadas por LED y armazones actuales de acetato y metal fino',
    accion:    'ajustando un armazón moderno a un cliente',
  },
  {
    name:      'Belleza — salón',
    personaje: 'estilista, hombre, mulato, piel canela oscura, cabello afro voluminoso',
    escena:    'en el salón de estilo actual, estaciones con espejos grandes iluminados por LED y sillas negras modernas',
    accion:    'peinando a una clienta con secador profesional',
  },
  {
    name:      'Belleza — salón',
    personaje: 'estilista, mujer, mestiza, 35 años, piel trigueña, cabello negro liso largo',
    escena:    'en el salón de estilo actual, estaciones con espejos grandes iluminados por LED y sillas negras modernas',
    accion:    'peinando a una clienta con secador profesional',
  },
  {
    name:      'Bisutería — vitrina',
    personaje: 'vendedor, hombre, descendencia portuguesa, piel clara, cabello rubio ceniza corto',
    escena:    'junto a vitrinas de vidrio limpias con iluminación LED puntual sobre aretes y collares actuales',
    accion:    'mostrando una pieza de bisutería a una clienta',
  },
  {
    name:      'Bisutería — vitrina',
    personaje: 'vendedora, mujer, afrodescendiente joven, piel oscura, cabello rizado con accesorios',
    escena:    'junto a vitrinas de vidrio limpias con iluminación LED puntual sobre aretes y collares actuales',
    accion:    'mostrando una pieza de bisutería a una clienta',
  },
  {
    name:      'Carnicería — mostrador',
    personaje: 'carnicero, hombre, mestizo robusto, piel trigueña oscura, bigote grueso, gorro de trabajo',
    escena:    'detrás del mostrador refrigerado de vidrio y acero inoxidable, cortes frescos ordenados en bandejas',
    accion:    'cortando un trozo de carne con cuchillo',
  },
  {
    name:      'Carnicería — mostrador',
    personaje: 'carnicera, mujer, descendencia europea, 45 años, piel clara, cabello rubio recogido, gorro de trabajo',
    escena:    'detrás del mostrador refrigerado de vidrio y acero inoxidable, cortes frescos ordenados en bandejas',
    accion:    'cortando un trozo de carne con cuchillo',
  },
  {
    name:      'Clínica — consultorio',
    personaje: 'doctora, mujer, mestiza, piel trigueña, cabello negro liso corto, bata blanca',
    escena:    'en el consultorio moderno, escritorio limpio con monitor delgado e instrumentos médicos actuales',
    accion:    'revisando la historia clínica en una tablet',
  },
  {
    name:      'Clínica — consultorio',
    personaje: 'doctor, hombre, afrodescendiente, piel oscura, cabello corto canoso, bata blanca',
    escena:    'en el consultorio moderno, escritorio limpio con monitor delgado e instrumentos médicos actuales',
    accion:    'revisando la historia clínica en una tablet',
  },
  {
    name:      'Comida Rápida — plancha',
    personaje: 'joven cocinero, hombre, zambo, piel oscura brillante, cabello rizado corto, gorra',
    escena:    'detrás de la plancha de acero inoxidable, campana extractora moderna y luces LED cálidas',
    accion:    'volteando una hamburguesa en la plancha',
  },
  {
    name:      'Comida Rápida — plancha',
    personaje: 'joven cocinera, mujer, mestiza, piel trigueña, cabello negro recogido, gorra',
    escena:    'detrás de la plancha de acero inoxidable, campana extractora moderna y luces LED cálidas',
    accion:    'volteando una hamburguesa en la plancha',
  },
  {
    name:      'Deportes — estantería',
    personaje: 'vendedor, hombre, afrodescendiente joven, piel oscura, complexión atlética, cabello corto rapado',
    escena:    'entre estanterías modernas de zapatos deportivos actuales y balones, iluminación LED brillante',
    accion:    'acomodando cajas de zapatos deportivos actuales',
  },
  {
    name:      'Deportes — estantería',
    personaje: 'vendedora, mujer, descendencia árabe, piel dorada, cabello negro recogido, complexión atlética',
    escena:    'entre estanterías modernas de zapatos deportivos actuales y balones, iluminación LED brillante',
    accion:    'acomodando cajas de zapatos deportivos actuales',
  },
  {
    name:      'Distribuidora — bodega',
    personaje: 'dueña, mujer, descendencia española, piel clara, cabello cano, complexión robusta, 55 años',
    escena:    'bodega grande y ordenada con pallets, racks metálicos altos e iluminación LED industrial',
    accion:    'revisando el inventario en una tablet',
  },
  {
    name:      'Distribuidora — bodega',
    personaje: 'dueño, hombre, afrodescendiente, piel oscura, cabello corto canoso, complexión robusta, 55 años',
    escena:    'bodega grande y ordenada con pallets, racks metálicos altos e iluminación LED industrial',
    accion:    'revisando el inventario en una tablet',
  },
  {
    name:      'Electrónica — mostrador',
    personaje: 'técnica joven, mujer, mulata, piel canela clara, cabello rizado corto',
    escena:    'mostrador con vitrinas de vidrio iluminadas por LED, smartphones actuales, tablets, smartwatches y audífonos inalámbricos exhibidos, smart TV de pantalla plana delgada montado en la pared',
    accion:    'mostrando un smartphone actual de pantalla grande a un cliente',
  },
  {
    name:      'Electrónica — mostrador',
    personaje: 'técnico joven, hombre, descendencia europea, piel clara, cabello castaño corto',
    escena:    'mostrador con vitrinas de vidrio iluminadas por LED, smartphones actuales, tablets, smartwatches y audífonos inalámbricos exhibidos, smart TV de pantalla plana delgada montado en la pared',
    accion:    'mostrando un smartphone actual de pantalla grande a un cliente',
  },
  {
    name:      'Frutería — puesto',
    personaje: 'vendedora, mujer, mestiza campesina, piel morena tostada por el sol, cabello negro trenzado',
    escena:    'puesto ordenado con cajas plásticas de frutas y verduras frescas, iluminación LED clara',
    accion:    'pesando frutas en una balanza digital',
  },
  {
    name:      'Frutería — puesto',
    personaje: 'vendedor, hombre, afrodescendiente, piel oscura curtida por el sol, cabello corto canoso',
    escena:    'puesto ordenado con cajas plásticas de frutas y verduras frescas, iluminación LED clara',
    accion:    'pesando frutas en una balanza digital',
  },
  {
    name:      'Gestoría y Trámites — oficina',
    personaje: 'gestor, hombre, ascendencia española andaluza, piel clara, calvo, lentes, camisa formal',
    escena:    'oficina pequeña y ordenada con monitor delgado, archivador moderno y luz natural',
    accion:    'sellando un documento',
  },
  {
    name:      'Gestoría y Trámites — oficina',
    personaje: 'gestora, mujer, mestiza, piel trigueña, cabello negro recogido, lentes, camisa formal',
    escena:    'oficina pequeña y ordenada con monitor delgado, archivador moderno y luz natural',
    accion:    'sellando un documento',
  },
  {
    name:      'Juguetería — estantes',
    personaje: 'vendedora joven, mujer, ascendencia árabe-siria, piel dorada, cabello negro rizado',
    escena:    'estantes modernos y coloridos con juguetes actuales, iluminación LED brillante',
    accion:    'envolviendo un juguete para regalo',
  },
  {
    name:      'Juguetería — estantes',
    personaje: 'vendedor joven, hombre, afrodescendiente, piel oscura, cabello corto rapado',
    escena:    'estantes modernos y coloridos con juguetes actuales, iluminación LED brillante',
    accion:    'envolviendo un juguete para regalo',
  },
  {
    name:      'Lavandería — máquinas',
    personaje: 'dueño, hombre, zambo mayor, piel oscura curtida, cabello canoso rizado, 60 años',
    escena:    'entre lavadoras industriales modernas de acero inoxidable con panel digital, luz LED clara',
    accion:    'doblando ropa recién lavada',
  },
  {
    name:      'Lavandería — máquinas',
    personaje: 'dueña, mujer, mestiza mayor, piel trigueña, cabello canoso corto, 58 años',
    escena:    'entre lavadoras industriales modernas de acero inoxidable con panel digital, luz LED clara',
    accion:    'doblando ropa recién lavada',
  },
  {
    name:      'Licorería — estantes',
    personaje: 'dueño, hombre, mulato, piel canela oscura, barba entrecana, 50 años',
    escena:    'estantes modernos de botellas con iluminación LED detrás del mostrador',
    accion:    'envolviendo una botella para el cliente',
  },
  {
    name:      'Licorería — estantes',
    personaje: 'dueña, mujer, descendencia europea, piel clara, cabello rubio ceniza, 45 años',
    escena:    'estantes modernos de botellas con iluminación LED detrás del mostrador',
    accion:    'envolviendo una botella para el cliente',
  },
  {
    name:      'Mascotas — mostrador',
    personaje: 'veterinaria joven, mujer, mestiza clara, pecas, cabello castaño ondulado',
    escena:    'detrás de un mostrador moderno, estantes ordenados con alimento para mascotas de empaque actual',
    accion:    'cargando un cachorro con cuidado',
  },
  {
    name:      'Mascotas — mostrador',
    personaje: 'veterinario joven, hombre, afrodescendiente, piel oscura, cabello corto rapado',
    escena:    'detrás de un mostrador moderno, estantes ordenados con alimento para mascotas de empaque actual',
    accion:    'cargando un cachorro con cuidado',
  },
  {
    name:      'Mueblería — taller',
    personaje: 'carpintero, hombre, afrodescendiente mayor, piel muy oscura, canoso, manos curtidas, 60 años',
    escena:    'taller luminoso y ordenado con herramientas eléctricas actuales y muebles de líneas simples a medio terminar',
    accion:    'lijando una silla con lijadora eléctrica',
  },
  {
    name:      'Mueblería — taller',
    personaje: 'carpintera, mujer, mestiza, piel trigueña, cabello negro recogido, manos curtidas, 45 años',
    escena:    'taller luminoso y ordenado con herramientas eléctricas actuales y muebles de líneas simples a medio terminar',
    accion:    'lijando una silla con lijadora eléctrica',
  },
  {
    name:      'Papelería — estantes',
    personaje: 'dueña, mujer, descendencia portuguesa madeirense, piel clara, cabello negro liso corto',
    escena:    'estantes modernos y ordenados de cuadernos y útiles escolares de empaque actual, iluminación LED',
    accion:    'organizando cuadernos en un estante',
  },
  {
    name:      'Papelería — estantes',
    personaje: 'dueño, hombre, afrodescendiente, piel oscura, cabello corto canoso, 50 años',
    escena:    'estantes modernos y ordenados de cuadernos y útiles escolares de empaque actual, iluminación LED',
    accion:    'organizando cuadernos en un estante',
  },
  {
    name:      'Servicios y Oficina — escritorio',
    personaje: 'asistente, mujer, mestiza urbana, piel trigueña clara, cabello liso teñido, ropa formal',
    escena:    'oficina de estética actual, escritorio limpio con monitor delgado y laptop delgada',
    accion:    'atendiendo una llamada con audífonos inalámbricos',
  },
  {
    name:      'Servicios y Oficina — escritorio',
    personaje: 'asistente, hombre, descendencia árabe, piel dorada, cabello negro corto, ropa formal',
    escena:    'oficina de estética actual, escritorio limpio con monitor delgado y laptop delgada',
    accion:    'atendiendo una llamada con audífonos inalámbricos',
  },
  {
    name:      'Tecnología — taller',
    personaje: 'técnico joven, hombre, mezcla mestiza con ascendencia árabe, piel trigueña, cabello negro corto, barba corta',
    escena:    'mesa de trabajo moderna y ordenada con laptops delgadas actuales, tablets y smartphones en reparación, lámpara LED articulada y tapete antiestático',
    accion:    'reparando una laptop delgada con un destornillador de precisión',
  },
  {
    name:      'Tecnología — taller',
    personaje: 'técnica joven, mujer, afrodescendiente, piel oscura, cabello rizado corto',
    escena:    'mesa de trabajo moderna y ordenada con laptops delgadas actuales, tablets y smartphones en reparación, lámpara LED articulada y tapete antiestático',
    accion:    'reparando una laptop delgada con un destornillador de precisión',
  },
]

async function main(): Promise<void> {
  const names = Array.from(new Set(PRESETS.map(p => p.name)))
  const deleted = await prisma.socialScenePreset.deleteMany({ where: { name: { in: names } } })
  console.log(`- ${deleted.count} filas viejas eliminadas (reseed completo)\n`)

  for (const p of PRESETS) {
    await prisma.socialScenePreset.create({ data: p })
    console.log(`+ creado: ${p.name} (${p.personaje.slice(0, 40)}...)`)
  }
  const total = await prisma.socialScenePreset.count()
  console.log(`\nOK -- ${total} presets en total (52 esperados -- 26 segmentos x 2 variantes)`)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
