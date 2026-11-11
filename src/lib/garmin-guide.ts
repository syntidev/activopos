import type { GuideKind, GuideLegendRow, GuideModel, GuideStep } from '@/types/garmin-guide'

/**
 * Guía "Tu Garmin, paso a paso" (portada de .doc/onbike/Tu_Garmin_en_ONBIKE_paso_a_paso.html). Solo datos y helpers puros.
 * Los textos específicos de un modelo vienen de la guía original; lo que se agregó (software, LiveTrack, batería, garantía)
 * es GENERAL y remite a la guía de la caja o a garmin.com cuando depende del modelo. No se inventan datos por modelo.
 */

const M = (family: string, name: string, kind: GuideKind): GuideModel => ({ family, name, kind })

export const GUIDE_MODELS: readonly GuideModel[] = [
  M('Forerunner', 'Forerunner 70', 't'), M('Forerunner', 'Forerunner 170 Music', 't'), M('Forerunner', 'Forerunner 265', 't'),
  M('Forerunner', 'Forerunner 570', 't'), M('Forerunner', 'Forerunner 965', 't'), M('Forerunner', 'Forerunner 970', 't'),
  M('fēnix', 'fēnix 9', 't'), M('Venu', 'Venu X1', 't'),
  M('Instinct', 'Instinct Crossover', 'b'), M('Instinct', 'Instinct Crossover AMOLED', 'b'),
  M('CIRQA', 'CIRQA Smart Band', 's'),
  M('Edge', 'Edge 1050', 'c'), M('Edge', 'Edge 850', 'c'), M('Varia', 'Varia RearVue 820', 'r'), M('Varia', 'Varia RCT715', 'r'),
  M('HRM', 'HRM 600', 'h'), M('HRM', 'HRM 200', 'h'),
  M('Otro', 'Otro modelo con pantalla táctil', 't'), M('Otro', 'Otro modelo solo con botones', 'b'),
]

export const GUIDE_FAMILIES: readonly string[] = GUIDE_MODELS.reduce<string[]>((acc, m) => (acc.includes(m.family) ? acc : [...acc, m.family]), [])

export const KIND_LABEL: Record<GuideKind, string> = {
  t: 'Pantalla táctil y botones',
  b: 'Manejo con botones',
  s: 'Sin pantalla: todo se ve en la app',
  c: 'Computadora de bicicleta táctil',
  r: 'Radar y luz trasera',
  h: 'Banda de pulso para el pecho',
}

/* ── Helpers del negocio y de los productos ─────────────────────────── */

export const garminGuideEnabled = (settings: unknown): boolean =>
  ((settings ?? {}) as Record<string, unknown>).garmin_guide === true

export const isGarminBrand = (name: string | null | undefined): boolean => (name ?? '').trim().toLowerCase() === 'garmin'

const plain = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Modelo de la guía cuyo nombre está contenido en `text` (el más largo gana); null si ninguno. "fēnix" casa con "fenix". */
export function matchModelIndex(text: string): number | null {
  const t = plain(text)
  let best: number | null = null
  GUIDE_MODELS.forEach((m, i) => {
    if (m.family === 'Otro' || !t.includes(plain(m.name))) return
    if (best === null || m.name.length > GUIDE_MODELS[best].name.length) best = i
  })
  return best
}

/** Familia mencionada en `text` ("Forerunner 999" → "Forerunner"), para preseleccionar al menos la familia. */
export function matchFamily(text: string): string | null {
  const t = plain(text)
  return GUIDE_FAMILIES.find(f => f !== 'Otro' && t.includes(plain(f))) ?? null
}

function firstImage(raw: string | null): string | null {
  if (!raw) return null
  try {
    const list: unknown = JSON.parse(raw)
    return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : null
  } catch { return null }
}

