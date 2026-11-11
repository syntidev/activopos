import type { GuideExtra, GuideKind } from '@/types/garmin-guide'
import { SAT_FAQ } from './garmin-guide-satelite'

/**
 * "Saca el máximo provecho" y preguntas frecuentes de la guía Garmin. Textos contrastados con los manuales de Garmin
 * (notificaciones, Connect IQ, HRV/Training Readiness, seguridad e incidentes, reinicio y restablecimiento, Garmin Express).
 * Lo que no existe en todos los modelos dice "si tu modelo la tiene"; lo que cambia de menú remite a la guía rápida de la caja.
 * Marcas: líneas que empiezan con "- " son viñetas; **negrita**; {tienda} = nombre del negocio.
 */

const WATCHES: readonly GuideKind[] = ['t', 'b']
const WATCH_EDGE: readonly GuideKind[] = ['t', 'b', 'c']
const ALL: readonly GuideKind[] = ['t', 'b', 's', 'c', 'r', 'h', 'i', 'g']

export const GUIDE_EXTRAS: readonly GuideExtra[] = [
  { id: 'notificaciones', title: 'Notificaciones del teléfono (WhatsApp y llamadas)', kinds: WATCH_EDGE, body: [
    'Tu dispositivo puede avisarte de llamadas y mensajes, como WhatsApp, para que no tengas que sacar el teléfono. Funciona si está emparejado y conectado por Bluetooth, y si tu modelo la tiene.',
    '- **En el reloj:** entra a los ajustes de **Teléfono** (a veces se llama Conectividad) y activa **Notificaciones**. La ruta exacta cambia según el modelo; revisa la guía rápida de tu caja.',
    '- **En iPhone:** abre **Ajustes del iPhone > Notificaciones** y elige qué apps pueden mostrar avisos. Esos avisos son los que llegan al reloj.',
    '- **En Android:** abre **Garmin Connect > Más (☰) > Ajustes > Notificaciones > Notificaciones de apps** y marca las apps que quieres (WhatsApp, llamadas). Si te lo pide, concede el acceso a notificaciones.',
    'Si no llegan, mira que el reloj esté conectado al teléfono y que el teléfono no esté en modo ahorro ni en No molestar. Responder mensajes desde el reloj solo funciona en algunos teléfonos Android compatibles.',
  ] },
  { id: 'esferas', title: 'Cambiar la esfera y descargar apps (Connect IQ)', kinds: WATCH_EDGE, body: [
    'Con **Connect IQ**, la tienda de Garmin, puedes cambiar el aspecto de la pantalla (la esfera) y añadir apps y datos extra.',
    '- **Instala** la app **Connect IQ** en tu teléfono.',
    '- **Abre la app** con el dispositivo emparejado y elige tu modelo.',
    '- **Busca una esfera**, toca **Descargar** y espera: se envía sola al reloj.',
    '- **Elígela en el reloj:** en muchos modelos se mantiene presionada la pantalla de la hora (o el botón de menú) y se desliza hasta la esfera nueva. El gesto exacto varía según el modelo.',
    'Empieza con una sola esfera y fíjate en cuánto afecta la batería antes de instalar más.',
  ] },
  { id: 'salud', title: 'Métricas de salud: pulso, sueño, estrés, Body Battery, VFC y preparación', kinds: WATCHES, body: [
    'Tu reloj mide varias cosas de tu salud. Esto significa cada una, si tu modelo la tiene:',
    '- **Pulso:** latidos por minuto. En reposo es más bajo; sube cuando te mueves o te estresas.',
    '- **Sueño:** estima cuánto y cómo duermes. Mira la tendencia de varias noches, no un solo número.',
    '- **Estrés:** una estimación a partir de tu pulso. Si se queda alto por mucho rato, quizá te falta descanso.',
    '- **Body Battery:** tu energía disponible durante el día. Sube cuando descansas y baja con el estrés y el ejercicio.',
    '- **VFC (variabilidad del pulso):** cuánto varía el tiempo entre latidos, medida de noche. El reloj la compara con tu promedio y la califica: equilibrada, desequilibrada, baja o deficiente.',
    '- **Preparación para entrenar:** una nota, de mala a óptima, que combina sueño, VFC, recuperación, carga de entrenamiento y estrés para sugerirte si hoy toca entrenar fuerte o suave.',
    'Úsalas juntas y junto a cómo te sientes: ninguna sola dice toda la verdad.',
  ] },
  { id: 'muneca', title: 'Cómo ponértelo para que el pulso sea preciso', kinds: WATCHES, body: [
    'El sensor de pulso está atrás del reloj y lee mejor si el ajuste es bueno:',
    '- Póntelo **un dedo por encima del hueso de la muñeca**, no justo sobre él.',
    '- Que quede **firme sin apretar**: que no baile al mover la mano, pero que no marque la piel.',
    '- Mantén el sensor trasero **limpio y seco**; límpialo con un paño suave.',
    '- En actividades intensas, súbelo y ajústalo un punto más.',
    'Si el pulso sale raro, prueba la otra muñeca o una banda de pulso. La piel mojada, los tatuajes y el vello muy denso pueden afectar la lectura.',
  ] },
  { id: 'seguridad', title: 'Seguridad: incidentes, contactos de emergencia y LiveTrack', kinds: WATCH_EDGE, body: [
    'Son funciones de apoyo que dependen del modelo; confirma las de tu equipo en la guía rápida de tu caja.',
    '- **Contactos de emergencia:** agrégalos en Garmin Connect antes de activar la detección de incidentes. Puedes tener hasta tres, y deben poder recibir mensajes o correos.',
    '- **Detección de incidentes (si tu modelo la tiene):** funciona en ciertas actividades al aire libre. Muestra un aviso en el reloj y en el teléfono y, si no lo cancelas en unos 15 segundos, avisa a tus contactos.',
    '- **Qué necesita:** el dispositivo conectado por Bluetooth al teléfono con Garmin Connect, y el teléfono con datos y cobertura.',
    '- **LiveTrack:** compartes un enlace para que tus contactos vean tu recorrido en vivo. Se activa en Garmin Connect y necesita el teléfono emparejado.',
    'Importante: son un apoyo, no reemplazan llamar a emergencias; Garmin Connect no llama por ti.',
  ] },
  { id: 'strava', title: 'Conectar con Strava u otras apps', kinds: WATCH_EDGE, body: [
    'Puedes enviar tus actividades a otras apps, como Strava, para compartirlas o seguir tus retos.',
    '- Abre Garmin Connect y busca **Aplicaciones conectadas** o **Conexiones**; el nombre cambia según la versión de la app.',
    '- Elige **Strava**, inicia sesión y **acepta el permiso**.',
    '- Desde ahí, tus actividades nuevas pasan solas a Strava después de sincronizar.',
    'Si tu versión de la app no muestra esta opción, escríbenos por WhatsApp y te guiamos.',
  ] },
  { id: 'bateria', title: 'Ahorrar batería', kinds: WATCH_EDGE, body: [
    'Con unos cambios simples, tu dispositivo dura más entre cargas:',
    '- Baja el **brillo** de la pantalla.',
    '- Si tu modelo tiene pantalla siempre encendida, **apágala** o limítala.',
    '- Usa un modo de **GPS más ahorrador** cuando no necesites tanta precisión, si tu modelo lo tiene.',
    '- Quita **notificaciones y sensores** que no uses.',
    'La duración depende mucho del modelo y del uso: con GPS encendido dura menos que en uso diario. Consulta la guía rápida de tu caja para el dato de tu modelo. Y recuerda: carga con regulador de voltaje.',
  ] },
  { id: 'agua', title: 'Agua: qué significa la resistencia (ATM) y cómo cuidarlo', kinds: WATCHES, body: [
    'La resistencia al agua se mide en **ATM**, una unidad de presión: mientras más alto el número, más presión aguanta.',
    '- Un **5 ATM**, por ejemplo, suele resistir nadar en piscina o en el mar. No es para bucear con tanque ni para deportes de agua a alta velocidad. Revisa el número de tu modelo en la caja.',
    'Después del mar o la piscina:',
    '- **Enjuágalo con agua dulce** y **sécalo** con un paño suave.',
    '- Evita presionar los botones bajo el agua, si tu reloj los tiene.',
    '- **No lo cargues** hasta que esté completamente seco.',
  ] },
  { id: 'actualizar', title: 'Actualizar el software', kinds: ALL, body: [
    'Las actualizaciones arreglan errores y a veces suman funciones. Hay dos caminos:',
    '- **Desde el teléfono:** Garmin Connect te avisa cuando hay una actualización disponible, si tu modelo la admite. Acepta y espera sin alejarte del dispositivo.',
    '- **Desde la computadora:** instala **Garmin Express**, agrega tu dispositivo, conéctalo por USB y deja que la app busque y envíe las actualizaciones. No lo desconectes hasta que termine.',
    'Antes de actualizar, deja el dispositivo con buena carga y sincroniza tus datos.',
  ] },
  { id: 'garantia', title: 'Garantía y soporte {tienda}', kinds: ALL, body: [
    'Estamos contigo después de la compra:',
    '- **Qué cubre:** la garantía es la del fabricante y depende del producto. Confirma las condiciones de tu modelo en la caja o con nosotros.',
    '- **Qué traer a la tienda:** el dispositivo, su cable de carga y tu **factura de compra**.',
    '- **Cómo contactarnos:** escríbenos por WhatsApp con tu modelo y cuéntanos qué pasa; te decimos cómo seguir.',
  ] },
]

