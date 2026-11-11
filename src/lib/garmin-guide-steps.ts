import type { GuideKind, GuideLegendRow, GuideModel, GuideStep } from '@/types/garmin-guide'
import { gpsmapSteps, inReachSteps } from './garmin-guide-satelite'

/**
 * Pasos de la guía "Tu Garmin, paso a paso". Cada paso: qué vas a hacer, acciones numeradas, por qué importa, error común,
 * consejo OnBike y soluciones a problemas. Lo que depende del modelo remite a "la guía rápida de tu caja"; las funciones que
 * no están en todos los modelos dicen "si tu modelo la tiene". Textos contrastados con los manuales de Garmin (Forerunner,
 * fēnix, Edge): menús, conectividad, reinicio y actualización.
 */

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

const WHATSAPP_HELP = 'Escríbenos por WhatsApp con tu modelo y cuéntanos en qué paso vas.'

const NEEDS: string[] = [
  'Tu **teléfono** con Bluetooth, con batería y buena señal.',
  'Un **correo electrónico** que revises a diario.',
  '**Wi‑Fi o datos móviles** para descargar la app Garmin Connect.',
  'El **cable de carga** que viene en la caja y un adaptador USB.',
]
const VENEZUELA: string[] = [
  'Carga con un **regulador o protector de voltaje**: los altibajos de la luz desgastan la batería.',
  '**Carga antes de emparejar**: si se apaga a la mitad, el proceso se corta.',
  'Si el Wi‑Fi falla, **descarga la app con datos móviles**; revisa antes que tu plan tenga datos.',
]

const bienvenida = (dev: string, nombre: string, inBox: string): GuideStep => ({
  id: 'bienvenida', title: `Vamos a dejar tu ${nombre} listo`,
  goal: `Vas a dejar tu ${dev} funcionando, desde el primer encendido hasta tu primer uso.`,
  actions: [`Revisa que en la caja estén ${inBox}.`, 'Ten el **teléfono a la mano**, cargado y con conexión a internet.', 'Avanza a tu ritmo: cada paso toma **un par de minutos**.', 'Marca **Listo** al terminar cada paso: tu avance se guarda y puedes retomarlo después.'],
  why: 'Hacerlo en orden evita casi todos los problemas, porque cada paso prepara el siguiente.',
  mistake: 'Saltarse la carga o la cuenta y empezar por emparejar. Sigue el orden y te ahorras vueltas.',
  tip: 'Aparta unos 15 minutos y hazlo con calma, con el teléfono cargado.',
  trouble: [['Falta algo en la caja', 'Escríbenos por WhatsApp con tu factura y te ayudamos enseguida.'], ['No sé por dónde empezar', 'Empieza por cargar el dispositivo (paso 2) mientras instalas la app.']],
  needs: NEEDS, venezuela: VENEZUELA,
})

const app = (dev: string): GuideStep => ({
  id: 'app', title: 'Descarga Garmin Connect',
  goal: `Vas a instalar Garmin Connect, la app que configura tu ${dev} y guarda tu historial.`,
  actions: [],
  byOs: {
    iphone: ['Abre la **App Store** en tu iPhone.', 'Toca **Buscar** y escribe “Garmin Connect”.', 'Toca **Obtener** y espera a que termine de instalarse.', 'Abre la app y **acepta los permisos** que te pida, como Bluetooth y notificaciones.'],
    android: ['Abre la **Play Store** en tu teléfono.', 'Busca “Garmin Connect”.', 'Toca **Instalar** y espera a que termine.', 'Abre la app y **acepta los permisos** que te pida, como dispositivos cercanos o ubicación según tu Android.'],
  },
  why: `Sin esta app no puedes emparejar el ${dev}, actualizarlo ni ver tus datos.`,
  mistake: 'Instalar una app con nombre parecido. Verifica que el desarrollador sea Garmin y que el ícono sea el de Garmin Connect.',
  tip: 'Si no tienes Wi‑Fi estable, descárgala con datos móviles; revisa antes que tu plan tenga datos disponibles.',
  trouble: [['No encuentro la app', 'Escribe “Garmin Connect” completo. Si no sale, actualiza el sistema del teléfono o escríbenos por WhatsApp.'], ['La descarga se queda cargando', 'Cambia entre Wi‑Fi y datos móviles, libera espacio en el teléfono y vuelve a intentar.'], ['Me pide actualizar el teléfono', 'Actualiza el sistema del teléfono y reintenta: la app necesita una versión reciente.']],
})