/** Foto por modelo: primera foto del primer producto Garmin activo cuyo nombre contiene el nombre del modelo. */
export function modelImages(products: readonly { name: string; images: string | null }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of GUIDE_MODELS) {
    if (m.family === 'Otro') continue
    const key = plain(m.name)
    for (const p of products) {
      const img = plain(p.name).includes(key) ? firstImage(p.images) : null
      if (img) { out[m.name] = img; break }
    }
  }
  return out
}

/* ── Pasos ───────────────────────────────────────────────────────────── */

const L5: GuideLegendRow[] = [
  { key: 'luz', place: 'Izquierda · arriba', text: 'Enciende la luz. Mantenlo presionado para encender o apagar el reloj y abrir los controles.' },
  { key: 'up', place: 'Izquierda · centro', text: 'Sube por las listas. Mantenlo presionado para abrir el menú.' },
  { key: 'down', place: 'Izquierda · abajo', text: 'Baja por las listas.' },
  { key: 'start', place: 'Derecha · arriba', text: 'Inicia, pausa o selecciona.' },
  { key: 'back', place: 'Derecha · abajo', text: 'Vuelve a la pantalla anterior.' },
]
const LI: GuideLegendRow[] = [
  { key: 'luz', place: 'Izquierda · arriba', text: 'Enciende la pantalla; mantenlo presionado para abrir los controles.', label: 'LIGHT/CTRL' },
  { key: 'up', place: 'Izquierda · centro', text: 'Sube por los menús; mantenlo presionado para abrir el menú.', label: 'UP/MENU' },
  { key: 'down', place: 'Izquierda · abajo', text: 'Baja por los menús.', label: 'DOWN/ABC' },
  { key: 'start', place: 'Derecha · arriba', text: 'Selecciona e inicia actividades.', label: 'ENTER/GPS' },
  { key: 'back', place: 'Derecha · abajo', text: 'Vuelve a la pantalla anterior.', label: 'BACK/SET' },
]
const L2: GuideLegendRow[] = [
  { key: 'act', place: 'Derecha · arriba', text: 'Enciende la pantalla. Mantenlo presionado para encender o apagar el reloj.', label: 'ACCIÓN' },
  { key: 'back', place: 'Derecha · abajo', text: 'Vuelve a la pantalla anterior.' },
]

const SYNC_FAQ = 'Abre la app, confirma que el Bluetooth esté activo y espera unos segundos. Revisa también que la app tenga sus permisos.'

