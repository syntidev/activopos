import {
  User, Store, Globe, CreditCard, Clock, Tag, CheckCircle,
  Package, Wrench, UtensilsCrossed, LayoutGrid,
  ShoppingBasket, Beef, Hammer, Pill, Smartphone, Shirt, Wine,
  Package2, Ham, Sofa, Sparkles, GraduationCap, Stethoscope,
  FileText, Cpu, Wind, Utensils, Coffee, Croissant, IceCream,
  Pizza, Hamburger, Salad, Wheat, PawPrint,
  DollarSign, Banknote, Coins, ArrowLeftRight, Mail,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Ciclo de color por posición para íconos de opciones seleccionables
// (tipo de negocio, sub-segmento, método de pago) — paleta KPI sellada,
// clases toneBlue/toneViolet/toneMostaza/toneVerde en registro.module.css.
export const OPTION_TONES = ['toneBlue', 'toneViolet', 'toneMostaza', 'toneVerde'] as const

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
  icon:  LucideIcon
  desc:  string
}

// Íconos alineados con el mapeo real slug→Lucide de components/marketing/shared/SegmentIcon.tsx
// (carniceria→Beef, restaurante→Utensils, ferreterias→Hammer, farmacias→Pill, tecnologia→Smartphone,
// tiendas-ropa→Shirt, licoreria→Wine, mayorista→Package2, mascotas→PawPrint, repuestos→Wrench,
// lavanderia→Wind, gestoria-tramites→FileText, abastos→ShoppingBasket) — mismo criterio aplicado
// a segmentos sin precedente exacto. 'otro' usa Package, igual que el fallback de SegmentIcon.
export const SUB_SEGMENTS: Record<string, SubSegment[]> = {
  productos: [
    { id: 'bodega',          label: 'Bodega',          icon: ShoppingBasket, desc: 'Abarrotes y básicos' },
    { id: 'minimercado',     label: 'Minimercado',     icon: Store,          desc: 'Alimentos, aseo, frutas' },
    { id: 'carniceria',      label: 'Carnicería',      icon: Beef,           desc: 'Carnes y proteínas' },
    { id: 'ferreteria',      label: 'Ferretería',      icon: Hammer,         desc: 'Herramientas y materiales' },
    { id: 'farmacia',        label: 'Farmacia',        icon: Pill,           desc: 'Medicamentos y salud' },
    { id: 'tecnologia',      label: 'Electrónica',     icon: Smartphone,     desc: 'Tecnología e informática' },
    { id: 'ropa',            label: 'Ropa y calzado',  icon: Shirt,          desc: 'Moda para todas las edades' },
    { id: 'licoreria',       label: 'Licorería',       icon: Wine,           desc: 'Bebidas alcohólicas' },
    { id: 'distribuidora',   label: 'Distribuidora',   icon: Package2,       desc: 'Comercialización al mayor' },
    { id: 'charcuteria',     label: 'Charcutería',     icon: Ham,            desc: 'Quesos, jamones, embutidos' },
    { id: 'articulos_hogar', label: 'Hogar y deco',    icon: Sofa,           desc: 'Artículos para el hogar' },
    { id: 'otro',            label: '¿Otro? ¿Cuál?',   icon: Package,        desc: 'Escribe tu segmento' },
  ],
  servicios: [
    { id: 'belleza',       label: 'Belleza y estética', icon: Sparkles,      desc: 'Peluquería, spa, manicure' },
    { id: 'mecanica',      label: 'Mecánica',           icon: Wrench,        desc: 'Taller automotriz' },
    { id: 'educacion',     label: 'Educación',          icon: GraduationCap, desc: 'Clases y tutorías' },
    { id: 'salud',         label: 'Salud',              icon: Stethoscope,   desc: 'Consultas médicas' },
    { id: 'juridico',      label: 'Jurídico',           icon: FileText,      desc: 'Abogados y asesorías legales' },
    { id: 'tecnologia_sv', label: 'Tech & Software',    icon: Cpu,           desc: 'Desarrollo y soporte técnico' },
    { id: 'limpieza',      label: 'Limpieza',           icon: Wind,          desc: 'Servicios de aseo y limpieza' },
    { id: 'otro',          label: '¿Otro? ¿Cuál?',      icon: Package,       desc: 'Escribe tu segmento' },
  ],
  comida: [
    { id: 'restaurante',      label: 'Restaurante',        icon: Utensils,   desc: 'Comidas listas para consumir' },
    { id: 'cafeteria',        label: 'Cafetería',          icon: Coffee,     desc: 'Café, bebidas y ligeros' },
    { id: 'panaderia',        label: 'Panadería y repos.', icon: Croissant,  desc: 'Pan, tortas y pasteles' },
    { id: 'heladeria',        label: 'Heladería',          icon: IceCream,   desc: 'Helados y postres fríos' },
    { id: 'pizzeria',         label: 'Pizzería',           icon: Pizza,      desc: 'Pizzas y comida italiana' },
    { id: 'hamburgueseria',   label: 'Hamburguesería',     icon: Hamburger,  desc: 'Hamburguesas y comida rápida' },
    { id: 'bar',              label: 'Bar / Licorería',    icon: Wine,       desc: 'Bebidas y entretenimiento' },
    { id: 'naturista',        label: 'Naturista',          icon: Salad,      desc: 'Comida sana y suplementos' },
    { id: 'otro',             label: '¿Otro? ¿Cuál?',      icon: Package,    desc: 'Escribe tu tipo de comida' },
  ],
  mixto: [
    { id: 'minimarket',   label: 'Minimarket mixto', icon: ShoppingBasket, desc: 'Productos y servicios básicos' },
    { id: 'agropecuario', label: 'Agropecuario',     icon: Wheat,          desc: 'Insumos y productos agrícolas' },
    { id: 'veterinaria',  label: 'Veterinaria',      icon: PawPrint,       desc: 'Mascotas y productos vet.' },
    { id: 'otro',         label: '¿Otro? ¿Cuál?',    icon: Package,        desc: 'Escribe tu negocio' },
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
  icon:  LucideIcon
}

/** ids que ya siembra POST /api/onboarding/setup (Efectivo Bs/USD, Pago Móvil, Zelle) */
export const SEEDED_PAYMENT_IDS = new Set(['pago_movil', 'zelle', 'efectivo_usd', 'efectivo_bs'])

// Íconos alineados con TYPE_CONFIG de configuracion/tabs/TabCobros.tsx (cash→Banknote,
// movil→Smartphone, binance→Coins, transfer→ArrowLeftRight) — mismo negocio, mismo vocabulario
// visual. TabCobros usa Smartphone también para 'zelle', pero acá ambos aparecen juntos en la
// misma lista y un ícono duplicado se leería como error visual; se usa Mail para Zelle
// (transferencia remota vía correo/teléfono, coherente con cómo funciona Zelle en EE.UU.).
export const PAYMENT_METHOD_DEFS: PaymentMethodDef[] = [
  { id: 'pago_movil',    label: 'Pago Móvil',             desc: 'Transferencia bancaria venezolana', icon: Smartphone },
  { id: 'zelle',         label: 'Zelle',                  desc: 'Transferencia USA',                 icon: Mail },
  { id: 'efectivo_usd',  label: 'Efectivo USD',           desc: 'Dólares en efectivo',                icon: DollarSign },
  { id: 'efectivo_bs',   label: 'Efectivo Bs',            desc: 'Bolívares en efectivo',              icon: Banknote },
  { id: 'binance',       label: 'Binance Pay / USDT',     desc: 'Pago con criptomonedas',             icon: Coins },
  { id: 'transferencia', label: 'Transferencia bancaria', desc: 'Banco a banco',                      icon: ArrowLeftRight },
]