const cuenta = (): GuideStep => ({
  id: 'cuenta', title: 'Crea tu cuenta Garmin',
  goal: 'Vas a crear tu cuenta Garmin, donde se guardan tus actividades y tu salud.',
  actions: ['Abre Garmin Connect y toca **Crear cuenta**.', 'Escribe un **correo que revises a diario** y una contraseña que recuerdes.', '**Confirma tu correo** con el mensaje que te llega.', 'Completa los datos que la app te pida.'],
  why: 'Con tu cuenta puedes cambiar de teléfono sin perder tu historial.',
  mistake: 'Escribir mal el correo o usar uno que no revisas: el mensaje de confirmación no llega. Escríbelo despacio y revisa también el spam.',
  tip: 'Anota tu correo y tu contraseña en un lugar seguro; los vas a necesitar si cambias de teléfono.',
  trouble: [['No me llega el correo de confirmación', 'Revisa spam y promociones, espera unos minutos y pide que lo reenvíen desde la app.'], ['Dice que mi correo ya existe', 'Quizá ya tienes una cuenta Garmin: inicia sesión en lugar de crear otra.'], ['Olvidé mi contraseña', 'Toca “¿Olvidaste tu contraseña?” en la pantalla de acceso y sigue el correo que te llega.']],
})

const datos = (dev: string): GuideStep => ({
  id: 'datos', title: 'Mira tus datos',
  goal: `Vas a ver en Garmin Connect lo que registró tu ${dev}.`,
  actions: [`Abre Garmin Connect con el ${dev} **cerca del teléfono**.`, 'Espera unos segundos: la app **sincroniza sola** por Bluetooth.', 'Revisa la pantalla **Hoy**: pasos, pulso, sueño y energía, si tu modelo los mide.', 'Toca una actividad para ver el **detalle y el recorrido**.'],
  why: 'Ver tus datos te ayuda a entender cómo duermes, cómo te mueves y cómo mejorar.',
  mistake: 'Creer que no sincroniza porque no ves datos al instante: a veces tarda un poco. Mantén la app abierta y el Bluetooth activo.',
  tip: 'Sincroniza al menos una vez al día para tener tu historial al día.',
  trouble: [['No aparecen mis datos', 'Confirma que el Bluetooth esté activo y desliza hacia abajo en Hoy para forzar la sincronización.'], ['La hora se ve incorrecta', 'Sincroniza con el teléfono: la hora se ajusta sola con la del teléfono.'], ['Faltan actividades', 'Sincroniza de nuevo y revisa que la actividad se haya guardado en el dispositivo.']],
})

const emparejarReloj = (dev: string): GuideStep => ({
  id: 'emparejar', title: `Empareja tu ${dev}`,
  goal: `Vas a unir tu ${dev} con el teléfono para que se sincronicen.`,
  actions: [`Con el ${dev} **encendido y cerca** del teléfono, abre Garmin Connect.`, 'Toca el botón **+** (o **Agregar dispositivo**).', '**Acepta los permisos** de Bluetooth y ubicación cuando los pida.', 'Elige tu dispositivo en la lista y **confirma el código** que aparece en su pantalla.'],
  why: 'Esta unión permite que la hora, las actividades y las notificaciones viajen del dispositivo al teléfono.',
  mistake: 'Emparejar desde los ajustes de Bluetooth del teléfono. Hazlo siempre desde Garmin Connect y mantén el teléfono pegado al dispositivo hasta terminar.',
  tip: 'Carga el dispositivo antes de emparejar: si se apaga a la mitad, el proceso se corta.',
  trouble: [['No aparece en la lista', 'Apaga y enciende el Bluetooth del teléfono, acerca más el dispositivo y toca buscar otra vez.'], ['El código no coincide', 'Cancela, reinicia el dispositivo y repite el proceso desde Garmin Connect.'], ['Se queda en “Conectando…”', 'Cierra Garmin Connect por completo, ábrelo de nuevo y repite; si no, reinicia el teléfono.']],
})