/** Pasos base para relojes (táctiles, de botones y "otro"). */
function watchSteps(m: GuideModel): GuideStep[] {
  const touch = m.kind === 't'
  const instinct = m.family === 'Instinct'
  const venu = m.family === 'Venu'
  const n = m.family === 'Otro' ? 'reloj Garmin' : m.name
  const power = instinct ? 'Presiona {luz|LIGHT/CTRL}, el botón de **arriba a la izquierda**, para encenderlo.'
    : venu ? 'Mantén presionado {act}, el botón del **costado derecho** (el de arriba), hasta que aparezca el logo.'
    : m.family === 'Otro' ? 'Mantén presionado el botón de encendido ({PW}) hasta que aparezca el logo; si dudas cuál es, míralo en el diagrama de la guía rápida de la caja.'
    : 'Mantén presionado {luz}, el botón de **arriba a la izquierda**, hasta que aparezca el logo.'
  const go = venu ? '{act} del costado derecho' : `${instinct ? '{start|ENTER/GPS}' : '{start}'} (arriba a la derecha)`
  return [
    { id: 'bienvenida', title: `Vamos a dejar tu ${n} listo`,
      paragraphs: ['Esta guía te acompaña desde el primer encendido hasta tu primera actividad. Avanza a tu ritmo: cada paso toma un par de minutos.', 'Antes de empezar, verifica que en la caja estén tu reloj y su cable de carga.'],
      tip: 'Ten a la mano tu teléfono y conexión a internet, ya sea Wi‑Fi o datos.' },
    { id: 'carga', title: 'Carga tu reloj',
      paragraphs: ['Conecta el cable al reloj: los contactos encajan en una sola posición, sin forzar.', 'Enchúfalo a un adaptador USB o al puerto de una computadora y espera a que aparezca el indicador de carga.'],
      tip: 'Si en tu zona la electricidad tiene altibajos, usa un regulador o protector de voltaje para cuidar la batería.' },
    { id: 'encendido', title: 'Enciéndelo',
      paragraphs: [power, `Elige Español como idioma y sigue las indicaciones iniciales.${touch ? ' Puedes tocar la pantalla para seleccionar.' : ''}`],
      tip: 'No te preocupes por la fecha y la hora: se ajustan solas al emparejar con tu teléfono.' },
    { id: 'manejo', title: 'Conoce tus botones', diagram: venu ? 2 : 5, legend: instinct ? LI : venu ? L2 : L5,
      paragraphs: touch
        ? ['Tu reloj tiene pantalla táctil: toca para seleccionar y desliza hacia arriba, abajo o a los lados.', 'Los botones siguen siendo importantes: sirven para encender, iniciar actividades y volver atrás. Cada número del dibujo corresponde a un botón de la lista.']
        : ['Tu reloj se maneja con botones: cada número del dibujo corresponde a un botón de la lista.', 'Cada botón hace una cosa al presionarlo y otra al mantenerlo presionado.'],
      tip: 'En muchos modelos, la pantalla marca con un color el botón que puedes usar: {g|verde} para iniciar y {r|rojo} para detener o guardar. Además, varios traen el nombre de cada botón grabado en el borde. Si tu reloj se ve distinto al dibujo, guíate por esas marcas y por la guía de la caja.' },
    { id: 'app', title: 'Descarga Garmin Connect',
      byOs: {
        iphone: ['Abre la App Store en tu iPhone.', 'Busca “Garmin Connect” y toca Obtener.', 'Abre la app cuando termine de instalarse.'],
        android: ['Abre Google Play Store en tu teléfono.', 'Busca “Garmin Connect” y toca Instalar.', 'Abre la app cuando termine de instalarse.'],
      },
      tip: 'Antes de instalar, confirma que el desarrollador sea Garmin. Si no encuentras la app, escríbenos y te ayudamos.' },
    { id: 'cuenta', title: 'Crea tu cuenta Garmin',
      list: ['Abre Garmin Connect y toca Crear cuenta.', 'Usa un correo que consultes con frecuencia y una contraseña que puedas recordar.', 'Confirma tu correo si la app te lo solicita.'],
      tip: 'Guarda tus datos de acceso: los necesitarás si algún día cambias de teléfono.' },
    { id: 'emparejar', title: 'Empareja tu reloj',
      list: ['Con el reloj encendido y cerca del teléfono, abre la app y toca el botón + para agregar un dispositivo.', 'Acepta los permisos de Bluetooth y ubicación cuando te los pida.', 'Selecciona tu reloj y confirma el código que aparece en su pantalla.'],
      tip: 'Si no aparece, apaga y enciende el Bluetooth del teléfono, acércalo al reloj e inténtalo de nuevo.' },
    { id: 'perfil', title: 'Ajusta tu perfil',
      paragraphs: ['Completa tu estatura, peso y fecha de nacimiento: con estos datos, las calorías y el pulso se calculan con más precisión.', 'Define tus unidades de medida, como kilómetros y kilogramos, y tus metas diarias.'],
      tip: 'Todo se puede cambiar después desde la app.' },
    { id: 'actividad', title: 'Tu primera actividad',
      list: ['Sal a un espacio abierto y elige una actividad, por ejemplo Caminar o Correr.', 'Espera a que el reloj encuentre la señal GPS; te lo indicará en pantalla.', `Para comenzar, presiona ${go}${touch ? ' o toca Iniciar si tu pantalla lo muestra.' : '.'}`, `Para terminar, pausa con el mismo botón (${instinct ? '{start|ENTER/GPS}' : '{start}'}), elige Guardar y listo.`],
      tip: 'El GPS responde mejor al aire libre y lejos de techos o paredes.' },
    { id: 'datos', title: 'Mira tus datos',
      paragraphs: ['Abre Garmin Connect con el reloj cerca: la información se sincroniza sola por Bluetooth.', 'Ahí verás tu actividad, tu sueño, tu pulso y tu progreso.'],
      tip: 'Sincroniza al menos una vez al día para mantener tu historial al día.' },
    { id: 'ayuda', title: 'Cuidado y ayuda', final: true,
      paragraphs: ['Después de ejercitarte, enjuágalo con agua dulce y sécalo. No lo cargues mojado.'],
      faq: [
        ['No se empareja', 'Reinicia el Bluetooth del teléfono, acerca el reloj y repite el paso de emparejar. Si persiste, reinicia el reloj.'],
        ['No sincroniza', SYNC_FAQ],
        ['La batería dura poco', 'Baja el brillo de la pantalla y revisa qué funciones tienes activas. La duración varía según el modelo.'],
      ] },
  ]
}

