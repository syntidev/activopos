// Contrato: .doc/CONTRATO_METRICAS.md (v1). Cualquier cambio de forma se anota allí como v2.

export interface MetricsRange { from: string; to: string; days: number }

export interface MetricsTotals {
  qty: number
  usd: number
  bs: number
  prev_qty: number
  prev_usd: number
}

export interface ProductMetricRow {
  product_id: number | null      // null = fila "Ventas sin detalle de producto" (v1.2)
  name: string
  category: string | null
  subcategory: string | null
  brand: string | null
  qty: number | null             // null solo en la fila sin detalle
  usd: number
  bs: number
  prev_qty: number | null
  prev_usd: number
}

export interface ProductsMetricsResponse {
  range: MetricsRange
  prev_range: MetricsRange
  rows: ProductMetricRow[]
  totals: MetricsTotals
}

export type MetricsGroupBy = 'category' | 'subcategory' | 'brand'

export interface GroupMetricRow {
  key_id: number | null
  label: string
  qty: number | null             // null solo en la fila sin detalle (v1.2)
  usd: number
  bs: number
  prev_qty: number | null
  prev_usd: number
  products_count: number
}

export interface GroupsMetricsResponse {
  by: MetricsGroupBy
  range: MetricsRange
  prev_range: MetricsRange
  rows: GroupMetricRow[]
  totals: MetricsTotals
}

export interface MetricsCashier { id: number; name: string }

export type GoalScope = 'product' | 'category' | 'brand'
export type GoalMetric = 'units' | 'usd'

export interface SalesGoalItem {
  id: number
  scope: GoalScope
  ref_id: number
  label: string
  period: string
  metric: GoalMetric
  target: number
  actual: number
  pct: number
  remaining: number
  days_left: number
  per_day_needed: number | null
}