/** Pasos base de relojes (táctiles, de botones y "otro"). */
function watchSteps(m: GuideModel): GuideStep[] {
  const touch = m.kind === 't'
  const instinct = m.family === 'Instinct'
  const venu = m.family === 'Venu'
  const nombre = m.family === 'Otro' ? 'reloj Garmin' : m.name
  const power = instinct ? 'Presiona {luz|LIGHT/CTRL}, el botón de **arriba a la izquierda**, para encenderlo.'
    : venu ? 'Mantén presionado {act}, el botón del **costado derecho** (el de arriba), hasta que aparezca el logo.'
    : m.family === 'Otro' ? 'Mantén presionado el **botón de encendido** ({PW}) hasta que aparezca el logo. Si dudas cuál es, míralo en el diagrama de la guía rápida de tu caja.'
    : 'Mantén presionado {luz}, el botón de **arriba a la izquierda**, hasta que aparezca el logo.'
  const startKey = instinct ? '{start|ENTER/GPS}' : '{start}'
  const go = venu ? '{act} del costado derecho' : `${startKey} (arriba a la derecha)`
  return [
    bienvenida('reloj', nombre, 'el **reloj** y su **cable de carga**'),
    { id: 'carga', title: 'Carga tu reloj',
      goal: 'Vas a cargar la batería antes de usar el reloj.',
      actions: ['Conecta el cable al reloj: los **contactos encajan en una sola posición**, sin forzar.', 'Enchufa el otro extremo a un **adaptador USB** o al puerto de una computadora.', 'Espera a que aparezca el **indicador de carga** en la pantalla.', 'Déjalo cargar un buen rato antes de seguir con la app.'],
      why: 'Un reloj con poca batería puede apagarse en medio de la configuración.',
      mistake: 'Forzar el cable al revés o cargar con los contactos sucios o mojados. Límpialos con un paño seco antes de conectar.',
      tip: 'Si la luz de tu zona sube y baja, usa un regulador o protector de voltaje: cuida la batería de tu reloj.',
      trouble: [['No aparece el indicador de carga', 'Revisa que el cable esté bien encajado, prueba otro adaptador USB y limpia los contactos.'], ['Carga muy lento', 'Usa un adaptador USB estándar en buen estado; los cargadores viejos o muy genéricos pueden tardar más.'], ['Se calienta mucho', 'Desconéctalo, déjalo enfriar y vuelve a conectar sin forzar el cable.']] },
    { id: 'encendido', title: 'Enciéndelo',
      goal: 'Vas a encender el reloj y elegir el idioma.',
      actions: [power, 'Elige **Español** como idioma.', `Sigue las **indicaciones iniciales**: confirma cada pantalla con el botón de iniciar${touch ? ' o toca la opción en la pantalla' : ''}.`, 'Si te propone emparejar con el teléfono, déjalo para el paso de emparejar.'],
      why: 'El idioma y la configuración inicial dejan el reloj listo para recibir tus datos.',
      mistake: 'Soltar el botón antes de tiempo. Mantén presionado hasta ver el logo; puede tardar unos segundos.',
      tip: 'No te preocupes por la fecha y la hora: se ajustan solas al emparejar con el teléfono.',
      trouble: [['No enciende', 'Conéctalo al cable y déjalo cargar unos minutos; luego vuelve a mantener presionado el botón.'], ['Se queda en el logo', 'Déjalo cargar y reinícialo con la guía rápida de tu caja; en muchos relojes con botones se mantiene presionado el botón de luz hasta que se apague.'], ['Quedó en otro idioma', 'Busca el idioma dentro de Ajustes > Sistema; la ruta puede variar según el modelo.']] },
    { id: 'manejo', title: 'Conoce tus botones', diagram: venu ? 2 : 5, legend: instinct ? LI : venu ? L2 : L5,
      goal: 'Vas a conocer los botones para moverte sin miedo.',
      actions: touch
        ? ['Mira el **dibujo**: cada número es un botón de la lista.', '**Toca** la pantalla para seleccionar y **desliza** para ver más.', '**Presiona** cada botón una vez y fíjate qué cambia.', '**Mantén presionado** el botón de arriba a la izquierda: en muchos modelos abre los controles.']
        : ['Mira el **dibujo**: cada número es un botón de la lista.', '**Presiona** cada botón una vez y fíjate qué cambia.', '**Mantén presionado** para descubrir la segunda función de cada botón.', 'Para volver atrás, presiona el botón **BACK**.'],
      why: 'Conocer los botones te permite iniciar, pausar y guardar actividades sin dudar.',
      mistake: 'Presionar sin fuerza o soltar muy rápido: algunos botones necesitan unos segundos presionados. Mira también las marcas grabadas en el borde.',
      tip: 'La pantalla suele marcar con un color el botón que puedes usar: {g|verde} para iniciar y {r|rojo} para detener o guardar. Si tu reloj se ve distinto al dibujo, guíate por la guía rápida de tu caja.',
      trouble: [['Un botón no responde', 'Prueba mantenerlo presionado más tiempo; si sigue igual, reinicia el reloj.'], touch ? ['Toco y no pasa nada', 'Seca la pantalla y tus dedos: con humedad o guantes el táctil responde mal.'] : ['Me pierdo en los menús', 'Presiona BACK varias veces hasta volver a la pantalla del reloj y empieza de nuevo.']] },
    app('reloj'), cuenta(), emparejarReloj('reloj'),
    { id: 'perfil', title: 'Ajusta tu perfil',
      goal: 'Vas a ajustar tu perfil para que las calorías y el pulso sean más precisos.',
      actions: ['En Garmin Connect abre tu **perfil** (tu foto o tus iniciales).', 'Completa **estatura, peso y fecha de nacimiento**.', 'Elige tus **unidades**: kilómetros y kilogramos.', 'Define tus **metas diarias**, por ejemplo los pasos.'],
      why: 'Con tus datos reales, el reloj calcula mejor las calorías, las zonas de pulso y tus metas.',
      mistake: 'Dejar los datos por defecto: los cálculos salen lejos de la realidad. Tómate un minuto y complétalos.',
      tip: 'Todo se puede cambiar después desde la app; no tiene que quedar perfecto hoy.',
      trouble: [['No encuentro mi perfil', 'Busca tu foto o tus iniciales, o el menú Más, dentro de Garmin Connect; el nombre cambia según la versión de la app.'], ['Los pasos del reloj y del teléfono no coinciden', 'Es normal: cada dispositivo cuenta distinto. Usa uno solo como referencia.']] },
    { id: 'actividad', title: 'Tu primera actividad',
      goal: 'Vas a registrar tu primera actividad con GPS.',
      actions: ['Sal a un **espacio abierto**, lejos de techos y paredes altas.', 'Elige una **actividad**, por ejemplo Caminar o Correr.', 'Espera a que el reloj **encuentre la señal GPS**; te avisa en pantalla.', `Para comenzar, presiona ${go}${touch ? ' o toca Iniciar si tu pantalla lo muestra' : ''}. Para terminar, **pausa** con el mismo botón, elige **Guardar** y listo.`],
      why: 'La primera actividad confirma que el GPS, el reloj y la sincronización funcionan juntos.',
      mistake: 'Empezar sin esperar el GPS: el recorrido sale incompleto. Aguarda el aviso de señal lista.',
      tip: 'El GPS responde mejor al aire libre; en el primer uso puede tardar un poco más.',
      trouble: [['No encuentra la señal GPS', 'Muévete a un lugar despejado, quédate quieto unos minutos y evita techos.'], ['No me deja guardar', 'Pausa primero la actividad y luego elige Guardar; confirma que haya batería.'], ['La distancia sale rara', 'Si empezaste antes de que hubiera GPS, el inicio queda mal; la próxima vez espera la señal.']] },
    datos('reloj'),
    { id: 'ayuda', title: 'Cuidado y ayuda',
      goal: 'Vas a aprender a cuidar tu reloj y qué hacer si algo falla.',
      actions: ['Después de ejercitarte, **enjuágalo con agua dulce** y sécalo.', '**No lo cargues mojado**: seca el cable y los contactos.', 'Límpialo con un **paño suave**, sin jabones fuertes.', 'Si algo falla, mira la pestaña **Preguntas frecuentes** o escríbenos por WhatsApp.'],
      why: 'Un buen cuidado alarga la vida del reloj y de su batería.',
      mistake: 'Cargarlo con sudor o agua en los contactos: con el tiempo puede dañarlos.',
      tip: 'Guarda el cable en la caja, lejos de la humedad.',
      trouble: [['Los contactos se ven sucios', 'Límpialos con un paño seco o un cepillo suave antes de cargar.'], ['Necesito ayuda con algo que no está aquí', WHATSAPP_HELP]] },
  ]
}