const byId = (steps: GuideStep[]): Record<string, GuideStep> => Object.fromEntries(steps.map(s => [s.id, s]))

function edgeSteps(base: GuideStep[], name: string): GuideStep[] {
  const by = byId(base)
  return [
    { id: 'bienvenida', title: `Vamos a dejar tu ${name} listo`, paragraphs: ['Esta guía te acompaña desde el primer encendido hasta tu primera salida en bici.', 'Verifica que en la caja estén tu Edge y su cable de carga; el soporte puede variar según el paquete.'], tip: 'Ten a la mano tu teléfono y conexión a internet.' },
    { id: 'carga', title: 'Cárgalo', paragraphs: ['Conecta el cable al puerto de carga del Edge y a un adaptador USB.', 'Espera a que tenga carga suficiente antes de emparejarlo.'], tip: by.carga.tip },
    by.app, by.cuenta,
    { id: 'encendido', title: 'Enciéndelo', list: ['Mantén presionado {pow}, el botón con el símbolo {PW} en el borde del Edge, hasta que aparezca el logo.', 'Elige Español como idioma.', 'La siguiente pantalla te propone emparejar con tu teléfono.'], tip: 'Los botones físicos del Edge llevan su símbolo grabado: {PW} encendido, ▶ iniciar y detener, y un botón de vuelta, según el modelo. Si dudas, compáralos con el diagrama de la guía de la caja.' },
    { id: 'emparejar', title: 'Empareja con tu teléfono', list: ['Con el Edge encendido, escanea con tu teléfono el código QR que aparece en su pantalla.', 'Sigue las indicaciones de Garmin Connect para completar la configuración.', 'Si no lo ves, desliza hacia abajo en la pantalla de inicio y elige Teléfono, luego Emparejar teléfono.'], tip: 'Empareja siempre desde Garmin Connect, no desde los ajustes de Bluetooth del teléfono.' },
    { id: 'pantalla', title: 'Aprende a usar la pantalla', paragraphs: ['Toca para seleccionar y desliza para ver más información, como los widgets y las pantallas de datos.', 'Puedes bloquear la pantalla táctil para evitar toques accidentales, por ejemplo con lluvia.'] },
    { id: 'salida', title: 'Tu primera salida', list: ['Sal a un espacio abierto: el Edge necesita captar la señal de los satélites antes de empezar.', 'Presiona {start|▶ INICIAR} en el Edge cuando la pantalla te lo indique.', 'Al terminar, detén y guarda el recorrido.'], tip: 'Tu salida se envía a Garmin Connect al sincronizar con el teléfono.' },
    { id: 'sensores', title: 'Conecta tus sensores', paragraphs: ['Desde el menú de Sensores del Edge puedes añadir accesorios, como una banda de pulso o un radar Varia.', 'Acércalos al Edge y mantente a unos 10 m de otros sensores mientras los emparejas.'] },
    by.datos,
    { id: 'ayuda', title: 'Cuidado y ayuda', final: true, paragraphs: ['Límpialo con un paño suave y no lo cargues mojado.'], faq: [['No se empareja', 'Reinicia el Bluetooth del teléfono, acerca el Edge y repite el emparejamiento desde Garmin Connect.'], ['No sincroniza', SYNC_FAQ], ['La batería dura poco', 'Baja el brillo de la pantalla y revisa qué funciones tienes activas.']] },
  ]
}

