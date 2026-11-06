import { readCartaSettings, type CartaAccent, type CartaPreset } from '@/lib/carta/settings'
import type { Palette } from './image'

/**
 * Paleta de la tarjeta para compartir de una Carta: espejo de los tokens --carta-* de styles/tokens.css
 * (papel → bg, card → panel, tinta → text, muted, acento → accent). Una imagen no entiende variables CSS, por eso se copian aquí:
 * si cambian los presets en tokens.css, se actualizan estos valores.
 */
const BASE: Record<CartaPreset, Palette> = {
  brasa: { bg: '#F8EFE0', panel: '#FFFBF3', text: '#2B1B12', muted: '#6F5A47', accent: '#B8381A' },
  noche: { bg: '#16120E', panel: '#201A14', text: '#F4ECDD', muted: '#A8977F', accent: '#C9A55C' },
  cafe:  { bg: '#F4ECE2', panel: '#FFFAF3', text: '#2A1E16', muted: '#6B5646', accent: '#7A4A2A' },
  mar:   { bg: '#F1F7F8', panel: '#FFFFFF', text: '#10262C', muted: '#4F6A72', accent: '#0F6A78' },
  verde: { bg: '#F2F5EC', panel: '#FCFDF8', text: '#1D2A18', muted: '#566A4C', accent: '#2F6B3A' },
}

const ACCENT_LIGHT: Record<CartaAccent, string> = { rojo: '#B8381A', vino: '#8E2236', verde: '#2F6B3A', azul: '#1F5FA8', oro: '#7D5F1F' }
const ACCENT_NOCHE: Record<CartaAccent, string> = { rojo: '#FF8A70', vino: '#E58AA0', verde: '#8FD19A', azul: '#8DB8F0', oro: '#C9A55C' }

export function cartaPalette(settings: unknown): Palette {
  const { preset, accent } = readCartaSettings(settings)
  const base = BASE[preset]
  if (!accent) return base
  return { ...base, accent: (preset === 'noche' ? ACCENT_NOCHE : ACCENT_LIGHT)[accent] }
}