function edgeSteps(m: GuideModel): GuideStep[] {
  return [
    bienvenida('Edge', m.name, 'tu **Edge** y su **cable de carga** (el soporte puede variar según el paquete)'),
    { id: 'carga', title: 'Cárgalo',
      goal: 'Vas a cargar el Edge antes de la primera salida.',
      actions: ['Conecta el cable al **puerto de carga** del Edge.', 'Enchufa el otro extremo a un **adaptador USB**.', 'Espera a que aparezca el **indicador de carga**.', 'Déjalo cargar un buen rato antes de emparejarlo.'],
      why: 'Si el Edge se apaga mientras lo configuras, el emparejamiento se corta y hay que repetirlo.',
      mistake: 'Cargarlo con el puerto sucio o mojado. Sécalo y límpialo con un paño seco antes de conectar.',
      tip: 'Si en tu zona hay altibajos de luz, usa un regulador o protector de voltaje: cuida la batería del Edge.',
      trouble: [['No carga', 'Revisa el cable, prueba otro adaptador USB y limpia el puerto con un paño seco.'], ['Carga lento', 'Usa un adaptador USB estándar en buen estado.']] },
    app('Edge'), cuenta(),
    { id: 'encendido', title: 'Enciéndelo',
      goal: 'Vas a encender el Edge y elegir el idioma.',
      actions: ['Mantén presionado {pow}, el botón con el símbolo {PW} en el borde del Edge, hasta que aparezca el logo.', 'Elige **Español** como idioma.', 'Sigue las indicaciones hasta que te proponga **emparejar con el teléfono**.'],
      why: 'Así el Edge queda listo para unirse a tu teléfono en el siguiente paso.',
      mistake: 'Soltar el botón antes de ver el logo. Mantén presionado unos segundos, sin soltar.',
      tip: 'Los botones del Edge llevan su símbolo grabado ({PW} encendido, ▶ iniciar y detener); si dudas, compáralos con la guía rápida de tu caja.',
      trouble: [['No enciende', 'Déjalo cargando unos minutos y vuelve a mantener presionado el botón.'], ['Se queda en el logo', 'Déjalo cargar y reinícialo según la guía rápida de tu caja.']] },
    { id: 'emparejar', title: 'Empareja con tu teléfono',
      goal: 'Vas a unir el Edge con tu teléfono desde Garmin Connect.',
      actions: ['Con el Edge encendido, **escanea con tu teléfono** el código QR que aparece en su pantalla.', 'Sigue las indicaciones de **Garmin Connect** para completar la configuración.', 'Si no ves el código, desliza hacia abajo en la pantalla de inicio y elige **Teléfono**, luego **Emparejar teléfono**.'],
      why: 'Con el Edge emparejado, tus salidas se guardan en tu cuenta y puedes recibir avisos del teléfono, si tu modelo los tiene.',
      mistake: 'Emparejar desde los ajustes de Bluetooth del teléfono. Hazlo siempre desde Garmin Connect.',
      tip: 'Mantén el teléfono pegado al Edge hasta que termine el proceso.',
      trouble: [['No me sale el código QR', 'Entra a Teléfono > Emparejar teléfono en el Edge; el código aparece ahí.'], ['No se empareja', 'Reinicia el Bluetooth del teléfono, acerca el Edge y repite desde Garmin Connect.']] },
    { id: 'pantalla', title: 'Aprende a usar la pantalla',
      goal: 'Vas a moverte por las pantallas del Edge sin dudar.',
      actions: ['**Toca** la pantalla para seleccionar.', '**Desliza** para ver más pantallas de datos y widgets.', 'Si hay lluvia, **bloquea la pantalla táctil** para evitar toques por accidente.', 'Recorre las pantallas en casa, antes de salir.'],
      why: 'Con las pantallas de datos ves velocidad, distancia y tiempo mientras pedaleas, sin sacar el teléfono.',
      mistake: 'Usar la pantalla con guantes o mojada: puede fallar. Sécala o usa los botones, si tu modelo los tiene.',
      tip: 'Practica en casa: así en la calle no te distraes buscando una pantalla.',
      trouble: [['La pantalla no responde', 'Sécala, límpiala con un paño suave y desbloquéala.'], ['No encuentro una pantalla', 'Desliza de lado a lado; si no, revisa la guía rápida de tu caja.']] },
    { id: 'salida', title: 'Tu primera salida',
      goal: 'Vas a registrar tu primera salida en bici.',
      actions: ['Sal a un **espacio abierto**: el Edge necesita captar la señal de los satélites.', 'Presiona {start|▶ INICIAR} cuando la pantalla te lo indique.', 'Pedalea con calma y fíjate en las pantallas de datos.', 'Al terminar, **detén y guarda** el recorrido.'],
      why: 'La primera salida confirma que el GPS y la sincronización funcionan antes de un recorrido largo.',
      mistake: 'Empezar sin esperar la señal: el recorrido sale incompleto y los primeros metros no cuentan. Espera a que el Edge te avise.',
      tip: 'Tu salida se envía a Garmin Connect al sincronizar con el teléfono; abre la app al llegar para verla en el mapa.',
      trouble: [['No encuentra señal', 'Quédate unos minutos al aire libre, lejos de techos y paredes.'], ['No guardó la salida', 'Detén el recorrido y elige Guardar antes de apagar el Edge.']] },
    { id: 'sensores', title: 'Conecta tus sensores',
      goal: 'Vas a añadir un sensor, como una banda de pulso o un radar Varia.',
      actions: ['Entra al **menú de Sensores** del Edge.', 'Elige **Añadir sensor** y acerca el accesorio.', 'Mantente a unos **10 m de otros sensores** mientras emparejas.', 'Selecciona tu sensor cuando aparezca.'],
      why: 'Con sensores ves tu pulso o los vehículos que se acercan sin sacar el teléfono.',
      mistake: 'Emparejar con otros sensores cerca (de otro ciclista, por ejemplo): el Edge se confunde y se conecta al equivocado. Alejarte lo resuelve.',
      tip: 'Enciende el sensor antes de buscarlo y, si es una banda de pulso, mójala y póntela para que se active.',
      trouble: [['No aparece el sensor', 'Enciéndelo, acércalo al Edge y repite la búsqueda.'], ['Se conecta a otro sensor', 'Aléjate de otros sensores y vuelve a emparejar.']] },
    datos('Edge'),
    { id: 'ayuda', title: 'Cuidado y ayuda',
      goal: 'Vas a cuidar tu Edge y saber qué hacer si algo falla.',
      actions: ['Después de rodar con lluvia o barro, límpialo con un **paño suave** y seco.', '**No lo cargues mojado**: seca el puerto de carga antes de conectar el cable.', 'Revisa que el **soporte** siga firme en el manubrio antes de cada salida.', 'Si algo falla, mira **Preguntas frecuentes** o escríbenos por WhatsApp.'],
      why: 'Un Edge limpio y seco dura más, se ve mejor al sol y marca con más precisión.',
      mistake: 'Cargarlo con el puerto mojado o sucio: con el tiempo puede dañar los contactos. Sécalo siempre primero.',
      tip: 'Guárdalo con el cable en un lugar seco y revisa la batería la noche antes de una salida larga.',
      trouble: [['El puerto está sucio', 'Límpialo con un paño o cepillo seco antes de cargar.'], ['Necesito ayuda', WHATSAPP_HELP]] },
  ]
}

