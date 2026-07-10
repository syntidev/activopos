'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Package,
  Boxes,
  ShoppingCart,
  RotateCcw,
  Users,
  Truck,
  ClipboardList,
  BarChart2,
  Wallet,
  DollarSign,
  UserCog,
  Settings,
  QrCode,
  MessageCircle,
  Send,
  X,
  RotateCw,
  ExternalLink,
  ChevronRight,
  Lightbulb,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { helpContent, type HelpModule } from '@/lib/help-content'
import styles from './ayuda.module.css'

/* ── Help topic content ── */

interface HelpTopic {
  steps: string[]
  tip: string
}

const HELP_TOPICS: Record<string, HelpTopic> = {
  Productos: {
    steps: [
      'Ve a Productos → botón "Nuevo Producto".',
      'Escribe el nombre, el precio en USD y el costo (para saber tu ganancia real).',
      'Escoge si se vende por unidad o por peso (kg).',
      'Si tiene tallas, colores u otras variantes, actívalas y agrégalas.',
      'Guarda — ya puedes venderlo desde el Punto de Venta.',
    ],
    tip: 'Agrégale el código de barras para venderlo más rápido con el escáner.',
  },
  Inventario: {
    steps: [
      'Ve a Inventario y busca el producto.',
      'Presiona "Entrada" cuando te llegue mercancía nueva y anota cantidad y costo.',
      'Usa "Ajuste" si algo se dañó, se perdió o hiciste un conteo distinto.',
      'Usa "Consumo interno" si sacaste producto para uso propio del negocio.',
    ],
    tip: 'Cada movimiento queda guardado — revisa el historial completo desde cada producto.',
  },
  'Ventas (POS)': {
    steps: [
      'Abre el Punto de Venta desde el menú lateral.',
      'Busca o escanea el producto que quieres vender.',
      'Ingresa la cantidad — el sistema calcula el total en USD y Bs.',
      'Selecciona el método de pago y procesa la venta.',
    ],
    tip: 'Puedes pausar una venta y atender otra al mismo tiempo.',
  },
  Devoluciones: {
    steps: [
      'Ve a Reportes y busca la venta que quieres revertir.',
      'Haz clic en "Anular" e ingresa el motivo de la devolución.',
      'El sistema registrará la devolución y reintegrará el stock.',
    ],
    tip: 'Solo el administrador puede anular ventas para mayor control del negocio.',
  },
  Clientes: {
    steps: [
      'Ve a la sección Clientes y presiona "Nuevo Cliente".',
      'Ingresa nombre, teléfono y cédula o RIF.',
      'Desde el POS puedes asignar la venta a ese cliente.',
    ],
    tip: 'Los clientes con crédito quedan registrados en Finanzas para su cobranza.',
  },
  Reportes: {
    steps: [
      'Ve a Reportes y selecciona el rango de fechas.',
      'Revisa el resumen: ventas, métodos de pago y productos más vendidos.',
      'Usa "Exportar PDF" para guardar o imprimir el reporte.',
    ],
    tip: 'Filtra por cajero para ver el rendimiento de cada empleado.',
  },
  'Catálogo Digital': {
    steps: [
      'Ve a Catálogo Digital para ver tu tienda en línea.',
      'Descarga el código QR o copia el enlace para compartirlo por WhatsApp o redes.',
      'Desde cada producto, activa "Mostrar en catálogo" para que salga publicado.',
      'Los pedidos que hagan tus clientes llegan directo al módulo Pedidos.',
    ],
    tip: 'El stock del catálogo se actualiza solo — si se acaba un producto, nadie lo puede pedir.',
  },
  'Gestión de Caja': {
    steps: [
      'Ve a Gestión de Caja y abre un turno con el monto inicial en efectivo.',
      'Durante el turno todas las ventas se registran automáticamente.',
      'Al cerrar, ingresa el efectivo contado para el cuadre.',
    ],
    tip: 'Haz cortes de caja al mediodía si manejas mucho efectivo.',
  },
  Finanzas: {
    steps: [
      'Ve a Finanzas para ver los ingresos y gastos del negocio.',
      'Registra gastos como alquiler, servicios o pagos a proveedores.',
      'Las ventas a crédito aparecen en Cuentas por Cobrar.',
    ],
    tip: 'Cobra las deudas desde el perfil del cliente o desde Finanzas directamente.',
  },
  Proveedores: {
    steps: [
      'Ve a Proveedores → botón "Nuevo".',
      'Escribe el nombre, RIF y teléfono del proveedor.',
      'Guarda — ya queda disponible para usarlo al registrar una Compra.',
    ],
    tip: 'Búscalo por nombre o RIF cuando tu lista de proveedores crezca.',
  },
  Compras: {
    steps: [
      'Ve a Proveedores → pestaña Compras → "Nueva Compra".',
      'Elige el proveedor y agrega los productos con cantidad y costo.',
      'Marca "Recibida" si ya tienes la mercancía, o "Pendiente" si quedaste a deber.',
      'Guarda — si quedó recibida, tu stock sube automático.',
    ],
    tip: 'Una compra pendiente aparece como deuda en Finanzas → Cuentas por Pagar.',
  },
  Usuarios: {
    steps: [
      'Ve a Configuración → Usuarios → Nuevo Usuario.',
      'Asigna nombre, cédula, contraseña y rol (cajero o administrador).',
      'El cajero solo verá el POS; el administrador tiene acceso completo.',
    ],
    tip: 'Cambia la contraseña de un cajero desde su perfil si se la olvida.',
  },
  Configuraciones: {
    steps: [
      'Ve a Configuración para personalizar tu negocio.',
      'Agrega el nombre del negocio, logo y teléfono.',
      'Configura la tasa BCV y el formato del ticket de venta.',
    ],
    tip: 'El tema oscuro/claro se cambia desde Apariencia y aplica al instante.',
  },
}

