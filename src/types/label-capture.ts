export type LabelCaptureStatus = 'ok' | 'review'

export interface LabelCaptureDTO {
  id: number
  ean: string
  ref: string
  model_name: string
  label_color: string
  garment: string
  size: string
  gender: string
  units: number
  color_actual: string | null
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

/** Cuerpo del PATCH /api/label-capture/[id]: cada campo opcional viaja solo si cambió. */
export interface LabelCapturePatch {
  add_unit?: true
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
