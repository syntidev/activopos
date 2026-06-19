export type TrendDirection = 'up' | 'down' | 'stable'
export type PeriodType     = 'week' | 'month' | 'quarter'

export interface SummaryData {
  ok:     boolean
  period: { from: string; to: string; days: number; label: string }
  ventas: {
    total_usd:      number
    total_bs:       number
    count:          number
    avg_ticket_usd: number
    items_sold:     number
  }
  vs_anterior: {
    total_usd:     number
    variacion_pct: number
    tendencia:     TrendDirection
  }
  mejor_dia:      { date: string; total_usd: number } | null
  peor_dia:       { date: string; total_usd: number } | null
  mejor_hora:     { hour: number; avg_usd: number } | null
  por_metodo:     { method_name: string; total_usd: number; count: number; pct: number }[]
  dias_activos:   number
  dias_sin_venta: number
}

export interface TopProductItem {
  id:            number
  name:          string
  sku:           string | null
  category_name: string | null
  qty_sold:      number
  total_usd:     number
  avg_price_usd: number
  pct_of_total:  number
  trend:         TrendDirection
}

export interface TopProductsData {
  ok:               boolean
  period:           { from: string; to: string }
  products:         TopProductItem[]
  total_period_usd: number
}

export interface TrendPoint {
  label:          string
  from:           string
  to:             string
  total_usd:      number
  count:          number
  avg_ticket_usd: number
}

export interface TrendsData {
  ok:          boolean
  period_type: PeriodType
  data:        TrendPoint[]
  max_usd:     number
  growth_pct:  number
}
