import type { GuideModel, GuideStep } from '@/types/garmin-guide'

/**
 * Comunicador satelital (inReach Mini 3 Plus) y GPS de mano con satélite (GPSMAP H1i Plus).
 * Confirmado en los manuales de Garmin: activación y emparejamiento con Garmin Messenger, notas de voz solo en el Mini 3 Plus,
 * y que SOS, rastreo y mensajes necesitan un plan satelital activo. Lo demás (cancelación del SOS, LiveTrack, TopoActive,
 * cámara, linterna, sirena) se redacta con "si tu equipo lo tiene" y remite a la guía rápida de la caja.
 */

/** Aviso fijo en las guías de ambos equipos. */
export const SAT_NOTICE = 'Los mensajes, el SOS y el rastreo requieren un plan inReach activo.'

const WHATSAPP_HELP = 'Escríbenos por WhatsApp con tu modelo y cuéntanos en qué paso vas.'

const bienvenida = (nombre: string): GuideStep => ({
  id: 'bienvenida', title: `Vamos a dejar tu ${nombre} listo`,
  goal: 'Vas a dejar tu equipo listo para comunicarte y pedir ayuda por satélite, con todo configurado antes de salir.',
  actions: ['Revisa que en la caja estén el **equipo** y su **cable de carga**.', 'Ten el **teléfono a la mano**, cargado y con internet.', 'Piensa **quién será tu contacto de emergencia** y avísale.', 'Marca **Listo** al terminar cada paso: tu avance se guarda.'],
  why: 'El equipo funciona por satélite, pero se activa y se configura con internet: hazlo en casa, antes de la ruta.',
  mistake: 'Esperar a estar en la montaña para activarlo. Sin internet no podrás completar la activación.',
  tip: 'Haz toda la configuración en casa, con Wi‑Fi y con calma; aparta una hora.',
  trouble: [['Falta algo en la caja', 'Escríbenos por WhatsApp con tu factura y te ayudamos enseguida.'], ['No sé por dónde empezar', 'Empieza por cargar el equipo (paso 2) mientras creas tu cuenta.']],
  needs: ['Tu **teléfono** con Bluetooth, con batería y buena señal.', 'Un **correo electrónico** que revises a diario.', 'Una **forma de pago** para el plan inReach, que se paga a Garmin.', 'El **cable de carga** de la caja y un adaptador USB.'],
  venezuela: ['Carga con un **regulador o protector de voltaje**: los altibajos de la luz desgastan la batería.', 'Si el Wi‑Fi falla, **descarga las apps con datos móviles**; revisa antes que tu plan tenga datos.', 'Antes de salir, **avisa a tu familia** la ruta y a qué hora piensas escribirles.'],
})

const plan = (): GuideStep => ({
  id: 'plan', title: 'Crea tu cuenta y activa tu plan inReach',
  goal: 'Vas a crear tu cuenta Garmin y activar el equipo con un plan inReach.',
  actions: ['Crea tu **cuenta Garmin** con un correo que revises (o inicia sesión si ya tienes).', 'Elige un **plan inReach**: el plan se paga a Garmin, no a la tienda.', '**Activa el equipo** siguiendo las indicaciones de la app o de la página de activación.', 'Confirma que tu cuenta muestre el equipo como **activo**.'],
  why: 'Sin plan no hay mensajes, ni SOS, ni rastreo: el plan es lo que conecta tu equipo con la red satelital.',
  mistake: 'Creer que el equipo funciona solo por comprarlo. Sin un plan activo no envía nada.',
  tip: 'Algunos planes se pueden pausar o cambiar según el tipo que elijas: revisa las condiciones al contratar y compáralas con cuánto vas a salir.',
  trouble: [['No me deja activar', 'Revisa que estés usando la misma cuenta Garmin en todo el proceso y que tengas internet; si sigue, escríbenos.'], ['No sé qué plan elegir', 'Piensa cuántos mensajes enviarás y cuántos meses al año saldrás; cuéntanos y te orientamos.']],
})

