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
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { HelpModal } from '@/components/help/HelpModal'
import { type HelpModule } from '@/lib/help-content'
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
   Fuente única de contenido: los 13 títulos de HELP_CARDS mapean 1:1 a
   los 13 módulos de helpContent (src/lib/help-content.ts) — un solo
   componente de modal (components/help/HelpModal.tsx) para toda la app,
   sin versión local duplicada. */

const TITLE_TO_MODULE: Record<string, HelpModule> = {
  'Productos':        'productos',
  'Inventario':       'inventario',
  'Ventas (POS)':     'pos',
  'Devoluciones':     'devoluciones',
  'Clientes':         'clientes',
  'Reportes':         'reportes',
  'Catálogo Digital': 'catalogo',
  'Gestión de Caja':  'caja',
  'Finanzas':         'finanzas',
  'Proveedores':      'proveedores',
  'Compras':          'compras',
  'Usuarios':         'usuarios',
  'Configuraciones':  'configuracion',
}

/* ── Chatbot local fallback ── */

interface BotRule { keywords: string[]; response: string }

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
  { keywords: ['plan','planes','cuanto cuesta activopos','cuanto cuesta el sistema','precio del plan','plan mostrador','plan negocio','plan pro','upgrade','mejorar plan'], response: 'Hay tres planes: Mostrador (POS básico, hasta 100 productos y 3 usuarios), Negocio (agrega Catálogo Digital, hasta 500 productos y 10 usuarios) y Pro (todo ilimitado + asistente IA). Puedes mejorar tu plan desde Configuración.' },

  // 13. Preguntas frecuentes venezolanas
  { keywords: ['seniat','factura fiscal','factura legal'], response: 'ActivoPOS no reemplaza tu facturación fiscal ante el SENIAT — la complementa. Los tickets que genera son comprobantes de venta para tu control interno, no facturas fiscales.' },
  { keywords: ['tasa paralela','dolar paralelo','dolar negro'], response: 'ActivoPOS usa la tasa oficial del BCV, no la tasa paralela. Si tu negocio maneja otra tasa de referencia, puedes ajustarla manualmente en Configuración.' },

  { keywords: ['notificacion','notificaciones','alerta'], response: 'Las notificaciones aparecen en la campana del header: pedidos nuevos del catálogo, stock crítico y CxC vencidas. Puedes marcarlas todas como leídas.' },
  { keywords: ['kds','cocina','kitchen','pantalla cocina'], response: 'El KDS (Kitchen Display System) es una pantalla para cocina o despacho que muestra los pedidos en tiempo real. Se activa en Configuración → Módulos Opcionales. Ideal para restaurantes y cafeterías.' },
  { keywords: ['ticket','imprimir','impresora','termica','58mm'], response: 'ActivoPOS genera tickets térmicos para impresoras de 58mm. Después de cada cobro, toca "Imprimir ticket".' },
  { keywords: ['pwa','instalar','app','movil','celular'], response: 'ActivoPOS funciona como app en tu celular. En Chrome, toca el menú → "Instalar app" o "Agregar a pantalla de inicio". No necesitas descargarlo de ninguna tienda de apps.' },
]

const DEFAULT_REPLY = 'No encontré información sobre eso. Puedes preguntarme sobre: ventas, métodos de pago, código de barras, BCV, variantes, catálogo digital, caja, inventario, clientes, finanzas, reportes, configuración o planes.'

function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// L\u00edmite de palabra (\b) \u2014 antes era substring plano, por eso 'pro' (Planes)
// matcheaba dentro de "producto"/"proveedor". Con \b, un keyword corto que
// es prefijo de una palabra m\u00e1s larga en la query (ej. 'cliente' dentro de
// "clientes") tampoco matchea \u2014 como efecto secundario, ya no infla el score
// contando singular Y plural de la misma idea por separado.
function keywordMatches(query: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegex(normalizeText(keyword))}\\b`).test(query)
}

function botReply(text: string): string {
  const q = normalizeText(text)
  let bestScore = 0
  let bestRules: BotRule[] = []

  for (const rule of BOT_RULES) {
    const matched = rule.keywords.filter(k => keywordMatches(q, k))
    if (matched.length === 0) continue

    // Defensa extra: si una keyword matcheada es substring de otra keyword
    // matcheada de la MISMA regla, se cuenta solo la m\u00e1s larga (cubre casos
    // que \b no deduplica, ej. 'ropa' y una futura 'ropa deportiva').
    const deduped = matched.filter(k =>
      !matched.some(other => other !== k && other.includes(k) && other.length > k.length)
    )

    // Score = suma de longitud de las keywords matcheadas, no cantidad \u2014
    // favorece matches largos/espec\u00edficos ("metodos de pago") sobre
    // coincidencias cortas gen\u00e9ricas, y es el desempate real entre reglas
    // (antes: primera regla del array ganaba siempre en empate).
    const score = deduped.reduce((sum, k) => sum + k.length, 0)

    if (score > bestScore) {
      bestScore = score
      bestRules = [rule]
    } else if (score === bestScore && score > 0) {
      bestRules.push(rule)
    }
  }

  if (bestRules.length === 0) return DEFAULT_REPLY
  // Empate real entre 2+ t\u00f3picos igual de espec\u00edficos \u2014 se mencionan ambos
  // en vez de descartar arbitrariamente al que aparece primero en el array.
  return bestRules.map(r => r.response).join('\n\n')
}

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

    let botText = botReply(text)
    let source: ChatMessage['source'] = 'fallback'
    let isPermissionMsg = false

    try {
      const ctrl = new AbortController()
      // 12s (antes 8s) — Haiku con contexto de negocio a veces pasaba de 8s y caía a fallback de más
      const timeoutId = setTimeout(() => ctrl.abort(), 12000)

      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text }),
        signal:  ctrl.signal,
      })
      clearTimeout(timeoutId)

      if (res.status === 403) {
        botText = 'Solo administradores pueden usar el asistente IA.'
        isPermissionMsg = true
      } else if (res.ok) {
        const data = await res.json() as { response?: string }
        if (data.response) { botText = data.response; source = 'ai' }
      }
      // 5xx or other errors → keep local fallback already in botText
    } catch {
      // Network error or timeout → keep local fallback already in botText
    } finally {
      setIsLoading(false)
      setMessages(prev => prev.map(m =>
        m.id === pendingId ? { ...m, text: botText, isPending: false, source: isPermissionMsg ? undefined : source } : m
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