function variaSteps(name: string): GuideStep[] {
  return [
    { id: 'bienvenida', title: `Vamos a dejar tu ${name} listo`, paragraphs: ['La Varia te avisa de los vehículos que se acercan por detrás y funciona como luz trasera.', 'Verifica que en la caja estén el dispositivo, su soporte y el cable de carga.'], tip: 'Se muestra en tu Edge o reloj Garmin compatible; consulta la compatibilidad de tu equipo antes de usarla.' },
    { id: 'instalar', title: 'Instálala en la bici', list: ['Elige la almohadilla de goma que mejor se ajuste a tu tija: redonda, en D o aero.', 'Presiona un poco y gira el dispositivo hacia la derecha hasta que quede fijo.', 'Asegura que mire recto hacia atrás.'], tip: 'Si queda inclinada hacia un lado, el radar no detecta bien los vehículos que se acercan.' },
    { id: 'encendido', title: 'Enciéndela', list: ['Mantén presionado {pow|SU BOTÓN} 1 segundo para encenderla.', 'Mantenlo 2 segundos para apagarla.', 'Con la Varia encendida, presiona el botón para cambiar el modo de luz.'] },
    { id: 'emparejar', title: 'Empareja con tu Edge o reloj', list: ['Acerca el Edge a unos 3 m de la Varia y enciéndelo.', 'Con la Varia apagada, mantén su botón 2 segundos: la luz LED parpadea y queda en modo de emparejamiento.', 'En el menú de Sensores del Edge o reloj, elige Añadir sensor, luego Buscar todo, y selecciona tu Varia.'], tip: 'Mantente a unos 10 m de otros sensores mientras emparejas. Con la RearVue 820 también puedes usar la app Varia en tu teléfono.' },
    { id: 'radar', title: 'Mira el radar en pantalla', paragraphs: ['Al conectarse, en tu Edge aparecen sólidos los iconos del radar y de la luz.', 'Tras el primer emparejamiento, se conectan solos cuando inicias tu actividad.'], tip: 'Si el radar se desconecta, detente y revísalo en un lugar seguro: apaga y enciende ambos dispositivos.' },
    { id: 'ayuda', title: 'Cuidado y ayuda', final: true, paragraphs: ['Mantenla cargada antes de cada salida larga.'], faq: [['No se conecta al Edge', 'Apaga y enciende ambos dispositivos y repite el emparejamiento sin otros sensores cerca.'], ['No enciende', 'Conéctala al cable de carga unos minutos e inténtalo de nuevo.'], ['El radar no detecta bien', 'Verifica que esté montada recta, mirando hacia atrás.']] },
  ]
}