const contactos = (): GuideStep => ({
  id: 'contactos', title: 'Contactos de emergencia y datos médicos',
  goal: 'Vas a registrar a quién avisar y tus datos médicos en tu cuenta.',
  actions: ['Entra a tu **cuenta Garmin** o a la app y busca **Contactos**.', 'Agrega **al menos un contacto de emergencia**, con teléfono y correo.', 'Completa tus **datos médicos** (alergias, condiciones y medicinas) si la cuenta te lo permite.', 'Avisa a tus contactos: recibirán mensajes tuyos por satélite.'],
  why: 'Si tienes una emergencia, el servicio de respuesta usa esos datos para avisar a las personas correctas.',
  mistake: 'Dejar un contacto desactualizado o con un número que ya no usa. Revísalos antes de cada temporada.',
  tip: 'Pon un contacto que tenga señal y tenga el teléfono siempre a la mano.',
  trouble: [['No puedo agregar un contacto', 'Revisa que el teléfono y el correo estén bien escritos y que hayas iniciado sesión.'], ['Mi contacto no recibe nada', 'Pídele que revise spam y que guarde tu número.']],
})

const primerMensaje = (): GuideStep => ({
  id: 'mensaje', title: 'Tu primer mensaje de prueba',
  goal: 'Vas a enviar un mensaje de prueba y comprobar que llega.',
  actions: ['Sal a un lugar **al aire libre con el cielo despejado**.', 'Abre **Garmin Messenger** y escribe un mensaje corto a tu contacto.', '**Envíalo** y espera sin moverte ni tapar el equipo hasta ver la confirmación.', 'Pide a tu contacto que **responda** para probar también la recepción.'],
  why: 'Probar en casa, al aire libre, te da confianza antes de depender del equipo en la ruta.',
  mistake: 'Probar bajo techo, entre edificios altos o bajo árboles muy densos: el mensaje tarda o no sale.',
  tip: 'Si no sale a la primera, muévete a un lugar más abierto y espera unos minutos antes de reintentar.',
  trouble: [['El mensaje no sale', 'Ve a un lugar abierto con cielo despejado, no tapes el equipo y espera unos minutos.'], ['Sale pero tarda', 'Es normal que tarde más que un mensaje de teléfono: va por satélite.'], ['Dice que no hay plan', 'Revisa en tu cuenta Garmin que el plan esté activo.']],
})

const sos = (): GuideStep => ({
  id: 'sos', title: 'Cómo funciona el SOS',
  goal: 'Vas a conocer cómo funciona el SOS antes de necesitarlo.',
  actions: ['**Localiza el botón SOS** del equipo: suele estar protegido para evitar toques por accidente (revisa la guía rápida de tu caja).', 'Al activarlo, el equipo **envía tu ubicación** a un centro de respuesta de emergencias.', 'Sigue las **indicaciones en pantalla**: si fue un error, se puede **cancelar** según el modelo.', 'Si cancelas, **avisa a tus contactos** de que estás bien.'],
  why: 'Saber qué pasa antes de una emergencia evita dudar cuando cada minuto cuenta.',
  mistake: 'Activar el SOS para probarlo. Es una emergencia real: nunca lo uses para probar.',
  tip: 'Enseña a tu contacto qué significa el SOS y qué hacer si lo recibe.',
  trouble: [['Lo activé por error', 'Sigue las indicaciones en pantalla para cancelarlo de inmediato y avisa a tu contacto.'], ['No sé si se envió', 'Mira la confirmación en pantalla y espera; no lo repitas sin necesidad.']],
})

