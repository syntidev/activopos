import {
  User, Store, Globe, CreditCard, Clock, Tag, CheckCircle,
  Package, Wrench, UtensilsCrossed, LayoutGrid,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface StepMeta {
  key:   string
  label: string
  icon:  LucideIcon
}

export const STEP_META: StepMeta[] = [
  { key: 'cuenta',      label: 'Cuenta',      icon: User },
  { key: 'negocio',     label: 'Negocio',     icon: Store },
  { key: 'slug',        label: 'URL',         icon: Globe },
  { key: 'pagos',       label: 'Pagos',       icon: CreditCard },
  { key: 'horario',     label: 'Horario',     icon: Clock },
  { key: 'categorias',  label: 'Categorías',  icon: Tag },
  { key: 'bienvenida',  label: 'Listo',       icon: CheckCircle },
]

export interface BusinessType {
  id:    string
  label: string
  desc:  string
  icon:  LucideIcon
}

export const BUSINESS_TYPES: BusinessType[] = [
  { id: 'productos', label: 'Productos',        desc: 'Venta de artículos físicos',      icon: Package },
  { id: 'servicios',  label: 'Servicios',        desc: 'Asesorías, atención, soluciones', icon: Wrench },
  { id: 'comida',     label: 'Comida y bebidas', desc: 'Restaurantes, panaderías, cafés', icon: UtensilsCrossed },
  { id: 'mixto',      label: 'Mixto',            desc: 'Productos y servicios',           icon: LayoutGrid },
]

export interface SubSegment {
  id:    string
  label: string
  emoji: string
  desc:  string
}

export const SUB_SEGMENTS: Record<string, SubSegment[]> = {
  productos: [
    { id: 'bodega',          label: 'Bodega',          emoji: '🛒', desc: 'Abarrotes y básicos' },
    { id: 'minimercado',     label: 'Minimercado',     emoji: '🏪', desc: 'Alimentos, aseo, frutas' },
    { id: 'carniceria',      label: 'Carnicería',      emoji: '🥩', desc: 'Carnes y proteínas' },
    { id: 'ferreteria',      label: 'Ferretería',      emoji: '🔧', desc: 'Herramientas y materiales' },
    { id: 'farmacia',        label: 'Farmacia',        emoji: '💊', desc: 'Medicamentos y salud' },
    { id: 'tecnologia',      label: 'Electrónica',     emoji: '📱', desc: 'Tecnología e informática' },
    { id: 'ropa',            label: 'Ropa y calzado',  emoji: '👗', desc: 'Moda para todas las edades' },
    { id: 'licoreria',       label: 'Licorería',       emoji: '🍺', desc: 'Bebidas alcohólicas' },
    { id: 'distribuidora',   label: 'Distribuidora',   emoji: '📦', desc: 'Comercialización al mayor' },
    { id: 'charcuteria',     label: 'Charcutería',     emoji: '🧀', desc: 'Quesos, jamones, embutidos' },
    { id: 'articulos_hogar', label: 'Hogar y deco',    emoji: '🏠', desc: 'Artículos para el hogar' },
    { id: 'otro',            label: '¿Otro? ¿Cuál?',   emoji: '✏️', desc: 'Escribe tu segmento' },
  ],
  servicios: [
    { id: 'belleza',       label: 'Belleza y estética', emoji: '💅', desc: 'Peluquería, spa, manicure' },
    { id: 'mecanica',      label: 'Mecánica',           emoji: '🔩', desc: 'Taller automotriz' },
    { id: 'educacion',     label: 'Educación',          emoji: '📚', desc: 'Clases y tutorías' },
    { id: 'salud',         label: 'Salud',              emoji: '🏥', desc: 'Consultas médicas' },
    { id: 'juridico',      label: 'Jurídico',           emoji: '⚖️', desc: 'Abogados y asesorías legales' },
    { id: 'tecnologia_sv', label: 'Tech & Software',    emoji: '💻', desc: 'Desarrollo y soporte técnico' },
    { id: 'limpieza',      label: 'Limpieza',           emoji: '🧹', desc: 'Servicios de aseo y limpieza' },
    { id: 'otro',          label: '¿Otro? ¿Cuál?',      emoji: '✏️', desc: 'Escribe tu segmento' },
  ],
  comida: [
    { id: 'restaurante',      label: 'Restaurante',        emoji: '🍽️', desc: 'Comidas listas para consumir' },
    { id: 'cafeteria',        label: 'Cafetería',          emoji: '☕', desc: 'Café, bebidas y ligeros' },
    { id: 'panaderia',        label: 'Panadería y repos.', emoji: '🥐', desc: 'Pan, tortas y pasteles' },
    { id: 'heladeria',        label: 'Heladería',          emoji: '🍦', desc: 'Helados y postres fríos' },
    { id: 'pizzeria',         label: 'Pizzería',           emoji: '🍕', desc: 'Pizzas y comida italiana' },
    { id: 'hamburgueseria',   label: 'Hamburguesería',     emoji: '🍔', desc: 'Hamburguesas y comida rápida' },
    { id: 'bar',              label: 'Bar / Licorería',    emoji: '🍹', desc: 'Bebidas y entretenimiento' },
    { id: 'naturista',        label: 'Naturista',          emoji: '🥗', desc: 'Comida sana y suplementos' },
    { id: 'otro',             label: '¿Otro? ¿Cuál?',      emoji: '✏️', desc: 'Escribe tu tipo de comida' },
  ],
  mixto: [
    { id: 'minimarket',   label: 'Minimarket mixto', emoji: '🏬', desc: 'Productos y servicios básicos' },
    { id: 'agropecuario', label: 'Agropecuario',     emoji: '🌾', desc: 'Insumos y productos agrícolas' },
    { id: 'veterinaria',  label: 'Veterinaria',      emoji: '🐾', desc: 'Mascotas y productos vet.' },
    { id: 'otro',         label: '¿Otro? ¿Cuál?',    emoji: '✏️', desc: 'Escribe tu negocio' },
  ],
}

export const SEGMENT_SEEDS: Record<string, string[]> = {
  bodega:          ['Alimentos', 'Bebidas', 'Lácteos', 'Limpieza', 'Snacks', 'Panadería', 'Enlatados'],
  minimercado:     ['Frutas y Verduras', 'Carnes', 'Lácteos', 'Bebidas', 'Limpieza', 'Enlatados', 'Granos'],
  carniceria:      ['Carnes Rojas', 'Pollo', 'Charcutería', 'Mariscos', 'Embutidos', 'Menudencias'],
  ferreteria:      ['Herramientas', 'Materiales de Construcción', 'Eléctrico', 'Plomería', 'Pintura', 'Fijación'],
  farmacia:        ['Medicamentos', 'Vitaminas', 'Cuidado Personal', 'Bebés', 'Insumos Médicos'],
  tecnologia:      ['Celulares', 'Accesorios', 'Computación', 'Audio y Video', 'Servicios Tech'],
  ropa:            ['Dama', 'Caballero', 'Niños', 'Accesorios', 'Calzado', 'Deportivo'],
  licoreria:       ['Cervezas', 'Ron', 'Whisky', 'Vinos', 'Vodka', 'Bebidas Sin Alcohol'],
  distribuidora:   ['Línea A', 'Línea B', 'Por Mayor', 'Unidad'],
  charcuteria:     ['Quesos', 'Jamones', 'Embutidos', 'Encurtidos', 'Untables'],
  belleza:         ['Cortes', 'Color', 'Tratamientos', 'Manicure', 'Cejas y Pestañas', 'Spa'],
  mecanica:        ['Mantenimiento', 'Reparación Motor', 'Eléctrico', 'Frenos', 'Cauchos'],
  restaurante:     ['Entradas', 'Platos Principales', 'Sopas', 'Ensaladas', 'Postres', 'Bebidas'],
  cafeteria:       ['Cafés', 'Jugos Naturales', 'Batidos', 'Snacks', 'Croissants', 'Tortas'],
  panaderia:       ['Pan', 'Tortas', 'Pastelería', 'Ponqués', 'Galletas', 'Bebidas'],
  heladeria:       ['Helados', 'Paletas', 'Batidos', 'Sundaes', 'Waffles', 'Bebidas Frías'],
  pizzeria:        ['Pizzas', 'Pastas', 'Entradas', 'Bebidas', 'Postres'],
  hamburgueseria:  ['Hamburguesas', 'Perros Calientes', 'Papas Fritas', 'Combos', 'Bebidas'],
  bar:             ['Cocteles', 'Cervezas', 'Ron', 'Whisky', 'Tapas', 'Snacks'],
  naturista:       ['Ensaladas', 'Jugos Verdes', 'Batidos Proteicos', 'Suplementos', 'Snacks Sanos'],
  minimarket:      ['Alimentos', 'Bebidas', 'Limpieza', 'Servicios', 'Varios'],
  veterinaria:     ['Alimentos', 'Medicamentos', 'Accesorios', 'Grooming', 'Consultas'],
  servicios:       ['Consultas', 'Proyectos', 'Mantenimiento', 'Asesorías', 'Reparaciones'],
}

export interface Banco {
  code: string
  name: string
}

export const BANCOS_VENEZUELA: Banco[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0104', name: 'Banco Venezolano de Crédito' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0108', name: 'Banco Provincial' },
  { code: '0114', name: 'Banco del Caribe (Bancaribe)' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0116', name: 'Banco Occidental de Descuento (BOD)' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0137', name: 'Banco Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Bangente' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'Delsur Banco Universal' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Bicentenario Banco Universal' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
]

export interface PaymentMethodDef {
  id:    string
  label: string
  desc:  string
  emoji: string
}

/** ids que ya siembra POST /api/onboarding/setup (Efectivo Bs/USD, Pago Móvil, Zelle) */
export const SEEDED_PAYMENT_IDS = new Set(['pago_movil', 'zelle', 'efectivo_usd', 'efectivo_bs'])

export const PAYMENT_METHOD_DEFS: PaymentMethodDef[] = [
  { id: 'pago_movil',    label: 'Pago Móvil',             desc: 'Transferencia bancaria venezolana', emoji: '📱' },
  { id: 'zelle',         label: 'Zelle',                  desc: 'Transferencia USA',                 emoji: '✉️' },
  { id: 'efectivo_usd',  label: 'Efectivo USD',           desc: 'Dólares en efectivo',                emoji: '💰' },
  { id: 'efectivo_bs',   label: 'Efectivo Bs',            desc: 'Bolívares en efectivo',              emoji: '💵' },
  { id: 'binance',       label: 'Binance Pay / USDT',     desc: 'Pago con criptomonedas',             emoji: '₿' },
  { id: 'transferencia', label: 'Transferencia bancaria', desc: 'Banco a banco',                      emoji: '🏦' },
]
