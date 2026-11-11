/** Tipo de dispositivo: t = reloj táctil y botones, b = solo botones, s = sin pantalla, c = Edge, r = Varia, h = banda HRM, i = comunicador satelital, g = GPS de mano con satélite. */
export type GuideKind = 't' | 'b' | 's' | 'c' | 'r' | 'h' | 'i' | 'g'

export interface GuideModel {
  family: string
  name:   string
  kind:   GuideKind
}

/** Botones físicos que se dibujan como chip dentro del texto: {luz}, {start|ETIQUETA}. */
export type GuideKeyId = 'luz' | 'up' | 'down' | 'start' | 'back' | 'pow' | 'act'

export interface GuideLegendRow {
  key:   GuideKeyId
  place: string
  text:  string
  /** Etiqueta grabada en el botón cuando difiere de la de siempre (Instinct). */
  label?: string
}

/**
 * Textos con marcas mínimas (sin HTML): **negrita**, {luz} chip de botón, {start|ETIQUETA} chip con etiqueta propia,
 * {g|verde} / {r|rojo} chips de color y {PW} el símbolo de encendido.
 */
export interface GuideStep {
  id:      string
  title:   string
  /** "Qué vas a hacer": una frase. */
  goal:    string
  /** Acciones numeradas (la acción va en **negrita**). Vacío si el paso usa `byOs`. */
  actions: string[]
  /** Pasos distintos para iPhone y Android (reemplazan a `actions`). */
  byOs?:   { iphone: string[]; android: string[] }
  /** "Por qué importa". */
  why:     string
  /** "Error común": lo que más falla y cómo evitarlo. */
  mistake: string
  /** "Consejo OnBike": práctico y local. */
  tip:     string
  /** 2 o 5 botones en el dibujo del reloj. */
  diagram?: 2 | 5
  legend?:  GuideLegendRow[]
  /** "¿Tienes un problema en este paso?": 2-3 soluciones concretas. */
  trouble: [string, string][]
  /** Solo el paso 1: "Lo que necesitas antes de empezar" y consejos para Venezuela. */
  needs?:     string[]
  venezuela?: string[]
}

/** Tarjeta desplegable de "Saca el máximo provecho". `kinds` = tipos de dispositivo a los que aplica. */
export interface GuideExtra {
  id:    string
  title: string
  kinds: readonly GuideKind[]
  /** Párrafos y listas con las mismas marcas que los pasos; las líneas que empiezan con "- " son viñetas. */
  body:  string[]
}

/** Producto Garmin del negocio, listo para pintar en la guía (precios ya formateados en el servidor). */
export interface GuideProduct {
  id:        number
  name:      string
  image:     string | null
  /** Índice en GUIDE_MODELS del modelo que tiene guía; null = accesorio. */
  modelIndex: number | null
  priceUsd:  string | null
  priceBs:   string | null
  consult:   boolean
  href:      string
}