function variaSteps(m: GuideModel): GuideStep[] {
  return [
    bienvenida('radar Varia', m.name, 'el **radar**, su **soporte** y el **cable de carga**'),
    { id: 'instalar', title: 'Instálala en la bici',
      goal: 'Vas a montar la Varia en la tija del asiento, mirando hacia atrás.',
      actions: ['Elige la **almohadilla de goma** que mejor ajuste a tu tija: redonda, en D o aero.', 'Pon la almohadilla en el **soporte** y presiónalo contra la tija.', '**Presiona un poco y gira** la Varia hacia la derecha hasta que quede fija.', 'Revisa que **mire recto hacia atrás** y que no se mueva al sacudirla.'],
      why: 'Montada recta, el radar detecta mejor los vehículos que se acercan y la luz se ve desde más lejos.',
      mistake: 'Dejarla inclinada hacia un lado o floja: el radar deja de ver bien y puede soltarse con los baches. Si baila, cambia la almohadilla por una que ajuste mejor.',
      tip: 'Prueba el montaje con la bici quieta: sacude suave el asiento y confirma que la Varia no se mueve ni cambia de ángulo.',
      trouble: [['Se mueve o baila', 'Cambia la almohadilla por la que mejor ajuste a tu tija y gira otra vez hasta sentir que fija.'], ['Queda inclinada', 'Suéltala, ajusta el soporte para que mire recto hacia atrás y vuelve a girar.'], ['No se ve la luz', 'Verifica que esté encendida y que nada (una bolsa o una luz extra) la tape.']] },
    { id: 'encendido', title: 'Enciéndela',
      goal: 'Vas a encender y apagar la Varia y a cambiar el modo de luz.',
      actions: ['Mantén presionado {pow|SU BOTÓN} **1 segundo** para encenderla.', 'Mira la **luz**: te confirma que está encendida.', 'Con la Varia encendida, **presiona el botón una vez** para cambiar el modo de luz.', 'Para apagarla, mantén el botón **2 segundos**.'],
      why: 'Encendida, la Varia es luz trasera y radar a la vez; si no está encendida, tu Edge o reloj no la encuentra.',
      mistake: 'Soltar el botón antes del segundo completo y creer que no enciende. Cuenta con calma y no sueltes antes de ver la luz.',
      tip: 'Déjala cargando la noche antes de cada salida larga y revisa la batería antes de salir.',
      trouble: [['No enciende', 'Conéctala al cable de carga unos minutos e inténtalo de nuevo.'], ['No cambia el modo de luz', 'Presiona una sola vez, de forma corta; si mantienes el botón, se apaga.'], ['Se apaga sola', 'Revisa la batería: puede estar baja. Cárgala.']] },
    { id: 'emparejar', title: 'Empareja con tu Edge o reloj',
      goal: 'Vas a unir la Varia con tu Edge o reloj Garmin compatible.',
      actions: ['Acerca el Edge o el reloj a unos **3 m** de la Varia y enciéndelo.', 'Con la Varia apagada, **mantén su botón 2 segundos**: la luz LED parpadea y queda en modo de emparejamiento.', 'En el menú de **Sensores** del Edge o reloj, elige **Añadir sensor**.', 'Toca **Buscar todo** y selecciona tu Varia en la lista.'],
      why: 'Emparejada, el Edge te muestra el radar y avisa de los vehículos que se acercan mientras pedaleas.',
      mistake: 'Emparejar con otros sensores cerca: el Edge se confunde y se conecta al equivocado. Mantente a unos 10 m de otros sensores.',
      tip: 'Con la RearVue 820 también puedes usar la app Varia en tu teléfono; consulta la compatibilidad de tu equipo en la caja.',
      trouble: [['No aparece en la lista', 'Apaga y enciende ambos dispositivos y busca otra vez, sin otros sensores cerca.'], ['Se conecta a otro sensor', 'Aléjate de los otros sensores y repite el emparejamiento.'], ['Queda en parpadeo', 'Mantén de nuevo el botón 2 segundos para reiniciar el modo de emparejamiento.']] },
    { id: 'radar', title: 'Mira el radar en pantalla',
      goal: 'Vas a entender qué te muestra el radar mientras pedaleas.',
      actions: ['Al conectarse, en tu Edge aparecen **sólidos** los iconos del radar y de la luz.', 'Tras el primer emparejamiento, se conectan **solos** cuando inicias tu actividad.', 'Fíjate en los **avisos de vehículos** que se acercan por detrás.', 'Si el icono cambia o se apaga, **revisa la conexión** cuando te detengas.'],
      why: 'El radar te avisa de lo que viene detrás sin que gires la cabeza, y eso te da más tiempo para reaccionar.',
      mistake: 'Confiar solo en el radar. Sigue mirando a tu alrededor: es un apoyo, no reemplaza tu atención.',
      tip: 'Si se desconecta, detente en un lugar seguro, apaga y enciende ambos dispositivos y espera a que se reconecten.',
      trouble: [['El radar se desconecta', 'Detente, apaga y enciende ambos dispositivos y espera unos segundos.'], ['No detecta bien', 'Verifica que la Varia esté montada recta, mirando hacia atrás, y que nada la tape.'], ['No aparece el icono', 'Entra al menú de Sensores del Edge y confirma que la Varia esté emparejada.']] },
    { id: 'ayuda', title: 'Cuidado y ayuda',
      goal: 'Vas a cuidar tu Varia para que funcione siempre que salgas.',
      actions: ['**Cárgala** antes de cada salida larga, con el cable de la caja.', '**Límpiala** con un paño suave y seco después de pedalear.', 'No la cargues si el **puerto está mojado**: sécalo primero.', 'Si algo falla, mira la pestaña **Preguntas frecuentes** o escríbenos por WhatsApp.'],
      why: 'Una Varia cargada y limpia avisa mejor y dura más.',
      mistake: 'Salir sin revisar la carga. Si se apaga a mitad de ruta, te quedas sin luz trasera ni radar.',
      tip: 'Guárdala con el cable en un lugar seco y, si te mojas en la ruta, sécala al llegar.',
      trouble: [['No enciende', 'Conéctala al cable unos minutos y vuelve a intentar.'], ['Necesito ayuda con algo que no está aquí', WHATSAPP_HELP]] },
  ]
}