function hrmSteps(name: string): GuideStep[] {
  return [
    { id: 'bienvenida', title: `Vamos a dejar tu ${name} listo`, paragraphs: ['Esta banda mide tu pulso desde el pecho y lo envía a tu reloj, tu Edge o tu teléfono.', 'Verifica que en la caja estén el módulo y la correa elástica.'], tip: 'Si tu modelo es recargable, como la HRM 600, cárgalo con su cable antes del primer uso.' },
    { id: 'colocar', title: 'Colócatela bien', list: ['Encaja el módulo en la correa, con los logos de Garmin hacia arriba.', 'Moja los dos electrodos de la parte trasera de la correa.', 'Colócala directo sobre la piel, justo debajo del esternón, bien ajustada, con el broche en el lado derecho del cuerpo.'], tip: 'Calienta 5 a 10 minutos antes de empezar: si los datos salen erráticos, ajusta la correa.' },
    { id: 'emparejar', title: 'Empareja con tu dispositivo', list: ['Con la banda puesta, abre el menú de Sensores de tu reloj o Edge y elige Añadir sensor.', 'Selecciona tu banda cuando aparezca en la lista.', 'Tras el primer emparejamiento, tu dispositivo la reconoce solo cada vez que la usas.'], tip: 'Mantente a unos 10 m de otros sensores mientras emparejas. La HRM 600 también se puede emparejar desde la app Garmin Connect.' },
    { id: 'usar', title: 'Úsala en tu actividad', paragraphs: ['Pon la banda, inicia tu actividad en el reloj o Edge y verás tu pulso en pantalla.'], tip: 'Usa una camiseta de algodón o moja bien ambos lados de la correa para evitar interferencias.' },
    { id: 'ayuda', title: 'Cuidado y ayuda', final: true, paragraphs: ['Después de usarla, retira el módulo, enjuaga la correa con agua dulce y déjala secar.'], faq: [['No me da el pulso', 'Moja los electrodos, ajusta la correa para que quede firme bajo el esternón y limpia la suciedad o el sudor acumulado.'], ['No se empareja', 'Acércala al dispositivo, aléjate de otros sensores y repite el emparejamiento.'], ['Los datos salen erráticos', 'Calienta 5 a 10 minutos y revisa que la correa esté bien ajustada.']] },
  ]
}

function cirqaSteps(base: GuideStep[]): GuideStep[] {
  const by = byId(base)
  return [
    { id: 'bienvenida', title: 'Vamos a activar tu CIRQA Smart Band', paragraphs: ['Esta banda no tiene pantalla: todo lo ves en la app Garmin Connect, desde tu teléfono.', 'Antes de empezar, verifica que en la caja estén el módulo, la pulsera y el cable de carga.'], tip: 'Ten a la mano tu teléfono y conexión a internet.' },
    { id: 'activar', title: 'Actívala conectándola', list: ['Conecta el cable al puerto de carga del módulo y el otro extremo a un puerto USB.', 'La luz LED parpadeará en morado: significa que está lista para emparejarse.'], tip: 'Mantén el cable conectado mientras la emparejas.' },
    by.app, by.cuenta,
    { id: 'emparejar', title: 'Empareja tu banda', list: ['Abre Garmin Connect y toca el botón + para agregar un dispositivo.', 'Acepta los permisos de Bluetooth cuando te los pida.', 'Selecciona la CIRQA y sigue las indicaciones en la app.'], tip: 'Si la luz parpadea en rojo, el emparejamiento falló: repite el proceso.' },
    { id: 'colocar', title: 'Colócatela', paragraphs: ['Coloca el módulo en la pulsera siguiendo el diagrama de la guía de la caja y ajústala cómoda sobre la muñeca.'], tip: 'Ajústala cómoda, sin apretar: así mide mejor durante todo el día.' },
    { id: 'actividad', title: 'Registra una actividad', list: ['La banda reconoce algunas actividades por sí sola, pero también puedes iniciar una tú.', 'Presiona {pow|BOTÓN DEL MÓDULO}: la luz parpadea y la banda vibra al comenzar.', 'Al terminar, presiónalo otra vez: la luz y la vibración confirman que se guardó.'], tip: 'Después puedes ver o editar la actividad en Garmin Connect.' },
    { id: 'datos', title: 'Mira tus datos', paragraphs: ['Abre Garmin Connect con la banda cerca: la información se sincroniza sola por Bluetooth.', 'Ahí verás tu actividad, tu sueño, tu pulso y tu nivel de energía.'], tip: by.datos.tip },
    { id: 'ayuda', title: 'Cuidado y ayuda', final: true, paragraphs: ['Es resistente al agua, pero sécala después de nadar o ejercitarte.'], faq: [['¿Qué significa la luz?', 'Morado parpadeando: lista para emparejar. Rojo parpadeando: el emparejamiento falló o hubo un error. Naranja fijo: batería baja. Rojo fijo: batería muy baja.'], ['No se empareja', 'Conéctala al cable de carga, acerca el teléfono y repite el emparejamiento desde Garmin Connect.'], ['No sincroniza', SYNC_FAQ]] },
  ]
}