/* ── Help articles ── */

interface HelpCard {
  icon: React.ElementType
  title: string
  description: string
  keywords: string[]
}

const HELP_CARDS: HelpCard[] = [
  {
    icon: Package,
    title: 'Productos',
    description: 'Registro, precio, costo, variantes y código de barras.',
    keywords: ['producto', 'productos', 'registro', 'variante', 'talla', 'codigo de barra', 'costo', 'precio'],
  },
  {
    icon: Boxes,
    title: 'Inventario',
    description: 'Entradas de mercancía, ajustes y consumo interno.',
    keywords: ['inventario', 'stock', 'entrada', 'mercancia', 'ajuste', 'consumo interno', 'movimientos'],
  },
  {
    icon: ShoppingCart,
    title: 'Ventas (POS)',
    description: 'Contado, crédito, pausar ventas, descuentos y clientes.',
    keywords: ['venta', 'pos', 'cobrar', 'pago', 'descuento', 'crédito', 'ticket'],
  },
  {
    icon: RotateCcw,
    title: 'Devoluciones',
    description: 'Procesamiento de reintegros e historial filtrable.',
    keywords: ['devolución', 'reintegro', 'anular', 'cancelar', 'devolver'],
  },
  {
    icon: Users,
    title: 'Clientes',
    description: 'Creación y depuración de tu directorio de clientes.',
    keywords: ['cliente', 'directorio', 'contacto', 'fiado', 'credito'],
  },
  {
    icon: BarChart2,
    title: 'Reportes',
    description: 'Análisis detallado de ventas y exportación en PDF.',
    keywords: ['reporte', 'exportar', 'pdf', 'análisis', 'historial', 'ventas'],
  },
  {
    icon: QrCode,
    title: 'Catálogo Digital',
    description: 'Tu tienda en línea con QR, enlace y pedidos.',
    keywords: ['catalogo', 'catálogo', 'qr', 'enlace', 'tienda en linea', 'pedidos', 'digital'],
  },
  {
    icon: Wallet,
    title: 'Gestión de Caja',
    description: 'Control del efectivo en la tienda o negocio.',
    keywords: ['caja', 'efectivo', 'turno', 'apertura', 'cierre', 'cuadre'],
  },
  {
    icon: DollarSign,
    title: 'Finanzas',
    description: 'Cobranza, CxP, cobros parciales e ingresos/gastos.',
    keywords: ['finanzas', 'cobranza', 'gasto', 'ingreso', 'deuda', 'cobro'],
  },
  {
    icon: Truck,
    title: 'Proveedores',
    description: 'Registro y búsqueda de tus proveedores.',
    keywords: ['proveedor', 'proveedores', 'rif', 'contacto proveedor'],
  },
  {
    icon: ClipboardList,
    title: 'Compras',
    description: 'Registro de compras a proveedor, recibidas o pendientes.',
    keywords: ['compra', 'compras', 'comprar mercancia', 'cuentas por pagar', 'cxp'],
  },
  {
    icon: UserCog,
    title: 'Usuarios',
    description: 'Administrar accesos de tu plantilla laboral.',
    keywords: ['usuario', 'cajero', 'empleado', 'acceso', 'permiso', 'rol'],
  },
  {
    icon: Settings,
    title: 'Configuraciones',
    description: 'Personalizaciones, monedas y formato de ticket.',
    keywords: ['configuracion', 'tasa', 'bcv', 'ticket', 'tema', 'moneda'],
  },
]