/** Preguntas frecuentes (universales; lo que cambia por modelo remite a la guía rápida de la caja). */
export const GUIDE_FAQ: readonly [string, string][] = [
  ['No se empareja', 'Apaga y enciende el Bluetooth del teléfono, acerca el dispositivo y repite el proceso desde Garmin Connect, no desde los ajustes del teléfono. Si sigue igual, reinicia el dispositivo y el teléfono, y vuelve a intentar con ambos bien cargados.'],
  ['No sincroniza', 'Confirma que el Bluetooth esté activo y abre Garmin Connect con el dispositivo cerca. Desliza hacia abajo en la pantalla Hoy para forzar la sincronización y revisa que la app tenga todos sus permisos.'],
  ['La hora no cambia o está mal', 'La hora se toma del teléfono. Sincroniza con Garmin Connect y revisa que tu teléfono tenga la fecha, la hora y la zona horaria en automático.'],
  ['El pulso sale raro', 'Ajusta el reloj un dedo por encima del hueso de la muñeca, firme sin apretar, y limpia el sensor trasero. Si sigue irregular en ejercicio intenso, prueba una banda de pulso.'],
  ['La batería dura poco', 'Baja el brillo, apaga la pantalla siempre encendida si tu modelo la tiene y quita notificaciones o sensores que no uses. La duración varía según el modelo y el uso: revisa la guía rápida de tu caja.'],
  ['No llegan las notificaciones', 'Mira que el dispositivo esté conectado al teléfono, que las notificaciones estén activadas en el reloj (ajustes de Teléfono) y que el teléfono no esté en ahorro de batería ni en No molestar. En Android, revisa Garmin Connect > Ajustes > Notificaciones > Notificaciones de apps.'],
  ['¿Cómo reinicio el dispositivo?', 'En muchos relojes con botones se mantiene presionado el botón de luz unos 15 segundos hasta que se apague, y luego se vuelve a encender. Puede borrar lo que no se haya sincronizado, así que sincroniza antes. El método exacto cambia según el modelo: revisa la guía rápida de tu caja.'],
  ['¿Cómo lo restauro de fábrica?', 'Esto borra tus datos del dispositivo: antes, sincroniza con Garmin Connect. En los ajustes del sistema busca la opción de restablecer o “borrar datos y restablecer ajustes” (el nombre varía según el modelo) y confirma. Después empareja de nuevo desde cero. Si dudas, escríbenos antes de hacerlo.'],
  ['Cambié de teléfono, ¿qué hago?', 'Instala Garmin Connect en el teléfono nuevo e inicia sesión con la misma cuenta: tu historial sigue ahí. Luego empareja el dispositivo otra vez desde la app.'],
]

/** Preguntas frecuentes del tipo de dispositivo: los equipos satelitales llevan las suyas primero. */
export function faqFor(kind: GuideKind): readonly [string, string][] {
  return kind === 'i' || kind === 'g' ? [...SAT_FAQ, GUIDE_FAQ[0], GUIDE_FAQ[1], GUIDE_FAQ[6], GUIDE_FAQ[7]] : GUIDE_FAQ
}

/** Tarjetas aplicables al tipo de dispositivo. */
export function extrasFor(kind: GuideKind): GuideExtra[] {
  return GUIDE_EXTRAS.filter(e => e.kinds.includes(kind))
}