function hrmSteps(m: GuideModel): GuideStep[] {
  return [
    bienvenida('banda de pulso', m.name, 'el **módulo** y la **correa elástica**'),
    { id: 'colocar', title: 'Colócatela bien',
      goal: 'Vas a ponerte la banda para que mida bien tu pulso.',
      actions: ['Encaja el módulo en la correa, con los **logos de Garmin hacia arriba**.', '**Moja los dos electrodos** de la parte trasera de la correa.', 'Colócala sobre la piel, **justo debajo del esternón**, con el broche en el lado derecho del cuerpo.', 'Ajústala **firme sin apretar**: que no se mueva al respirar profundo.'],
      why: 'Con buen contacto sobre la piel mojada, el pulso sale limpio y sin saltos.',
      mistake: 'Ponerla sobre la ropa o sin mojar los electrodos: los datos salen erráticos al inicio.',
      tip: 'Calienta 5 a 10 minutos antes de empezar. Si los datos salen raros, ajusta la correa un punto más.',
      trouble: [['Los datos salen erráticos', 'Moja otra vez los electrodos y ajusta la correa firme.'], ['La correa se mueve', 'Apriétala un punto más, sin cortar la respiración.'], ['Me irrita la piel', 'Lava la correa con agua dulce y déjala secar antes de usarla.']] },
    { id: 'emparejar', title: 'Empareja con tu dispositivo',
      goal: 'Vas a unir la banda con tu reloj, Edge o teléfono.',
      actions: ['Con la banda puesta y los electrodos mojados, abre el menú de **Sensores** de tu reloj o Edge.', 'Elige **Añadir sensor**.', 'Selecciona tu banda cuando aparezca en la lista.', 'Después, tu dispositivo la reconoce **solo** cada vez que la usas.'],
      why: 'Emparejada, ves tu pulso en pantalla mientras entrenas, sin tener que hacerlo cada vez.',
      mistake: 'Emparejar con otros sensores cerca: el dispositivo se confunde. Mantente a unos 10 m de otros sensores.',
      tip: 'La HRM 600 también se puede emparejar desde la app Garmin Connect, si prefieres hacerlo desde el teléfono.',
      trouble: [['No aparece la banda', 'Moja los electrodos, póntela y acerca el dispositivo; la banda se activa con el contacto.'], ['Se conecta a otro sensor', 'Aléjate de los otros sensores y vuelve a emparejar.'], ['Pierde la conexión', 'Revisa que el módulo encaje del todo en la correa.']] },
    { id: 'usar', title: 'Úsala en tu actividad',
      goal: 'Vas a ver tu pulso mientras haces una actividad.',
      actions: ['**Ponte la banda** y moja los electrodos.', '**Inicia tu actividad** en el reloj o el Edge.', 'Espera unos segundos a que aparezca tu **pulso en pantalla**.', 'Al terminar, **retira el módulo** de la correa.'],
      why: 'El pulso te dice qué tan fuerte estás entrenando y te ayuda a no pasarte.',
      mistake: 'Usarla con la correa seca o con ropa muy seca: moja bien ambos lados antes de empezar.',
      tip: 'Una camiseta de algodón o la correa bien húmeda evitan interferencias y lecturas raras.',
      trouble: [['No marca pulso', 'Moja los electrodos, ajusta la correa y vuelve a emparejar.'], ['Marca de más', 'Calienta unos minutos y revisa el ajuste de la correa.'], ['Se queda en cero', 'Confirma que el módulo esté encajado y que la banda esté emparejada.']] },
    { id: 'ayuda', title: 'Cuidado y ayuda',
      goal: 'Vas a cuidar tu banda para que dure.',
      actions: ['Después de usarla, **retira el módulo** de la correa.', '**Enjuaga la correa** con agua dulce.', 'Déjala **secar** al aire, lejos del sol directo.', 'Si algo falla, mira **Preguntas frecuentes** o escríbenos por WhatsApp.'],
      why: 'Una correa limpia y seca mide mejor y dura más.',
      mistake: 'Guardar la correa con sudor: se endurece y deja de dar buen contacto.',
      tip: 'Lava la correa con frecuencia y guarda el módulo aparte, en un lugar seco.',
      trouble: [['El módulo no se sujeta', 'Revisa que encaje del todo en la correa.'], ['Necesito ayuda con algo que no está aquí', WHATSAPP_HELP]] },
  ]
}