const livetrack = (): GuideStep => ({
  id: 'livetrack', title: 'LiveTrack y check-ins',
  goal: 'Vas a dejar que tu familia siga tu ruta.',
  actions: ['Abre la app y busca **LiveTrack** (si tu app lo muestra).', '**Comparte el enlace** con tu familia: verán tu recorrido en el mapa.', 'Usa un **check-in**: un mensaje rápido para decir “estoy bien”.', 'Pregunta a tu familia si **recibió** el enlace.'],
  why: 'Tu familia tranquila sabe dónde estás sin que tengas que escribir a cada rato.',
  mistake: 'Compartir el enlace y no avisar. Dile a tu familia cada cuánto verán novedades.',
  tip: 'Antes de salir, acuerda con tu familia una hora límite para escribirles.',
  trouble: [['No veo LiveTrack', 'Revisa la versión de la app y tu plan; si no aparece, escríbenos.'], ['Mi familia no ve el mapa', 'Pídeles que abran el enlace completo y revisa el rastreo en tu equipo.']],
})

const bateria = (): GuideStep => ({
  id: 'bateria', title: 'Batería y frecuencia de rastreo',
  goal: 'Vas a cuidar la batería para que te dure toda la ruta.',
  actions: ['Elige la **frecuencia de rastreo**: más seguido consume más batería.', 'Apaga el equipo o usa el **modo de ahorro** cuando no lo necesites.', 'Revisa la **carga antes de salir** y lleva un **cargador portátil** en rutas largas.', 'Evita dejarlo al sol fuerte o dentro de un carro caliente.'],
  why: 'La batería es tu seguro: sin ella, el equipo no sirve cuando más lo necesitas.',
  mistake: 'Dejar el rastreo en la frecuencia más alta toda la ruta. Úsala solo cuando haga falta.',
  tip: 'La duración depende del modelo y del uso: revisa la guía rápida de tu caja.',
  trouble: [['Se descarga rápido', 'Baja la frecuencia de rastreo, apaga lo que no uses y carga antes de salir.'], ['No carga', 'Revisa el cable de la caja y limpia el puerto con un paño seco.']],
})

export function inReachSteps(m: GuideModel): GuideStep[] {
  return [
    bienvenida(m.name),
    { id: 'carga', title: 'Cárgalo por completo',
      goal: 'Vas a cargar el comunicador completo antes de configurarlo.',
      actions: ['Conecta el **cable USB‑C de la caja** al equipo.', 'Enchufa el otro extremo a un **adaptador USB** o a una computadora.', 'Espera a que el **indicador de carga** muestre que terminó.', 'Déjalo cargar **completo** antes de seguir.'],
      why: 'Con la batería llena no se apaga a mitad de la activación y tienes más autonomía.',
      mistake: 'Cargarlo con el puerto húmedo o con un cable que no sea el de la caja.',
      tip: 'Usa un regulador o protector de voltaje: cuida la batería de tu equipo.',
      trouble: [['No carga', 'Revisa el cable, prueba otro adaptador USB y limpia el puerto con un paño seco.'], ['Carga muy lento', 'Usa un adaptador USB estándar en buen estado.']] },
    plan(),
    { id: 'messenger', title: 'Instala Garmin Messenger y empareja',
      goal: 'Vas a instalar Garmin Messenger y unirlo con tu comunicador.',
      actions: ['Instala **Garmin Messenger** desde la App Store o la Play Store.', 'Inicia sesión con **la misma cuenta Garmin** de la activación.', 'Enciende el comunicador y elige **Emparejar** en la app.', 'Acepta los permisos de **Bluetooth** y confirma el código.'],
      why: 'Con Messenger escribes cómodo desde el teléfono y el equipo envía el mensaje por satélite.',
      mistake: 'Activar por otra vía distinta de Garmin Messenger: puede limitar funciones como los mensajes de grupo y de voz.',
      tip: 'Descarga la app con datos móviles si no tienes Wi‑Fi estable.',
      trouble: [['No aparece el equipo', 'Enciéndelo, acércalo al teléfono y apaga y enciende el Bluetooth.'], ['No me deja iniciar sesión', 'Usa la misma cuenta con la que activaste el equipo.']] },
    contactos(), primerMensaje(), sos(), livetrack(),
    { id: 'voz', title: 'Notas de voz, transcripción y fotos',
      goal: 'Vas a usar mensajes de voz y fotos (modelos Plus).',
      actions: ['En Garmin Messenger, toca el **micrófono** para grabar una **nota de voz**.', 'Tu nota puede llegar con **transcripción a texto**, según el modelo.', 'Para **fotos**, adjunta una desde tu teléfono; se ajustan para viajar por satélite.', 'Ten paciencia: los archivos tardan **más** que un texto.'],
      why: 'Una nota de voz o una foto dicen más que un texto cuando estás en un lugar difícil.',
      mistake: 'Enviar fotos muy pesadas o varias seguidas: tardan y gastan más batería y plan.',
      tip: 'Usa el texto para lo urgente y deja las fotos para cuando estés en un lugar abierto.',
      trouble: [['No me deja grabar voz', 'Las notas de voz son de los modelos Plus: revisa la guía de tu caja.'], ['La foto no sale', 'Prueba en un lugar abierto y con la foto más pequeña.']] },
    bateria(),
  ]
}

