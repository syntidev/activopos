export type LabelCaptureStatus = 'ok' | 'review'

/** Marca cuyo perfil gobierna la captura (ver src/lib/label-profiles.ts). */
export type LabelProfileId = 'safetti' | 'on'

export interface LabelCaptureDTO {
  id: number
  ean: string
  ref: string
  model_name: string
  /** Safetti: color de la etiqueta. On: colorway ("White | Black"). */
  label_color: string
  garment: string
  /** Safetti: talla de lista cerrada. On: valor de la variante ("US 9 · EU 42.5"). */
  size: string
  gender: string
  units: number
  color_actual: string | null
  profile: LabelProfileId
  /** On: estilo completo (modelo + género + color). Vacío en Safetti. */
  style: string
  size_us: string
  size_eu: string
  size_uk: string
  size_jp: string
  status: LabelCaptureStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LabelCaptureTotals {
  variants: number
  units: number
}

export interface LabelCaptureList {
  items: LabelCaptureDTO[]
  totals: LabelCaptureTotals
}

/** Lo que devuelve el modelo de visión ya validado (vacío = no se leyó con certeza). */
export interface LabelOcrResult {
  ref: string
  modelo: string
  talla: string
}

/** Lo que el OCR extrae de una etiqueta On (vacío = no se leyó con certeza). */
export interface OnOcrResult {
  estilo: string
  modelo: string
  colorway: string
  genero: string
  us: string
  eu: string
  uk: string
  jp: string
}

/** Cuerpo del POST /api/label-capture con perfil On. Repetir un EAN suma 1 a su variante. */
export interface OnCaptureBody {
  profile: 'on'
  ean: string
  style: string
  model_name: string
  colorway: string
  gender: string
  us: string
  eu: string
  uk: string
  jp: string
}

/** Respuesta del POST On: 201 = variante nueva; 200 + added = el EAN ya existía y se sumó 1. */
export interface OnCaptureResponse {
  item: LabelCaptureDTO
  added: boolean
  reasons: string[]
}

/** Cuerpo del PATCH /api/label-capture/[id]: cada campo opcional viaja solo si cambió. */
export interface LabelCapturePatch {
  add_unit?: true
  /** Deshacer un +1 (nunca baja de 1 unidad). */
  sub_unit?: true
  units?: number
  ean?: string
  ref?: string
  model_name?: string
  label_color?: string
  size?: string
  color_actual?: string | null
  notes?: string | null
}

/** Foto sin código de barras legible: espera que se escriba el EAN a mano. */
export interface PendingLabel {
  key: string
  fileName: string
  ocr: LabelOcrResult
  ean: string
}

export interface LabelCaptureDuplicate {
  error: string
  code: 'duplicate'
  id: number
  units: number
}
