export interface SegmentAccent {
  bg:   string
  icon: string
}

// Acento visual por slug de segmento (mismo slug que usa SegmentIcon) — no
// por theme_key, porque theme_key se comparte entre negocios distintos
// (ferreterias/repuestos ambos "ferreteria") y necesitan verse diferentes.
// Fuente única — antes duplicado en SegmentsSection.tsx y segmentos/page.tsx.
export const SEGMENT_ACCENT: Record<string, SegmentAccent> = {
  carniceria:          { bg: '#FAECE7', icon: '#993C1D' },
  restaurante:         { bg: '#FCEBEB', icon: '#A32D2D' },
  ferreterias:         { bg: '#FAEEDA', icon: '#854F0B' },
  farmacias:           { bg: '#E1F5EE', icon: '#0F6E56' },
  'tiendas-ropa':      { bg: '#FBEAF0', icon: '#993556' },
  abastos:             { bg: '#DCE6FF', icon: '#0038BD' },
  tecnologia:          { bg: '#E1F5EE', icon: '#0F6E56' },
  repuestos:           { bg: '#FAEEDA', icon: '#854F0B' },
  servicios:           { bg: '#EEEDFE', icon: '#3C3489' },
  belleza:             { bg: '#FDF0F7', icon: '#B03D75' },
  bisuteria:           { bg: '#F3EAFB', icon: '#7B3FA0' },
  'comida-rapida':     { bg: '#FFE9DC', icon: '#C2410C' },
  deportes:            { bg: '#E6F6E1', icon: '#1F7A34' },
  electronica:         { bg: '#E6E9FB', icon: '#3441A6' },
  fruteria:            { bg: '#F3F8DC', icon: '#6B7A0F' },
  'gestoria-tramites': { bg: '#E7ECF2', icon: '#3D5A73' },
  jugueteria:          { bg: '#FDF3D9', icon: '#8A6200' },
  lavanderia:          { bg: '#E0F2FE', icon: '#0369A1' },
  licoreria:           { bg: '#F3E8FF', icon: '#7E22CE' },
  mascotas:            { bg: '#FFF1E6', icon: '#92400E' },
  mayorista:           { bg: '#FBEFE3', icon: '#B45309' },
  muebleria:           { bg: '#EFEAE3', icon: '#78350F' },
  optica:              { bg: '#E0F7FA', icon: '#0E7490' },
  panaderia:           { bg: '#FFF4E0', icon: '#D97706' },
  papeleria:           { bg: '#EEF2F6', icon: '#475569' },
}