export function gpsmapSteps(m: GuideModel): GuideStep[] {
  return [
    bienvenida(m.name),
    { id: 'carga', title: 'Cárgalo',
      goal: 'Vas a cargar el GPS de mano antes de usarlo.',
      actions: ['Conecta el **cable de carga** de la caja al equipo.', 'Enchufa el otro extremo a un **adaptador USB**.', 'Espera a que el **indicador de carga** muestre que terminó.', 'Déjalo cargar **completo** antes de seguir.'],
      why: 'Una batería llena evita que se apague en plena configuración.',
      mistake: 'Cargarlo con el puerto sucio o mojado: límpialo con un paño seco antes.',
      tip: 'Usa un regulador de voltaje y revisa la carga antes de cada salida.',
      trouble: [['No carga', 'Revisa el cable, prueba otro adaptador USB y limpia el puerto.'], ['Carga lento', 'Usa un adaptador USB estándar en buen estado.']] },
    { id: 'encendido', title: 'Enciéndelo y elige el idioma',
      goal: 'Vas a encender el equipo y elegir el idioma.',
      actions: ['Mantén presionado el **botón de encendido** {PW} hasta que aparezca el logo.', 'Elige **Español** como idioma.', 'Sigue las **indicaciones iniciales** en pantalla.', 'Si te propone emparejar con el teléfono, déjalo para más adelante.'],
      why: 'El idioma y la configuración inicial dejan el equipo listo para usarse.',
      mistake: 'Soltar el botón antes de tiempo. Mantén presionado hasta ver el logo.',
      tip: 'Si dudas cuál es el botón de encendido, míralo en la guía rápida de tu caja.',
      trouble: [['No enciende', 'Déjalo cargando unos minutos y vuelve a intentar.'], ['Quedó en otro idioma', 'Busca el idioma dentro de Ajustes; la ruta puede variar según el modelo.']] },
    plan(),
    { id: 'explore', title: 'Instala Garmin Explore: rutas y clima',
      goal: 'Vas a instalar la app Garmin Explore y unirla con tu GPS.',
      actions: ['Instala **Garmin Explore** desde la App Store o la Play Store.', 'Inicia sesión con **la misma cuenta Garmin**.', 'Empareja tu GPS desde la app y acepta los permisos de **Bluetooth**.', 'Explora las secciones de **rutas** y **clima** que ofrezca tu app.'],
      why: 'Desde la app planeas rutas con comodidad y las envías al equipo.',
      mistake: 'Usar otra cuenta distinta a la de la activación: no verás tu equipo.',
      tip: 'Descarga la app con datos móviles si no tienes Wi‑Fi estable.',
      trouble: [['No encuentra el equipo', 'Enciéndelo, acércalo al teléfono y reinicia el Bluetooth.'], ['No veo el clima', 'Revisa tu plan y la versión de la app; es una función que depende del plan.']] },
    { id: 'mapas', title: 'Mapas y descarga de imágenes satelitales',
      goal: 'Vas a preparar los mapas TopoActive y las imágenes satelitales por Wi‑Fi.',
      actions: ['Conecta el GPS a una **red Wi‑Fi** desde sus ajustes.', 'Busca los **mapas TopoActive** instalados en tu equipo.', 'Descarga las **imágenes satelitales** de la zona donde vas a salir.', 'Revisa que haya **espacio** suficiente en el equipo.'],
      why: 'Con los mapas ya en el equipo puedes navegar sin señal de teléfono.',
      mistake: 'Dejar la descarga para el último momento: las imágenes pesan y necesitan Wi‑Fi.',
      tip: 'Descárgalas en casa, la noche antes de la ruta.',
      trouble: [['No conecta a Wi‑Fi', 'Acércate al router, revisa la clave y reintenta.'], ['No hay espacio', 'Borra mapas o imágenes de zonas que no vas a usar.']] },
    { id: 'ruta', title: 'Crea y sigue una ruta',
      goal: 'Vas a crear una ruta y seguirla en el campo.',
      actions: ['Crea la ruta en la app **Garmin Explore** o en el equipo.', 'Envíala al GPS y **ábrela** en la lista de rutas.', 'Elige **Navegar** y sigue la **línea sobre el mapa**.', 'Mira la pantalla de vez en cuando para confirmar que sigues en la ruta.'],
      why: 'Una ruta cargada te muestra por dónde ir y te avisa si te desvías.',
      mistake: 'Salir sin probar la ruta en casa. Ábrela y confirma que está cargada.',
      tip: 'Lleva siempre una referencia de respaldo, como un mapa en papel o la ruta en el teléfono.',
      trouble: [['La ruta no aparece', 'Sincroniza con la app y revisa en la lista de rutas del GPS.'], ['Me salí de la ruta', 'Vuelve al trazo; el equipo te muestra la dirección.']] },
    { id: 'puntos', title: 'Marca puntos',
      goal: 'Vas a marcar puntos de interés, como el campamento o el auto.',
      actions: ['Abre la **pantalla del mapa** o el menú de puntos.', 'Elige **Marcar punto** donde estás.', 'Ponle un **nombre claro**.', 'Podrás **volver a él** desde la lista de puntos.'],
      why: 'Un punto bien marcado te ayuda a regresar al auto o a encontrar el camino de vuelta.',
      mistake: 'Marcar sin nombre: luego no sabrás cuál es cuál.',
      tip: 'Marca el punto de partida antes de salir.',
      trouble: [['No me deja marcar', 'Espera a que el GPS tenga señal y vuelve a intentar.'], ['No encuentro mis puntos', 'Búscalos en la lista de puntos del menú.']] },
    { id: 'camara', title: 'Cámara y envío de fotos',
      goal: 'Vas a tomar fotos con el equipo y enviarlas, si tu modelo lo permite.',
      actions: ['Abre la **cámara** del equipo, si la tiene.', 'Toma la foto y **revísala**.', 'Envíala desde **Garmin Messenger** o la app a tu contacto.', 'Espera: las fotos tardan más que un texto.'],
      why: 'Una foto puede explicar mejor qué pasa.',
      mistake: 'Enviar muchas fotos seguidas: gasta batería y plan.',
      tip: 'Envía las fotos en un lugar abierto.',
      trouble: [['La foto no se envía', 'Ve a un lugar abierto y prueba con una foto más pequeña.'], ['No tengo cámara', 'Revisa la guía de tu caja: depende del modelo.']] },
    { id: 'voz', title: 'Voz en español, linterna y sirena',
      goal: 'Vas a usar la voz, la linterna y la sirena, si tu equipo las tiene.',
      actions: ['Busca en los ajustes la opción de **voz** y elige **Español** si está disponible.', 'Prueba la **linterna** con su botón o menú.', 'Conoce la **sirena** y cuándo usarla.', 'Revisa la guía de tu caja para los gestos exactos.'],
      why: 'La linterna y la sirena ayudan a verte y a que te encuentren.',
      mistake: 'Activar la sirena para probarla en la calle: asusta y gasta batería.',
      tip: 'Prueba la linterna en casa, no en la ruta.',
      trouble: [['No encuentro la voz', 'Revisa los ajustes de idioma y voz; el nombre varía según el modelo.'], ['La linterna no prende', 'Revisa la batería y el botón que la activa.']] },
    { id: 'sos', title: 'SOS y LiveTrack',
      goal: 'Vas a conocer el SOS y el LiveTrack de tu GPS.',
      actions: ['**Localiza el botón SOS**: suele estar protegido para evitar toques por accidente.', 'Al activarlo, el equipo **envía tu ubicación** a un centro de respuesta de emergencias.', 'Si fue un error, **sigue las indicaciones** en pantalla para cancelarlo.', 'Usa **LiveTrack** para que tu familia vea tu ruta.'],
      why: 'Saber qué pasa antes de una emergencia evita dudar cuando cada minuto cuenta.',
      mistake: 'Activar el SOS para probarlo. Es una emergencia real: nunca lo uses para probar.',
      tip: 'Acuerda con tu familia una hora límite para escribirles.',
      trouble: [['Lo activé por error', 'Sigue las indicaciones en pantalla para cancelarlo de inmediato y avisa a tu contacto.'], ['No veo LiveTrack', 'Revisa tu plan y la versión de la app; si no aparece, escríbenos.']] },
    { id: 'ayuda', title: 'Cuidado y ayuda',
      goal: 'Vas a cuidar tu GPS y saber qué hacer si algo falla.',
      actions: ['Límpialo con un **paño suave** después de cada salida.', '**No lo cargues mojado**.', 'Revisa la pestaña **Preguntas frecuentes** si algo falla.', 'Escríbenos por WhatsApp si sigues con dudas.'],
      why: 'Un equipo limpio y seco dura mucho más.',
      mistake: 'Guardarlo con arena o humedad en los puertos.',
      tip: WHATSAPP_HELP,
      trouble: [['El puerto está sucio', 'Límpialo con un paño o cepillo seco antes de cargar.'], ['Necesito ayuda', WHATSAPP_HELP]] },
  ]
}

