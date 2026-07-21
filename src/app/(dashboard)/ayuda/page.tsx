'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
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
  FileText,
  ShoppingBag,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { HelpModal } from '@/components/help/HelpModal'
import { type HelpModule } from '@/lib/help-content'
import { botReplyAI, type BotRule } from '@/lib/ayuda-bot'
import styles from './ayuda.module.css'

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
    icon: FileText,
    title: 'Cotizaciones',
    description: 'Presupuestos con PDF, envío por WhatsApp y conversión a venta.',
    keywords: ['cotizacion', 'cotizaciones', 'presupuesto', 'pdf', 'item libre', 'convertir a venta'],
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
    icon: ShoppingBag,
    title: 'Pedidos',
    description: 'Kanban de pedidos del catálogo: recibido, preparando, listo, despachado.',
    keywords: ['pedido', 'pedidos', 'kanban', 'recibido', 'preparando', 'despachado', 'catalogo pedido'],
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
    icon: TrendingUp,
    title: 'Analytics',
    description: 'Pulso del negocio: comparativas, tendencias y mejor día de venta.',
    keywords: ['analytics', 'pulso', 'tendencia', 'comparativa', 'mejor dia', 'trimestre'],
  },
  {
    icon: Sparkles,
    title: 'Tu Día',
    description: 'Resumen diario generado con IA: ventas, producto estrella y cobros.',
    keywords: ['tu dia', 'resumen', 'ia', 'producto estrella', 'resumen diario'],
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
   Fuente única de contenido: los 17 títulos de HELP_CARDS mapean 1:1 a
   los 17 módulos de helpContent (src/lib/help-content.ts) — un solo
   componente de modal (components/help/HelpModal.tsx) para toda la app,
   sin versión local duplicada. */

const TITLE_TO_MODULE: Record<string, HelpModule> = {
  'Productos':        'productos',
  'Inventario':       'inventario',
  'Ventas (POS)':     'pos',
  'Cotizaciones':     'cotizaciones',
  'Devoluciones':     'devoluciones',
  'Clientes':         'clientes',
  'Reportes':         'reportes',
  'Analytics':        'analytics',
  'Tu Día':           'tu-dia',
  'Catálogo Digital': 'catalogo',
  'Pedidos':          'pedidos',
  'Gestión de Caja':  'caja',
  'Finanzas':         'finanzas',
  'Proveedores':      'proveedores',
  'Compras':          'compras',
  'Usuarios':         'usuarios',
  'Configuraciones':  'configuracion',
}

/* ── Chatbot local fallback ── */
// Fallback offline del asistente: si la IA no responde, botReplyAI matchea
// contra estas reglas. El matching vive en @/lib/ayuda-bot.

const BOT_RULES: BotRule[] = [
  { keywords: ['hola','buenos','buenas'], response: '¡Hola! Soy el asistente de ActivoPOS. Pregúntame sobre ventas, pagos, código de barras, BCV, variantes, catálogo, caja, inventario, clientes, finanzas, reportes, configuración o planes.' },

  // 0. Productos — sin esta regla, "producto"/"productos" no matcheaba nada
  // y caía en la keyword suelta 'pro' de Planes (substring de "producto") — respuesta incoherente.
  { keywords: ['producto','productos','nuevo producto','agregar producto','crear producto','precio de producto','costo del producto'], response: 'Para crear un producto: ve a Productos → "Nuevo Producto". Escribe el nombre, el precio en USD y el costo (para ver tu ganancia real). Elige si se vende por unidad o por peso, y activa variantes si tiene tallas o colores. Guarda — ya puedes venderlo desde el POS.' },

  // 1. POS — vender, pagos, descuentos, crédito
  { keywords: ['vender','venta','cobrar','pos','punto de venta','como vendo'], response: 'Para vender: abre la Caja primero, luego ve al Punto de Venta. Busca el producto por nombre, código o escáner. Ingresa la cantidad — el sistema calcula el total en USD y Bs. Elige el método de pago y cobra.' },
  { keywords: ['pago movil','zelle','usdt','zinli','binance','metodo de pago','metodos de pago','como pagan','efectivo'], response: 'ActivoPOS acepta Pago Móvil, Zelle, USDT, Efectivo y Zinli. Actívalos en Configuración → Métodos de pago. En el cobro puedes combinar más de uno en la misma venta (pago mixto).' },
  { keywords: ['descuento','rebaja','oferta'], response: 'Para aplicar un descuento: toca el precio del producto en el ticket antes de cobrar. Los descuentos grandes pueden requerir el PIN de un administrador, según cómo lo configures.' },
  { keywords: ['credito','fiado','a deber','cxc'], response: 'Para vender a crédito: en el POS selecciona "Crédito" como método de pago y elige el cliente (obligatorio registrarlo primero). La deuda queda en Finanzas → CxC. Para abonar: Clientes → selecciona el cliente → Registrar abono.' },

  // 2. Código de barras — cámara y pistola USB
  { keywords: ['escaner','escanear','camara','codigo de barra','barcode'], response: 'El escáner por cámara está en POS, Productos e Inventario — toca el ícono de escáner. También puedes escribir el código a mano: la búsqueda es instantánea desde 3 caracteres.' },
  { keywords: ['pistola','lector usb','lector de codigo','usb scanner'], response: 'Una pistola USB funciona sin configurar nada extra: al escanear, el código completo se vuelca al buscador y presiona Enter automáticamente — el producto se agrega solo. Funciona en POS y en el buscador de Productos.' },

  // 3. BCV
  { keywords: ['bcv','tasa','bolivar','bs','dolar','cuanto esta el dolar'], response: 'La tasa BCV se actualiza sola desde la fuente oficial. Cada venta usa la tasa vigente en el momento del cobro, así que el historial siempre queda exacto en Bs, sin que tengas que actualizar nada a mano.' },

  // 4. Variantes
  { keywords: ['talla','variante','color','tallas','zapato','ropa','combinacion'], response: 'Las variantes (talla, color o combinaciones) se activan en cada producto con el toggle "Tiene variantes". Cada variante lleva su propio stock — vender una talla no descuenta el stock de las demás.' },

  // 5. Catálogo digital
  { keywords: ['catalogo','tienda','qr','enlace','digital','pedido','pedidos'], response: 'El Catálogo Digital se activa en Configuración → Catálogo Digital. Comparte tu link o el código QR por WhatsApp — el cliente ve tus productos y hace el pedido, que llega directo al módulo Pedidos. El stock se sincroniza solo: si se agota, deja de aparecer disponible.' },

  // 6. Caja
  { keywords: ['caja','abrir caja','cerrar caja','arqueo','cuadre'], response: 'Abre la caja declarando el efectivo inicial. Todas las ventas del turno se registran solas. Al cerrar, cuenta el efectivo físico y compáralo con el sistema — cualquier diferencia queda registrada. Puedes exportar el reporte del día en PDF, con el resumen en USD y Bs.' },

  // 7. Inventario
  { keywords: ['inventario','stock','entrada','mercancia','ajuste','movimiento'], response: 'El stock baja solo cuando una venta queda Pagada. Para mercancía nueva usa "Entrada Manual". El badge rojo marca stock crítico según el mínimo que configures por producto. Cada movimiento (entrada, ajuste, venta) queda en el historial con fecha y usuario.' },

  // 8. Clientes
  { keywords: ['cliente','clientes','directorio','deuda','historial de compras'], response: 'Registra clientes con nombre, teléfono y cédula o RIF — es obligatorio para venderles a crédito. Cada ficha muestra su historial de compras y lo que debe. Filtra por "Con deuda" para ver a quién cobrar.' },

  // 9. Finanzas — 'compra'/'compras' se movió a su propia regla (9b): competía
  // mal contra la pregunta real "cómo registro una compra a proveedor".
  { keywords: ['finanzas','gasto','gastos','utilidad','ganancia'], response: 'En Finanzas registras gastos (luz, alquiler, empleados) y ves tu utilidad real: ventas menos costos y gastos del período. Exporta el detalle en Excel para tu contador.' },

  // 9b. Compras a proveedor
  { keywords: ['compra','compras','nueva compra','proveedor'], response: 'Para registrar una compra: ve a Proveedores → pestaña Compras → "Nueva Compra". Elige el proveedor y agrega los productos con cantidad y costo. Marca "Recibida" si ya tienes la mercancía (tu stock sube automático) o "Pendiente" si quedaste a deber (aparece en Finanzas → Cuentas por Pagar).' },

  // 10. Reportes
  { keywords: ['reporte','reportes','ventas del dia','cuanto vendi','exportar'], response: 'En Reportes eliges el período (hoy, semana, mes o rango personalizado) y ves el total por método de pago y por producto. Puedes exportar a Excel o PDF.' },

  // 11. Configuración
  { keywords: ['configuracion','logo','modulos','usuario','usuarios','cajero','pin','contraseña'], response: 'En Configuración editas el logo y datos del negocio, activas métodos de pago, activas o desactivas módulos según tu plan, y agregas usuarios. Los cajeros usan un PIN de 4 dígitos para autorizar descuentos; solo ven el POS, mientras que el administrador tiene acceso completo.' },

  // 12. Planes — 'precio'/'cuanto cuesta'/'pro' sueltos se sacaron: 'pro' es
  // substring de "producto"/"proveedor" (match falso constante) y 'precio' sin
  // calificar competía con preguntas de precio de producto (regla 0).
  { keywords: ['plan','planes','cuanto cuesta activopos','cuanto cuesta el sistema','precio del plan','plan gratis','plan negocio activo','upgrade','mejorar plan'], response: 'Hay dos planes: Gratis (permanente, sin tarjeta — hasta 40 productos y 1 usuario, POS e inventario) y Negocio Activo ($19/mes — productos ilimitados, hasta 10 usuarios, catálogo digital, finanzas, proveedores y todo el sistema). Puedes mejorar tu plan desde Configuración.' },

  // 13. Preguntas frecuentes venezolanas
  { keywords: ['seniat','factura fiscal','factura legal'], response: 'ActivoPOS no reemplaza tu facturación fiscal ante el SENIAT — la complementa. Los tickets que genera son comprobantes de venta para tu control interno, no facturas fiscales.' },
  { keywords: ['tasa paralela','dolar paralelo','dolar negro'], response: 'ActivoPOS usa la tasa oficial del BCV, no la tasa paralela. Si tu negocio maneja otra tasa de referencia, puedes ajustarla manualmente en Configuración.' },

  { keywords: ['notificacion','notificaciones','alerta'], response: 'Las notificaciones aparecen en la campana del header: pedidos nuevos del catálogo, stock crítico y CxC vencidas. Puedes marcarlas todas como leídas.' },
  { keywords: ['kds','cocina','kitchen','pantalla cocina'], response: 'El KDS (Kitchen Display System) es una pantalla para cocina o despacho que muestra los pedidos en tiempo real. Se activa en Configuración → Módulos Opcionales. Ideal para restaurantes y cafeterías.' },
  { keywords: ['ticket','imprimir','impresora','termica','58mm'], response: 'ActivoPOS genera tickets térmicos para impresoras de 58mm. Después de cada cobro, toca "Imprimir ticket".' },
  { keywords: ['pwa','instalar','app','movil','celular'], response: 'ActivoPOS funciona como app en tu celular. En Chrome, toca el menú → "Instalar app" o "Agregar a pantalla de inicio". No necesitas descargarlo de ninguna tienda de apps.' },

  // 14. Cotizaciones — sin cobertura previa
  { keywords: ['cotizacion','cotizaciones','cotizar','presupuesto'], response: 'En Cotizaciones creas una propuesta con el mismo editor del POS, puedes agregar ítems libres que no están en tu catálogo, y descargar el PDF o enviarlo por WhatsApp. Cuando el cliente acepta, "Convertir a venta" abre el POS con todo precargado para cobrar.' },

  // 15. Devoluciones — sin cobertura previa
  { keywords: ['devolucion','devoluciones','devolver','reintegro'], response: 'En Devoluciones busca el ticket, selecciona los ítems que se devuelven (no tiene que ser la venta completa) y confirma con un motivo. Puedes elegir si el stock se restaura o no. Solo administradores pueden aprobar devoluciones.' },

  // 16. Analytics / Pulso del negocio — sin cobertura previa
  { keywords: ['analytics','pulso del negocio','tendencia','comparativa','mejor dia'], response: 'Analytics (Pulso del Negocio) compara tus ventas por Semana, Mes o Trimestre contra el período anterior, muestra qué productos están subiendo o bajando y cuál es tu mejor día de la semana.' },

  // 17. Tu Día — sin cobertura previa
  { keywords: ['tu dia','resumen del dia','resumen diario'], response: 'Tu Día te da un resumen narrativo generado con IA de cómo va tu negocio hoy: ventas vs ayer, tu producto estrella del mes y alertas de cobros pendientes. Se actualiza cada 2 horas.' },

  // 18. Métodos de cobro — sin cobertura previa como tema propio
  { keywords: ['datos de cobro','como me pagan','configurar pago movil','configurar zelle'], response: 'Configura tus datos de cobro en Configuración → Métodos de pago: banco, teléfono, cédula y titular para Pago Móvil; email y titular para Zelle; wallet o ID para Binance/USDT. Esos datos se reutilizan automáticamente en Pedidos, Cotizaciones y Clientes.' },

  // 19. Importación Excel — sin cobertura previa
  { keywords: ['importar excel','importacion masiva','plantilla excel','migracion'], response: 'En Productos usa el botón Migración para importar productos masivamente desde Excel — descarga la plantilla primero si es tu primera vez. También puedes exportar tu catálogo completo a Excel desde el mismo botón.' },

  // 20. Variantes combinadas — sin cobertura previa
  { keywords: ['combinacion de variantes','generador de variantes','talla y color','sabor y tamaño'], response: 'Cuando un producto tiene más de un tipo de variante (ej. talla + color, o sabor + tamaño), el generador automático crea todas las combinaciones posibles y les asigna stock individual — no tienes que crearlas una por una.' },

  // 21. Venta por peso — sin cobertura previa como tema propio
  { keywords: ['venta por peso','vender por kilo','producto por peso','kilogramos'], response: 'Para vender por peso, marca el producto como tipo "Peso" al crearlo. En el POS, en vez de cantidad entera, ingresas los kilos con decimales — útil para carnicería, víveres o charcutería.' },
]

/* ── Chatbot panel ── */

interface ChatMessage {
  id: number
  type: 'bot' | 'user'
  text: string
  isPending?: boolean
  source?: 'ai' | 'fallback'
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

    // botReplyAI nunca lanza: ante timeout, 5xx o red caída devuelve el match
    // contra BOT_RULES, así que la ayuda siempre responde algo útil.
    const answer = await botReplyAI(text, BOT_RULES)

    setIsLoading(false)
    setMessages(prev => prev.map(m =>
      m.id === pendingId ? { ...m, text: answer.text, isPending: false, source: answer.source } : m
    ))
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
            {msg.type === 'bot' && msg.source && (
              <span className={styles.chatSourceTag}>
                {msg.source === 'ai' ? 'IA' : 'Rápida'}
              </span>
            )}
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
      <AnimatePresence>
        {activeCard && (
          <HelpModal
            module={TITLE_TO_MODULE[activeCard.title]}
            onClose={() => setActiveCard(null)}
          />
        )}
      </AnimatePresence>

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