/** Pasos GENERALES agregados (no dependen de datos de un modelo; remiten a la caja o a garmin.com). */
function extraSteps(kind: GuideKind, businessName: string): GuideStep[] {
  const software: GuideStep = { id: 'actualizar', title: 'Mantén tu Garmin actualizado',
    list: ['Abre Garmin Connect con tu dispositivo cerca: la app te avisa cuando hay una actualización de software disponible.', 'Si la app te la ofrece, acéptala y espera a que termine sin alejarte del dispositivo.', 'También puedes actualizarlo conectándolo a una computadora con Garmin Express, el programa gratuito de Garmin.'],
    tip: 'Antes de actualizar, deja el dispositivo con buena carga y sin usarlo.' }
  const livetrack: GuideStep = { id: 'seguridad', title: 'Comparte tu ubicación con LiveTrack',
    paragraphs: ['LiveTrack permite que las personas que elijas sigan tu actividad en tiempo real desde un enlace, mientras tu dispositivo está conectado a Garmin Connect en tu teléfono.', 'Se configura desde Garmin Connect. Las funciones de seguridad y asistencia dependen del modelo: confirma las de tu equipo en la guía de la caja o en garmin.com.'],
    tip: 'Comparte el enlace solo con personas de tu confianza.' }
  const battery: GuideStep = { id: 'bateria', title: 'Cuida tu batería',
    list: ['Carga con el cable que viene en la caja y evita cargar el dispositivo mojado o con los contactos sucios.', 'Limpia los contactos de carga con un paño seco antes de conectar el cable.', 'Evita dejarlo al sol o en lugares muy calientes: el calor desgasta la batería.'],
    tip: 'La duración de la batería varía según el modelo y el uso: consulta la guía de la caja o garmin.com.' }
  const warranty: GuideStep = { id: 'garantia', title: 'Garantía y soporte',
    paragraphs: [`Conserva tu factura de compra en ${businessName}: la necesitarás para cualquier reclamo.`, 'Las condiciones de garantía son las del fabricante y pueden variar según el producto: consúltalas en la guía de la caja o en garmin.com.', `Si te atascas en cualquier paso, escríbenos por WhatsApp: ${businessName} te ayuda con la configuración.`] }
  if (kind === 'r' || kind === 'h') return [warranty]
  return kind === 's' ? [software, battery, warranty] : [software, livetrack, battery, warranty]
}

/** Preguntas frecuentes GENERALES que se suman a las del tipo de dispositivo. */
function extraFaq(kind: GuideKind): [string, string][] {
  const support: [string, string] = ['¿Dónde veo las condiciones de garantía?', 'En la guía de la caja o en garmin.com. Conserva tu factura y, si tienes dudas, escríbenos por WhatsApp.']
  const software: [string, string] = ['¿Cómo actualizo el software?', 'Abre Garmin Connect con tu dispositivo cerca y acepta la actualización cuando la app la ofrezca; también puedes usar Garmin Express en una computadora.']
  return kind === 'r' || kind === 'h' ? [support] : [software, support]
}

/** Pasos de la guía para un modelo: base por tipo + pasos y preguntas generales antes del cierre. */
export function guideSteps(m: GuideModel, businessName: string): GuideStep[] {
  const base = watchSteps(m)
  const steps = m.kind === 's' ? cirqaSteps(base) : m.kind === 'c' ? edgeSteps(base, m.name) : m.kind === 'r' ? variaSteps(m.name) : m.kind === 'h' ? hrmSteps(m.name) : base
  const last = steps[steps.length - 1]
  const closing: GuideStep = { ...last, faq: [...(last.faq ?? []), ...extraFaq(m.kind)] }
  return [...steps.slice(0, -1), ...extraSteps(m.kind, businessName), closing]
}
