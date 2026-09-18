// Presets de talla/color para el flujo de variantes de una sola dimensión.
// Fuente única — consumida por ProductFormLayout.tsx (formulario completo) y
// ProductModal.tsx (modal rápido de productos/page.tsx). Antes vivían
// duplicados y el de ProductModal quedó desactualizado (5 grupos viejos,
// sin variant_group) — ver commit c5532e2.

export const PRESET_GROUPS = [
  { id: 'zap-dama',       label: 'Zapato Dama',      values: ['35','36','37','38','39','40','41','42'] },
  { id: 'zap-caballero',  label: 'Zapato Caballero', values: ['39','40','41','42','43','44','45','46','47','48','49','50','51'] },
  { id: 'zap-nino',       label: 'Zapato Niño',      values: ['28','29','30','31','32','33','34','35','36','37','38'] },
  { id: 'zap-nina',       label: 'Zapato Niña',      values: ['28','29','30','31','32','33','34','35','36','37','38'] },
  { id: 'ropa-dama',      label: 'Ropa Dama',        values: ['XS','S','M','L','XL','2XL'] },
  { id: 'ropa-caballero', label: 'Ropa Caballero',   values: ['XS','S','M','L','XL','2XL','3XL','4XL'] },
  { id: 'ropa-nino',      label: 'Ropa Niño',        values: ['2','4','6','8','10','12','14'] },
  { id: 'ropa-nina',      label: 'Ropa Niña',        values: ['2','4','6','8','10','12','14'] },
  { id: 'colores',        label: 'Colores',          values: ['Negro','Blanco','Rojo','Azul','Verde','Amarillo','Naranja','Rosado','Gris','Morado'] },
] as const

// Presets de calzado -> muestran el input de equivalencia opcional junto al chip.
export const SHOE_GROUP_IDS = ['zap-dama', 'zap-caballero', 'zap-nino', 'zap-nina'] as const
