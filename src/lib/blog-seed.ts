import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const dbHost     = process.env.DB_HOST ?? '127.0.0.1'
const isLoopback = dbHost === '127.0.0.1' || dbHost === 'localhost'

const adapter = new PrismaMariaDb({
  host:     dbHost,
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'activopos',
  ...(isLoopback ? { allowPublicKeyRetrieval: true } : {}),
})

const prisma = new PrismaClient({ adapter })

interface SeedPost {
  title:            string
  slug:             string
  excerpt:          string
  content:          string
  category:         string
  tags:             string[]
  read_time:        string
  is_featured:      boolean
  meta_title:       string
  meta_description: string
  daysAgo:           number
}

const POSTS: SeedPost[] = [
  {
    title:    'Cómo controlar el inventario de tu bodega sin papel ni Excel',
    slug:     'controlar-inventario-bodega-sin-papel-ni-excel',
    excerpt:  'Llevar el inventario en cuadernos o planillas de Excel funciona hasta que el negocio crece. Te contamos qué se pierde con ese método y cómo un sistema centralizado lo resuelve.',
    category: 'Inventario',
    tags:     ['inventario', 'gestión', 'pymes'],
    read_time: '4 min',
    is_featured: true,
    meta_title: 'Control de inventario sin Excel ni papel — Guía PYME',
    meta_description: 'Descubre por qué el inventario en papel o Excel falla al crecer y cómo un POS centralizado evita pérdidas por descuadre.',
    daysAgo: 2,
    content: `<h2>El problema de llevar el inventario a mano</h2>
<p>La mayoría de las bodegas y comercios pequeños en Venezuela empiezan llevando su inventario en un cuaderno o, si el dueño es más organizado, en una hoja de Excel. Funciona bien las primeras semanas — hasta que el negocio crece, entra un empleado nuevo, o simplemente se acumulan los errores de digitación.</p>
<h3>Lo que se pierde sin un sistema centralizado</h3>
<ul>
<li>No sabes en tiempo real cuánto stock queda de cada producto.</li>
<li>Los descuadres entre lo vendido y lo que hay físicamente se detectan tarde, cuando ya es difícil rastrear la causa.</li>
<li>Cada empleado con acceso a la hoja puede modificar cantidades sin dejar rastro de quién ni cuándo.</li>
<li>No hay forma fácil de saber qué productos rotan rápido y cuáles se quedan estancados.</li>
</ul>
<h2>Cómo lo resuelve un sistema centralizado</h2>
<p>Un POS que descuenta el stock automáticamente en cada venta pagada elimina el paso manual de "actualizar el Excel después". El inventario queda siempre al día porque se mueve solo, en el momento exacto del cobro — no cuando alguien se acuerda de anotarlo.</p>
<h3>Trazabilidad de cada movimiento</h3>
<p>Cada entrada, ajuste o salida de stock queda registrada con usuario y fecha. Si hay un descuadre, se puede rastrear exactamente qué pasó y quién lo hizo, en vez de adivinar entre cuadernos viejos.</p>
<p>Migrar de papel a un sistema digital no es solo comodidad — es la diferencia entre saber cuánto stock tienes hoy o descubrirlo cuando ya perdiste una venta por falta de mercancía que creías tener.</p>`,
  },
  {
    title:    'BCV en tiempo real: por qué tu POS debe actualizarse solo',
    slug:     'bcv-tiempo-real-pos-actualizacion-automatica',
    excerpt:  'Cobrar en bolívares con una tasa desactualizada genera pérdidas silenciosas todos los días. Así funciona un sistema que ajusta la tasa BCV automáticamente en cada venta.',
    category: 'Finanzas',
    tags:     ['bcv', 'dólar', 'finanzas'],
    read_time: '3 min',
    is_featured: true,
    meta_title: 'Tasa BCV automática en tu POS — Evita pérdidas cambiarias',
    meta_description: 'Aprende por qué actualizar la tasa BCV manualmente genera pérdidas y cómo un POS con tasa automática protege tu margen.',
    daysAgo: 5,
    content: `<h2>El riesgo de la tasa manual</h2>
<p>En un negocio venezolano, el bolívar se mueve todos los días frente al dólar. Si tu punto de venta usa una tasa que alguien actualiza "cuando se acuerda", cada venta cobrada con tasa vieja es dinero que se pierde poco a poco, sin que nadie lo note hasta el cierre de mes.</p>
<h3>¿Cuánto se pierde realmente?</h3>
<p>Una diferencia de tasa del 2% puede parecer insignificante en una venta individual, pero multiplicado por decenas de transacciones diarias durante semanas de tasa desactualizada, representa un hueco real en la utilidad — uno que además es difícil de rastrear después.</p>
<h2>Cómo funciona la actualización automática</h2>
<p>Un sistema conectado a una fuente oficial (como el BCV) consulta la tasa periódicamente y la aplica a cada venta en el momento del cobro. El cajero no tiene que recordar nada ni hacer cálculos — el sistema calcula el monto en bolívares multiplicando cantidad, precio en dólares y tasa vigente.</p>
<h3>Qué pasa si la fuente de tasa falla</h3>
<ul>
<li>Un sistema bien diseñado nunca debe bloquear una venta por falta de conexión a la fuente de tasa.</li>
<li>Debe existir un respaldo: la última tasa válida guardada, para que el negocio siga operando sin interrupciones.</li>
</ul>
<p>La tasa BCV automática no es un lujo — es una protección directa contra la pérdida silenciosa de margen que genera la inflación diaria.</p>`,
  },
  {
    title:    'Catálogo digital por WhatsApp: cómo vender más sin salir del negocio',
    slug:     'catalogo-digital-whatsapp-vender-mas',
    excerpt:  'Muchos clientes prefieren ver el catálogo antes de ir al local. Te explicamos cómo un catálogo digital conectado a WhatsApp convierte consultas en pedidos sin esfuerzo extra.',
    category: 'Ventas',
    tags:     ['catálogo digital', 'whatsapp', 'ventas online'],
    read_time: '4 min',
    is_featured: false,
    meta_title: 'Catálogo digital con pedidos por WhatsApp — Guía',
    meta_description: 'Cómo un catálogo digital conectado a WhatsApp ayuda a tu negocio a recibir pedidos sin depender de redes sociales.',
    daysAgo: 9,
    content: `<h2>El cliente ya no llega preguntando "¿qué tienen?"</h2>
<p>Cada vez más clientes prefieren revisar qué hay disponible antes de ir al local o de escribir por WhatsApp. Si no tienes un catálogo accesible, esa consulta se pierde o termina en un intercambio largo de fotos y mensajes.</p>
<h3>Lo que necesita un catálogo digital para funcionar de verdad</h3>
<ul>
<li>Precios y disponibilidad reales — no una lista vieja que nadie actualiza.</li>
<li>Acceso directo desde un link, sin necesidad de instalar una app.</li>
<li>Botón para pedir directo por WhatsApp, sin pasos intermedios.</li>
</ul>
<h2>Cómo se conecta con el inventario real</h2>
<p>Un catálogo digital que se alimenta directamente del inventario del POS muestra siempre lo que realmente hay en stock. Si un producto se agota, deja de aparecer disponible automáticamente — sin que nadie tenga que entrar a "actualizar la página" a mano.</p>
<h3>De consulta a pedido, sin fricción</h3>
<p>Cuando el cliente ve el producto, el precio en dólares y bolívares, y puede pedirlo con un clic que abre WhatsApp con el mensaje ya armado, la conversión de "consulta" a "pedido confirmado" sube considerablemente.</p>
<p>El catálogo digital no reemplaza la atención directa — la complementa, filtrando a los clientes que ya saben qué quieren antes de escribir.</p>`,
  },
  {
    title:    'Cierre de caja diario: el hábito que separa los negocios que crecen',
    slug:     'cierre-de-caja-diario-habito-negocios-crecen',
    excerpt:  'Cerrar caja todos los días no es solo contar billetes — es la única forma de saber con certeza si el negocio está ganando o perdiendo dinero. Así se hace bien.',
    category: 'Operaciones',
    tags:     ['caja', 'cierre diario', 'control financiero'],
    read_time: '3 min',
    is_featured: false,
    meta_title: 'Cierre de caja diario — Por qué es clave para tu negocio',
    meta_description: 'El cierre de caja diario revela problemas antes de que se acumulen. Aprende por qué es un hábito no negociable.',
    daysAgo: 14,
    content: `<h2>Contar dinero no es lo mismo que cerrar caja</h2>
<p>Muchos negocios cuentan el efectivo al final del día, pero eso no es un cierre de caja real. Un cierre de verdad compara lo que el sistema dice que se vendió contra lo que efectivamente entró — por cada método de pago, no solo en efectivo.</p>
<h3>Qué revela un cierre bien hecho</h3>
<ul>
<li>Diferencias entre lo esperado y lo real, apenas ocurren — no acumuladas por semanas.</li>
<li>Errores de cobro, descuentos mal aplicados o movimientos de caja sin registrar.</li>
<li>Un historial confiable para tomar decisiones basadas en datos reales, no en sensaciones.</li>
</ul>
<h2>Por qué hacerlo todos los días importa</h2>
<p>Un descuadre pequeño detectado el mismo día se resuelve preguntando "¿qué pasó hoy?". El mismo descuadre acumulado durante dos semanas es casi imposible de rastrear — se mezcla con otros errores y termina asumido como pérdida sin explicación.</p>
<h3>El cierre como hábito, no como excepción</h3>
<p>Los negocios que crecen de forma sostenida tratan el cierre de caja diario como algo no negociable, igual que abrir el local. No es una tarea administrativa aburrida — es el termómetro que dice, todos los días, si el negocio está sano.</p>`,
  },
  {
    title:    'Variantes de producto: tallas, colores y presentaciones en un solo sistema',
    slug:     'variantes-producto-tallas-colores-presentaciones',
    excerpt:  'Vender ropa, calzado o productos con múltiples presentaciones sin un sistema de variantes es un dolor de cabeza. Te explicamos cómo manejarlo sin duplicar productos.',
    category: 'Inventario',
    tags:     ['variantes', 'tallas', 'inventario'],
    read_time: '4 min',
    is_featured: false,
    meta_title: 'Variantes de producto en tu POS — Tallas y colores sin líos',
    meta_description: 'Cómo gestionar tallas, colores y presentaciones de un mismo producto sin duplicar registros ni perder el control del stock.',
    daysAgo: 20,
    content: `<h2>El error común: un producto por cada talla y color</h2>
<p>Cuando un negocio empieza a vender ropa o calzado, la tentación es crear un producto separado por cada combinación — "Camisa azul talla M", "Camisa azul talla L", "Camisa roja talla M"... El catálogo se llena de productos casi idénticos y mantenerlo se vuelve una pesadilla.</p>
<h3>Por qué falla ese enfoque</h3>
<ul>
<li>Cambiar el precio del producto significa editar cada variante por separado.</li>
<li>El reporte de ventas se fragmenta — no ves "cuánto vendiste de esta camisa", solo cuántas unidades de cada combinación suelta.</li>
<li>Agregar una talla nueva implica crear un producto entero desde cero.</li>
</ul>
<h2>Cómo funciona un sistema de variantes real</h2>
<p>Un producto base (la camisa) tiene un precio y una descripción únicos. Las variantes — talla, color, presentación — cuelgan de ese mismo producto, cada una con su propio stock, pero compartiendo el resto de la información.</p>
<h3>Ventajas concretas</h3>
<p>Al vender, el cajero elige el producto y después la variante específica — sin buscar entre decenas de productos casi iguales. El stock se descuenta de la variante exacta, así que siempre sabes cuántas unidades quedan de cada talla o color, no solo del producto en general.</p>
<p>Para negocios de ropa, calzado o cualquier producto con presentaciones múltiples, un sistema de variantes bien hecho es la diferencia entre un catálogo manejable y uno que nadie quiere actualizar.</p>`,
  },
]

async function main() {
  console.log('Sembrando blog...')
  const now = new Date()

  for (const p of POSTS) {
    const publishedAt = new Date(now.getTime() - p.daysAgo * 86_400_000)
    await prisma.blogPost.upsert({
      where:  { slug: p.slug },
      update: {
        title: p.title, excerpt: p.excerpt, content: p.content, category: p.category,
        tags: p.tags, read_time: p.read_time, is_featured: p.is_featured,
        meta_title: p.meta_title, meta_description: p.meta_description,
        status: 'published', published_at: publishedAt,
      },
      create: {
        title:            p.title,
        slug:             p.slug,
        excerpt:          p.excerpt,
        content:          p.content,
        category:         p.category,
        tags:             p.tags,
        read_time:        p.read_time,
        is_featured:      p.is_featured,
        meta_title:       p.meta_title,
        meta_description: p.meta_description,
        status:           'published',
        published_at:     publishedAt,
      },
    })
    console.log(`  ✓ ${p.slug}`)
  }

  console.log('Blog sembrado — 5 posts.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
