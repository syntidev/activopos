// Tabla de referencia de tallas — dato de industria, no de tenant (por eso
// vive en código, no en DB). La conversión EU↔US real varía levemente por
// marca (Adidas EU42=US8.5, Mizuno EU42=US9): esta tabla es SUGERENCIA
// editable, nunca valor forzado — ver suggestEquivalence().
//
// Rangos y fuente: EU39-51↔US6.5-16 (caballero), EU35-42↔US5-10.5 (dama),
// EU28-38↔US kids equivalente (niño/niña, comparten tabla), y ropa
// XS-4XL↔P/M/G/EG/EEG (mapeo simple 1:1 aproximado, caballero/dama comparten
// tabla — las letras no son específicas de género). ropa-nino/ropa-nina usan
// tallas por edad (numéricas), sin equivalencia estándar — no tienen entrada.

export interface SizeGuideEntry {
  local:      string
  equivalent: string
}

export interface SizeGuideDef {
  label_local:      string
  label_equivalent: string
  entries:          SizeGuideEntry[]
}

const ZAP_CABALLERO: SizeGuideEntry[] = [
  { local: '39', equivalent: '6.5' },
  { local: '40', equivalent: '7'   },
  { local: '41', equivalent: '8'   },
  { local: '42', equivalent: '8.5' },
  { local: '43', equivalent: '9.5' },
  { local: '44', equivalent: '10'  },
  { local: '45', equivalent: '11'  },
  { local: '46', equivalent: '12'  },
  { local: '47', equivalent: '13'  },
  { local: '48', equivalent: '14'  },
  { local: '49', equivalent: '15'  },
  { local: '50', equivalent: '15.5' },
  { local: '51', equivalent: '16'  },
]

const ZAP_DAMA: SizeGuideEntry[] = [
  { local: '35', equivalent: '5'    },
  { local: '36', equivalent: '5.5'  },
  { local: '37', equivalent: '6.5'  },
  { local: '38', equivalent: '7.5'  },
  { local: '39', equivalent: '8'    },
  { local: '40', equivalent: '9'    },
  { local: '41', equivalent: '9.5'  },
  { local: '42', equivalent: '10.5' },
]

const ZAP_NINO_NINA: SizeGuideEntry[] = [
  { local: '28', equivalent: '10'  },
  { local: '29', equivalent: '11'  },
  { local: '30', equivalent: '11.5' },
  { local: '31', equivalent: '12.5' },
  { local: '32', equivalent: '13.5' },
  { local: '33', equivalent: '1Y'  },
  { local: '34', equivalent: '2Y'  },
  { local: '35', equivalent: '3Y'  },
  { local: '36', equivalent: '3.5Y' },
  { local: '37', equivalent: '4.5Y' },
  { local: '38', equivalent: '5.5Y' },
]

const ROPA_LETRA: SizeGuideEntry[] = [
  { local: 'XS',  equivalent: 'P'   },
  { local: 'S',   equivalent: 'P'   },
  { local: 'M',   equivalent: 'M'   },
  { local: 'L',   equivalent: 'G'   },
  { local: 'XL',  equivalent: 'EG'  },
  { local: '2XL', equivalent: 'EEG' },
  { local: '3XL', equivalent: 'EEG' },
  { local: '4XL', equivalent: 'EEG' },
]

export const SIZE_GUIDES: Record<string, SizeGuideDef> = {
  'zap-caballero': { label_local: 'EU', label_equivalent: 'US', entries: ZAP_CABALLERO },
  'zap-dama':      { label_local: 'EU', label_equivalent: 'US', entries: ZAP_DAMA },
  'zap-nino':      { label_local: 'EU', label_equivalent: 'US', entries: ZAP_NINO_NINA },
  'zap-nina':      { label_local: 'EU', label_equivalent: 'US', entries: ZAP_NINO_NINA },
  'ropa-caballero': { label_local: 'Talla', label_equivalent: 'Equivalencia', entries: ROPA_LETRA },
  'ropa-dama':      { label_local: 'Talla', label_equivalent: 'Equivalencia', entries: ROPA_LETRA },
}

export function hasSizeGuide(category: string): boolean {
  return category in SIZE_GUIDES
}

// Sugerencia editable — nunca autoritativa. El caller (form/API) siempre debe
// dejar el campo abierto para que el usuario lo corrija por marca real.
export function suggestEquivalence(category: string, valor: string): string | null {
  const guide = SIZE_GUIDES[category]
  if (!guide) return null
  return guide.entries.find(e => e.local === valor)?.equivalent ?? null
}