function cirqaSteps(m: GuideModel): GuideStep[] {
  return [
    bienvenida('banda', m.name, 'el **módulo**, la **pulsera** y el **cable de carga**'),
    { id: 'activar', title: 'Actívala conectándola',
      goal: 'Vas a activar la banda conectándola al cable de carga.',
      actions: ['Conecta el cable al **puerto de carga** del módulo.', 'Conecta el otro extremo a un **puerto USB**.', 'Espera a que la luz LED parpadee en **morado**: significa que está lista para emparejarse.', 'Mantén el cable conectado mientras la emparejas en el paso siguiente.'],
      why: 'Sin esa activación inicial, la banda no se deja emparejar con tu teléfono.',
      mistake: 'Desconectar el cable antes de emparejar. Manténlo conectado hasta terminar.',
      tip: 'Usa un regulador o protector de voltaje al cargar: cuida la batería de la banda.',
      trouble: [['No parpadea la luz', 'Revisa el cable y el puerto USB, y prueba otro adaptador.'], ['Parpadea en otro color', 'Mira en las preguntas frecuentes qué significa cada luz.'], ['No carga', 'Limpia los contactos del módulo con un paño seco.']] },
    app('banda'), cuenta(), emparejarReloj('banda'),
    { id: 'colocar', title: 'Colócatela',
      goal: 'Vas a ponerte la banda cómoda en la muñeca.',
      actions: ['Coloca el **módulo en la pulsera** siguiendo el diagrama de la guía rápida de tu caja.', 'Ponla en la muñeca, **un dedo por encima del hueso**.', 'Ajústala **cómoda, sin apretar**, pero firme.', 'Revisa que el módulo quede **bien sujeto**.'],
      why: 'Una banda bien puesta mide mejor todo el día, incluso mientras duermes.',
      mistake: 'Apretarla demasiado: molesta y no mide mejor. Que quede firme, no apretada.',
      tip: 'Si tienes dudas sobre cómo encaja el módulo, mira el diagrama de la guía rápida de tu caja.',
      trouble: [['Se mueve', 'Ajusta un punto más la pulsera.'], ['El módulo se suelta', 'Revísalo con el diagrama de tu caja y encájalo hasta oír o sentir que fija.'], ['Me molesta al dormir', 'Aflójala un punto y límpiala con un paño.']] },
    { id: 'actividad', title: 'Registra una actividad',
      goal: 'Vas a iniciar y guardar una actividad con el botón del módulo.',
      actions: ['La banda reconoce algunas actividades **por sí sola**, pero también puedes iniciarla tú.', 'Presiona {pow|BOTÓN DEL MÓDULO}: la luz parpadea y la banda **vibra** al comenzar.', 'Haz tu actividad con normalidad.', 'Al terminar, **presiónalo otra vez**: la luz y la vibración confirman que se guardó.'],
      why: 'Así tu actividad queda registrada completa y la ves después en Garmin Connect.',
      mistake: 'Olvidar presionar el botón al terminar: la actividad queda abierta y los datos salen largos.',
      tip: 'Después puedes ver o editar la actividad en Garmin Connect, con la banda cerca del teléfono.',
      trouble: [['No vibra', 'Presiona de nuevo, con un toque firme y corto.'], ['No se guardó', 'Sincroniza con Garmin Connect y revísalo ahí.'], ['No reconoce la actividad', 'Inicia la actividad tú con el botón del módulo.']] },
    datos('banda'),
    { id: 'ayuda', title: 'Cuidado y ayuda',
      goal: 'Vas a cuidar tu banda para que dure.',
      actions: ['Es **resistente al agua**, pero **sécala** después de nadar o ejercitarte.', '**No la cargues mojada**: seca el módulo y el cable.', 'Limpia la pulsera con un **paño suave**.', 'Si algo falla, mira **Preguntas frecuentes** o escríbenos por WhatsApp.'],
      why: 'Una banda seca y limpia mide mejor y dura más.',
      mistake: 'Cargarla húmeda: puede dañar los contactos con el tiempo.',
      tip: 'Guarda el cable en la caja, lejos de la humedad.',
      trouble: [['No enciende', 'Conéctala al cable unos minutos.'], ['Necesito ayuda con algo que no está aquí', WHATSAPP_HELP]] },
  ]
}

/** Pasos de la guía para un modelo (la ayuda extendida y los extras viven en pestañas aparte). */
export function guideSteps(m: GuideModel): GuideStep[] {
  const byKind: Record<GuideKind, () => GuideStep[]> = {
    t: () => watchSteps(m), b: () => watchSteps(m), s: () => cirqaSteps(m), c: () => edgeSteps(m), r: () => variaSteps(m), h: () => hrmSteps(m),
    i: () => inReachSteps(m), g: () => gpsmapSteps(m),
  }
  return byKind[m.kind]()
}