/* ── Help modal ──
   Fuente única de contenido: los 9 módulos que existen en helpContent
   (src/lib/help-content.ts) se leen de ahí, no de HELP_TOPICS local, para
   que ambos modales de ayuda (este y components/help/HelpModal.tsx) nunca
   diverjan. Devoluciones/Proveedores/Compras/Usuarios no tienen módulo en
   help-content.ts todavía — siguen usando su contenido local. */

const TITLE_TO_MODULE: Partial<Record<string, HelpModule>> = {
  'Productos':        'productos',
  'Inventario':       'inventario',
  'Ventas (POS)':     'pos',
  'Clientes':         'clientes',
  'Reportes':         'reportes',
  'Catálogo Digital': 'catalogo',
  'Gestión de Caja':  'caja',
  'Finanzas':         'finanzas',
  'Configuraciones':  'configuracion',
}

const OVERLAY_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
}

const PANEL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 340, damping: 28 } },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.14 } },
}

function HelpModal({ card, onClose }: { card: HelpCard | null; onClose: () => void }) {
  const localTopic = card ? HELP_TOPICS[card.title] : null
  const module = card ? TITLE_TO_MODULE[card.title] : undefined
  const steps: string[] = module
    ? helpContent[module].steps.map(s => `${s.title}: ${s.body}`)
    : localTopic?.steps ?? []
  const tip = localTopic?.tip

  useEffect(() => {
    if (!card) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [card, onClose])

  return (
    <AnimatePresence>
      {card && steps.length > 0 && (
        <motion.div
          className={styles.helpModalOverlay}
          variants={OVERLAY_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={card.title}
        >
          <motion.div
            className={styles.helpModalPanel}
            variants={PANEL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.helpModalContent}>
              {/* Header */}
              <div className={styles.helpModalHeader}>
                <div className={styles.helpModalIconWrap} aria-hidden="true">
                  <card.icon size={22} />
                </div>
                <div className={styles.helpModalTitleGroup}>
                  <h2 className={styles.helpModalTitle}>{card.title}</h2>
                  <p className={styles.helpModalDesc}>{card.description}</p>
                </div>
                <button
                  className={styles.helpModalClose}
                  onClick={onClose}
                  aria-label="Cerrar"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Steps */}
              <ol className={styles.helpStepsList}>
                {steps.map((step, i) => (
                  <li key={i} className={styles.helpStepItem}>
                    <span className={styles.helpStepNum} aria-hidden="true">{i + 1}</span>
                    <span className={styles.helpStepText}>{step}</span>
                  </li>
                ))}
              </ol>

              {/* Tip */}
              {tip && (
                <div className={styles.helpTipBox} role="note">
                  <Lightbulb size={16} className={styles.helpTipIcon} aria-hidden="true" />
                  <p className={styles.helpTipText}><strong>Tip:</strong> {tip}</p>
                </div>
              )}

              {/* Footer */}
              <div className={styles.helpModalFooter}>
                <button className={styles.helpModalBtn} onClick={onClose}>
                  Entendido
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Chatbot local fallback ── */

interface BotRule { keywords: string[]; response: string }

const BOT_RULES: BotRule[] = [
  { keywords: ['hola','buenos','buenas'], response: '¡Hola! Soy el asistente de ActivoPOS. Puedo ayudarte con ventas, inventario, caja, pedidos, clientes y configuración. ¿Qué necesitas?' },
  { keywords: ['vender','venta','cobrar','pos','punto de venta'], response: 'Para vender: abre la Caja primero, luego ve al Punto de Venta. Busca el producto por nombre, código de barras o con el escáner de cámara. Agrega al ticket y presiona Cobrar.' },
  { keywords: ['escaner','escanear','camara','codigo de barra','barcode'], response: 'El escáner de cámara está disponible en el POS, Productos e Inventario. Toca el ícono de escáner en el header (solo en móvil). Apunta la cámara al código de barras del producto.' },
  { keywords: ['talla','variante','color','tallas','zapato','ropa'], response: 'Las variantes (talla, color, modelo) se configuran en cada producto. Abre el producto, activa el toggle "Este producto tiene variantes" y selecciona las tallas: ropa adulto (XS-XXXL), ropa niño (2-16), zapato adulto (35-44), zapato niño (18-34).' },
  { keywords: ['inventario','stock','entrada','mercancia'], response: 'Para registrar mercancía: ve a Inventario y haz clic en "Entrada" en el producto correspondiente. Ingresa cantidad y costo. El sistema actualiza el stock y el costo automáticamente.' },
  { keywords: ['crear producto','nuevo producto','agregar producto','producto nuevo'], response: 'Para crear un producto: ve a Productos → "Nuevo Producto". Ponle nombre, precio en USD y costo. Escoge si se vende por unidad o por peso, y si tiene tallas o variantes actívalas ahí mismo.' },
  { keywords: ['proveedor','proveedores'], response: 'Para registrar un proveedor: ve a Proveedores → "Nuevo". Con nombre, RIF y teléfono basta. Ya lo puedes usar al registrar una compra.' },
  { keywords: ['compra','compras','comprar mercancia'], response: 'Para registrar una compra: ve a Proveedores → pestaña Compras → "Nueva Compra". Elige el proveedor, agrega productos con cantidad y costo, y marca si ya la pagaste (Recibida) o quedó a deber (Pendiente).' },
  { keywords: ['caja','abrir caja','cerrar caja','arqueo'], response: 'Para abrir la caja: ve a Gestión de Caja y presiona "Abrir caja" con el monto inicial. Al cerrar: cuenta el efectivo real, ingresa el monto y el sistema calcula la diferencia.' },
  { keywords: ['pedido','pedidos','catalogo','whatsapp','orden'], response: 'Los pedidos del catálogo digital llegan al módulo Pedidos en formato kanban: Recibido → Preparando → Listo → Despachado. Puedes cobrar cada pedido directamente desde la tarjeta.' },
  { keywords: ['cliente','clientes','credito','cxc','deuda'], response: 'Para vender a crédito: en el POS selecciona "Crédito" como método de pago. La deuda queda en el módulo Finanzas → CxC. Para abonar: ve a Clientes → selecciona el cliente → Registrar abono.' },
  { keywords: ['bcv','tasa','bolivar','bs','dolar'], response: 'La tasa BCV se actualiza automáticamente cada hora desde el Banco Central de Venezuela. Se congela en cada venta para que el historial siempre sea exacto en USD.' },
  { keywords: ['reporte','reportes','ventas del dia','cuanto vendi'], response: 'Los reportes están en el módulo Reportes. Puedes ver por Hoy, 7 días, Este mes, Trimestre o un rango de fechas personalizado. También puedes exportar a Excel.' },
  { keywords: ['finanzas','gasto','gastos','utilidad','ganancia'], response: 'En Finanzas puedes registrar gastos, ver tus CxC (ventas a crédito), CxP (cuentas por pagar) y el punto de equilibrio. El resumen muestra ingresos vs gastos del período.' },
  { keywords: ['notificacion','notificaciones','alerta'], response: 'Las notificaciones aparecen en la campana del header. Te avisan de pedidos nuevos del catálogo, stock crítico y CxC vencidas. Puedes marcarlas todas como leídas.' },
  { keywords: ['kds','cocina','kitchen','pantalla cocina'], response: 'El KDS (Kitchen Display System) es una pantalla para cocina o despacho que muestra los pedidos en tiempo real. Se activa en Configuración → Módulos Opcionales. Ideal para restaurantes y cafeterías.' },
  { keywords: ['usuario','usuarios','cajero','pin','contraseña'], response: 'Puedes crear usuarios en el módulo Usuarios. Los cajeros necesitan un PIN de 4 dígitos para autorizar descuentos. Para cambiar contraseña: ve a Configuración → Seguridad.' },
  { keywords: ['ticket','imprimir','impresora','termica','58mm'], response: 'ActivoPOS genera tickets térmicos para impresoras de 58mm (como la Roccia). Después de cada cobro, toca "Imprimir ticket" para enviar a la impresora.' },
  { keywords: ['pwa','instalar','app','movil','celular'], response: 'ActivoPOS funciona como app en tu celular. En Chrome, toca el menú → "Instalar app" o "Agregar a pantalla de inicio". Funciona sin instalación desde la App Store.' },
  { keywords: ['catalogo','tienda','qr','enlace','digital'], response: 'El Catálogo Digital es tu tienda online en activopos.com/catalogo/tu-negocio. Comparte el QR o el enlace con tus clientes. Los pedidos llegan automáticamente al módulo Pedidos.' },
]

const DEFAULT_REPLY = 'No encontré información sobre eso. Puedes preguntarme sobre: ventas, inventario, caja, pedidos, clientes, tallas, escáner, reportes, finanzas, notificaciones, KDS o impresión de tickets.'

function botReply(text: string): string {
  const q = text.toLowerCase()
  for (const rule of BOT_RULES) {
    if (rule.keywords.some(k => q.includes(k))) return rule.response
  }
  return DEFAULT_REPLY
}

/* ── Chatbot panel ── */

interface ChatMessage {
  id: number
  type: 'bot' | 'user'
  text: string
  isPending?: boolean
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, type: 'bot', text: '¡Hola! ¿En qué puedo ayudarte hoy? Pregunta sobre ventas, caja, productos o configuración.' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = { id: Date.now(), type: 'user', text }
    const pendingId = Date.now() + 1
    const pendingMsg: ChatMessage = { id: pendingId, type: 'bot', text: 'Consultando...', isPending: true }

    setMessages(prev => [...prev, userMsg, pendingMsg])
    setInput('')
    setIsLoading(true)

    let botText = botReply(text)

    try {
      const ctrl = new AbortController()
      const timeoutId = setTimeout(() => ctrl.abort(), 8000)

      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text }),
        signal:  ctrl.signal,
      })
      clearTimeout(timeoutId)

      if (res.status === 403) {
        botText = 'Solo administradores pueden usar el asistente IA.'
      } else if (res.ok) {
        const data = await res.json() as { response?: string }
        botText = data.response ?? botReply(text)
      }
      // 5xx or other errors → keep local fallback already in botText
    } catch {
      // Network error or timeout → keep local fallback already in botText
    } finally {
      setIsLoading(false)
      setMessages(prev => prev.map(m =>
        m.id === pendingId ? { ...m, text: botText, isPending: false } : m
      ))
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className={styles.chatPanel} role="dialog" aria-label="Asistente virtual">
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderInfo}>
          <div className={styles.chatAvatar} aria-hidden="true">
            <MessageCircle size={16} />
          </div>
          <div>
            <p className={styles.chatName}>Asistente ActivoPOS</p>
            <p className={styles.chatStatus}>
              {isLoading ? 'Consultando IA...' : 'En línea · responde al instante'}
            </p>
          </div>
        </div>
        <button
          className={styles.chatClose}
          onClick={onClose}
          aria-label="Cerrar chat"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.chatMessages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.chatBubble} ${msg.type === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot}${msg.isPending ? ` ${styles.chatBubblePending}` : ''}`}
          >
            {msg.isPending && <span className={styles.chatSpinner} aria-hidden="true" />}
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.chatInputRow}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe tu pregunta..."
          className={styles.chatInput}
          aria-label="Escribe tu pregunta"
          disabled={isLoading}
        />
        <button
          className={styles.chatSendBtn}
          onClick={() => void send()}
          aria-label="Enviar"
          disabled={!input.trim() || isLoading}
        >
          <Send size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/* ── Main page ── */

function AyudaContent() {
  const { toast } = useToast()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [activeCard, setActiveCard] = useState<HelpCard | null>(null)

  const filteredCards = query.trim()
    ? HELP_CARDS.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.keywords.some((k) => k.includes(q))
        )
      })
    : HELP_CARDS

  const handleResetTour = useCallback(async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'DELETE' })
      if (res.ok) {
        router.push('/onboarding')
      } else {
        toast('Error al reiniciar el tour', 'error')
        setResetting(false)
      }
    } catch {
      toast('Error de conexión', 'error')
      setResetting(false)
    }
  }, [router, toast])

  return (
    <div className={`${styles.page} page-container`}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Centro de Ayuda</h1>
          <p className={styles.pageSubtitle}>
            Explora nuestras guías o contáctanos por WhatsApp.
          </p>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca artículos, cómo vender, cómo configurar..."
            className={styles.searchInput}
            aria-label="Buscar en el centro de ayuda"
          />
          {query && (
            <button
              className={styles.searchClear}
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Results count */}
        {query && (
          <p className={styles.resultsCount}>
            {filteredCards.length === 0
              ? 'Sin resultados para tu búsqueda.'
              : `${filteredCards.length} ${filteredCards.length === 1 ? 'resultado' : 'resultados'}`}
          </p>
        )}

        {/* Help grid */}
        {filteredCards.length > 0 ? (
          <div className={styles.helpGrid}>
            {filteredCards.map((card) => {
              const Icon = card.icon
              return (
                <button
                  key={card.title}
                  className={styles.helpCard}
                  tabIndex={0}
                  onClick={() => setActiveCard(card)}
                >
                  <div className={styles.helpIconWrap} aria-hidden="true">
                    <Icon size={20} />
                  </div>
                  <div className={styles.helpCardBody}>
                    <h3 className={styles.helpCardTitle}>{card.title}</h3>
                    <p className={styles.helpCardDesc}>{card.description}</p>
                  </div>
                  <ChevronRight size={14} className={styles.helpCardArrow} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        ) : (
          <div className={styles.noResults}>
            <p>¿No encontraste lo que buscas? Escríbenos por WhatsApp.</p>
          </div>
        )}

        {/* Contacts */}
        <div className={styles.contactSection}>
          <h2 className={styles.contactTitle}>Contactos y Accesos Rápidos</h2>
          <div className={styles.contactGrid}>
            <a
              href="https://wa.me/584243244788"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.contactCard}
            >
              <div className={styles.contactIconWrap} aria-hidden="true">
                <MessageCircle size={22} />
              </div>
              <div className={styles.contactInfo}>
                <p className={styles.contactCardTitle}>WhatsApp Soporte</p>
                <p className={styles.contactCardDesc}>Soporte técnico · Respuesta en minutos</p>
              </div>
              <ExternalLink size={14} className={styles.contactArrow} aria-hidden="true" />
            </a>

            <button
              className={styles.contactCard}
              onClick={handleResetTour}
              disabled={resetting}
            >
              <div className={`${styles.contactIconWrap} ${styles.contactIconReset}`} aria-hidden="true">
                <RotateCw size={22} />
              </div>
              <div className={styles.contactInfo}>
                <p className={styles.contactCardTitle}>Reiniciar Tour</p>
                <p className={styles.contactCardDesc}>Vuelve a ver la guía interactiva del sistema</p>
              </div>
              {resetting
                ? <span className={styles.loadingSpinner} aria-hidden="true" />
                : <ChevronRight size={14} className={styles.contactArrow} aria-hidden="true" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* Help modal */}
      <HelpModal card={activeCard} onClose={() => setActiveCard(null)} />

      {/* Floating chat bubble */}
      <button
        className={styles.chatBubbleBtn}
        onClick={() => setChatOpen((v) => !v)}
        aria-label={chatOpen ? 'Cerrar asistente' : 'Abrir asistente virtual'}
        aria-expanded={chatOpen}
      >
        {chatOpen
          ? <X size={22} aria-hidden="true" />
          : <MessageCircle size={22} aria-hidden="true" />
        }
      </button>

      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </div>
  )
}

export default function AyudaPage() {
  return (
    <ToastProvider>
      <AyudaContent />
    </ToastProvider>
  )
}