/** Preguntas frecuentes de ambos equipos satelitales. */
export const SAT_FAQ: readonly [string, string][] = [
  ['¿Necesito un plan?', 'Sí. Los mensajes, el SOS y el rastreo requieren un plan inReach activo, que se paga a Garmin. Sin plan, el equipo no envía nada por satélite.'],
  ['¿Funciona sin señal de teléfono?', 'Sí: usa satélites, no la red del teléfono. Necesita cielo despejado y un plan activo. El teléfono sirve para escribir cómodo con Garmin Messenger, pero el envío lo hace el equipo por satélite.'],
  ['¿Por qué no sale el mensaje?', 'Lo más común es que estés bajo techo, entre edificios o bajo árboles muy densos. Sal a un lugar abierto, no tapes el equipo y espera unos minutos. Revisa también que tu plan esté activo y que el equipo tenga batería.'],
  ['¿Qué pasa si activo el SOS por error?', 'Sigue las indicaciones en pantalla para cancelarlo de inmediato y avisa a tu contacto de que estás bien. Nunca uses el SOS para probar: activa una emergencia real.'],
  ['¿Cuánto dura la batería?', 'Depende del modelo, de la frecuencia de rastreo y del uso. Baja la frecuencia de rastreo, apaga lo que no uses y revisa la guía rápida de tu caja para el dato de tu modelo. En rutas largas, lleva un cargador portátil.'],
]
