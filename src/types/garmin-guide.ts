/** Tipo de control del dispositivo: t = táctil y botones, b = solo botones, s = sin pantalla, c = Edge, r = Varia, h = banda HRM. */
export type GuideKind = 't' | 'b' | 's' | 'c' | 'r' | 'h'

export interface GuideModel {
  family: string
  name:   string
  kind:   GuideKind
}

/** Botones físicos que se dibujan como chip dentro del texto: {luz}, {start|ENTER/GPS}. */
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
  id:         string
  title:      string
  paragraphs?: string[]
  list?:      string[]
  tip?:       string
  /** 2 o 5 botones en el dibujo del reloj. */
  diagram?:   2 | 5
  legend?:    GuideLegendRow[]
  /** Pasos distintos para iPhone y Android. */
  byOs?:      { iphone: string[]; android: string[] }
  faq?:       [string, string][]
  /** Último paso: muestra WhatsApp, compartir y cambiar de reloj. */
  final?:     boolean
}
