// src/lib/social/carousel-layouts.ts
//
// 6 layouts nuevos de carrusel, traducidos desde diseños reales aprobados por
// Carlos en Claude Design. Reemplazan progresivamente los 6 SlideGeometry
// abstractos de slide-template.ts (Sprint 118) -- viven aislados aquí hasta
// certificación visual, antes de tocar carrusel.ts.

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Marco compartido ─────────────────────────────────────────────────────

interface GhostNumberStyle {
  top:            string
  left:           string
  transform?:     string
  fontSize:       string
  letterSpacing:  string
}

const DEFAULT_GHOST_STYLE: GhostNumberStyle = {
  top: '36px', left: '50%', transform: 'translateX(-50%)',
  fontSize: '900px', letterSpacing: '-30px',
}

// foto-lateral usa un ghost number más chico, esquina superior izquierda --
// distinto a los otros 5, que lo centran arriba a tamaño completo.
const FOTO_LATERAL_GHOST_STYLE: GhostNumberStyle = {
  top: '36px', left: '36px', transform: undefined,
  fontSize: '640px', letterSpacing: '-20px',
}

const CHROME_ACCENT_DEFAULT = '#4D7AFF' // ámbar retirado del chrome decorativo -- solo queda en cta-precio

export type FrameVariant = 'dark' | 'light'

// 'dark' reproduce exactamente el chrome de los 6 layouts originales.
// 'light' existe para constelacion-puntos (testimonio), que pinta texto oscuro:
// además de los 3 selectores de texto hay que invertir el fondo del .frame y el
// trazo del ghost number, si no el layout queda ilegible (blanco sobre azul).
const FRAME_VARIANTS: Record<FrameVariant, {
  background:   string
  ghostStroke:  string
  eyebrowText:  string
  logoText:     string
  badgeBg:      string
  badgeBorder:  string
  badgeCurrent: string
  badgeTotal:   string
}> = {
  dark: {
    background:   'linear-gradient(160deg, #0038BD 0%, #002FA0 55%, #001D7A 100%)',
    ghostStroke:  'rgba(255,255,255,0.16)',
    eyebrowText:  '#DCE6FF',
    logoText:     '#FFFFFF',
    badgeBg:      'rgba(255,255,255,0.12)',
    badgeBorder:  'rgba(255,255,255,0.25)',
    badgeCurrent: '#FFFFFF',
    badgeTotal:   '#DCE6FF',
  },
  light: {
    background:   '#DCE6FF',
    ghostStroke:  'rgba(0,56,189,0.14)',
    eyebrowText:  '#0038BD',
    logoText:     '#0D1B2E',
    badgeBg:      'rgba(0,56,189,0.08)',
    badgeBorder:  'rgba(0,56,189,0.22)',
    badgeCurrent: '#0038BD',
    badgeTotal:   '#3B4A63',
  },
}

interface SlideFrameParams {
  ghostNumber:   number
  eyebrowText:   string
  accentColor:   string   // solo se usa de verdad si isCtaSlide=true
  isCtaSlide?:   boolean
  slideNumber:   number
  totalSlides:   number
  contentHtml:   string
  logoSvg:       string          // isotipo negativo, viene de LOGO_SVG de carrusel.ts
  ghostStyle?:   GhostNumberStyle
  variant?:      FrameVariant   // default 'dark' -- preserva los 6 layouts originales
}

function buildSlideFrame(p: SlideFrameParams): string {
  const ghostNum = String(p.ghostNumber).padStart(2, '0')
  const gs = p.ghostStyle ?? DEFAULT_GHOST_STYLE
  const chromeAccent = p.isCtaSlide ? p.accentColor : CHROME_ACCENT_DEFAULT
  const v = FRAME_VARIANTS[p.variant ?? 'dark']

  return `<style>
    * { margin:0; padding:0; box-sizing:border-box; }
    .frame { position:relative; width:1080px; height:1350px;
      background:${v.background};
      overflow:hidden; font-family:'DM Sans', -apple-system, Helvetica, Arial, sans-serif; }
    .ghost-number { position:absolute; top:${gs.top}; left:${gs.left};
      ${gs.transform ? `transform:${gs.transform};` : ''}
      font-family:'Fraunces', Georgia, serif; font-weight:700; font-size:${gs.fontSize}; line-height:1;
      color:transparent; -webkit-text-stroke:3px ${v.ghostStroke}; letter-spacing:${gs.letterSpacing};
      user-select:none; pointer-events:none; z-index:0; }
    .eyebrow { position:absolute; top:96px; left:80px; right:80px; display:flex; align-items:center; gap:14px; z-index:1; }
    .eyebrow-bar { width:34px; height:3px; background:${chromeAccent}; }
    .eyebrow-text { font-size:22px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:${v.eyebrowText}; }
    .fr-bottom { position:absolute; left:80px; right:80px; bottom:76px; display:flex; align-items:center; justify-content:space-between; z-index:1; }
    .fr-logo { display:flex; align-items:center; gap:14px; }
    .fr-logo svg { width:32px; height:32px; flex:none; }
    .fr-logo-text { font-size:34px; font-weight:800; color:${v.logoText}; letter-spacing:-0.5px; }
    .fr-logo-text span { font-weight:400; color:#4D7AFF; }
    .fr-badge { display:flex; align-items:center; gap:10px; background:${v.badgeBg}; border:1px solid ${v.badgeBorder}; border-radius:999px; padding:14px 28px; }
    .fr-badge-current { font-size:26px; font-weight:700; color:${v.badgeCurrent}; }
    .fr-badge-total { font-size:26px; font-weight:500; color:${v.badgeTotal}; }
  </style>
  <div class="frame">
    <div class="ghost-number">${esc(ghostNum)}</div>
    <div class="eyebrow">
      <div class="eyebrow-bar"></div>
      <div class="eyebrow-text">${esc(p.eyebrowText)}</div>
    </div>
    ${p.contentHtml}
    <div class="fr-bottom">
      <div class="fr-logo">
        ${p.logoSvg}
        <div class="fr-logo-text">Activo<span>POS</span></div>
      </div>
      <div class="fr-badge">
        <span class="fr-badge-current">${p.slideNumber}</span>
        <span class="fr-badge-total">/ ${p.totalSlides}</span>
      </div>
    </div>
  </div>`
}

// ── Layout: ghost-hero / highlight-text (comparten contenido, difieren en segments) ──

export interface TitleSegment {
  text:       string
  highlight?: boolean
}

// Parte el titulo en [antes, resaltado, después] para el marcador de highlight-text.
// Vive acá y no en carrusel.ts porque opera sobre TitleSegment, que se define en
// este archivo. Si el highlight no aparece literal, devuelve el titulo sin resaltar.
export function splitTituloEnSegmentos(titulo: string, highlight: string): TitleSegment[] {
  const idx = titulo.indexOf(highlight)
  if (idx === -1) return [{ text: titulo }]
  const antes   = titulo.slice(0, idx)
  const despues = titulo.slice(idx + highlight.length)
  const segs: TitleSegment[] = []
  if (antes) segs.push({ text: antes })
  segs.push({ text: highlight, highlight: true })
  if (despues) segs.push({ text: despues })
  return segs
}

function renderTitleSegments(segments: TitleSegment[], accentColor: string, highlightTextColor: string): string {
  return segments.map(seg => {
    if (!seg.highlight) return esc(seg.text)
    return `<span style="position:relative; white-space:nowrap; display:inline-block;">
      <span style="position:absolute; left:-10px; right:-10px; top:14px; bottom:8px; background:${esc(accentColor)}; transform:rotate(-1.2deg); border-radius:6px; z-index:0;"></span>
      <span style="position:relative; z-index:1; color:${esc(highlightTextColor)};">${esc(seg.text)}</span>
    </span>`
  }).join(' ')
}

export function buildTituloSubtituloContent(
  tituloSegments: TitleSegment[],
  subtitulo: string,
  accentColor: string,
  highlightTextColor = '#FFFFFF',
): string {
  const titleHtml = renderTitleSegments(tituloSegments, accentColor, highlightTextColor)
  return `<div style="position:absolute; left:80px; right:80px; top:480px; z-index:1;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:98px; line-height:1.1; color:#FFFFFF; letter-spacing:-1px;">${titleHtml}</h1>
    <p style="margin:36px 0 0 0; font-size:36px; line-height:1.4; color:#DCE6FF; font-weight:500; max-width:820px;">${esc(subtitulo)}</p>
  </div>`
}

// ── Layout: chat-bubble ──

export interface ChatBubbleContent {
  titulo:         string
  clienteTexto:   string
  clienteHora:    string
  respuestaTexto: string
}

// Rangos de code point equivalentes en la práctica a \p{Extended_Pictographic}.
// Sin regex con flag /u: el tsconfig no fija `target` y tsc la rechaza (TS1501).
const EMOJI_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1F300, 0x1FAFF], // pictogramas, emoticones y símbolos suplementarios
  [0x1F000, 0x1F2FF], // fichas, cartas y alfanuméricos encerrados
  [0x2600,  0x27BF],  // símbolos misceláneos + dingbats
  [0x2B00,  0x2BFF],  // símbolos y flechas misceláneos
  [0xFE00,  0xFE0F],  // selectores de variación (VS15/VS16)
  [0x200D,  0x200D],  // ZWJ que une secuencias compuestas
]

function isEmojiCodePoint(cp: number): boolean {
  return EMOJI_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)
}

function stripEmoji(text: string): string {
  // Array.from itera por code point, no por unidad UTF-16: los emojis del plano
  // suplementario (surrogate pair) llegan enteros a codePointAt y se filtran de una.
  return Array.from(text)
    .filter(ch => {
      const cp = ch.codePointAt(0)
      return cp === undefined || !isEmojiCodePoint(cp)
    })
    .join('')
    .trim()
}

export function buildChatBubbleContent(c: ChatBubbleContent): string {
  const clienteTexto = stripEmoji(c.clienteTexto)
  return `<div style="position:absolute; left:80px; right:80px; top:300px; z-index:1;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:80px; line-height:1.06; color:#FFFFFF; letter-spacing:-1px; max-width:820px;">${esc(c.titulo)}</h1>
  </div>
  <div style="position:absolute; left:80px; top:590px; max-width:640px; background:#FFFFFF; border-radius:28px 28px 28px 6px; padding:36px 40px; box-shadow:0 24px 60px rgba(0,15,60,0.35); z-index:1;">
    <p style="margin:0; font-size:34px; line-height:1.4; color:#0D1B2E; font-weight:500;">${esc(clienteTexto)}</p>
    <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:18px;">
      <span style="font-size:22px; color:#8A93A6;">${esc(c.clienteHora)}</span>
      <svg width="26" height="16" viewBox="0 0 26 16" fill="none">
        <path d="M1 8L6 13L15 3" stroke="#16A34A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 8L15 13L24 3" stroke="#16A34A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
  <div style="position:absolute; right:80px; top:800px; max-width:520px; background:#0038BD; border-radius:28px 28px 6px 28px; padding:30px 36px; z-index:1;">
    <p style="margin:0; font-size:30px; line-height:1.4; color:#FFFFFF; font-weight:500;">${esc(c.respuestaTexto)} &#10003;</p>
  </div>`
}

// ── Layout: checklist ──

export interface ChecklistContent {
  titulo: string
  items:  string[]
}

const CHECKLIST_SCALE: Record<number, { fontSize: number; padding: string; gap: number }> = {
  3: { fontSize: 40, padding: '34px 40px', gap: 32 },
  4: { fontSize: 36, padding: '30px 36px', gap: 28 },
  5: { fontSize: 31, padding: '24px 32px', gap: 20 },
  6: { fontSize: 27, padding: '20px 28px', gap: 14 },
}
const CHECKLIST_HARD_CAP = 6

export function buildChecklistContent(c: ChecklistContent): string {
  const items = c.items.slice(0, CHECKLIST_HARD_CAP)
  if (c.items.length > CHECKLIST_HARD_CAP) {
    console.warn(`checklist: recibidos ${c.items.length} ítems, truncado a ${CHECKLIST_HARD_CAP}`)
  }
  const n = Math.max(3, items.length)
  const scale = CHECKLIST_SCALE[n] ?? CHECKLIST_SCALE[6]
  const checkIcon = `<svg width="30" height="24" viewBox="0 0 30 24" fill="none"><path d="M2 12L11 21L28 2" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

  const itemsHtml = items.map(text => `
    <div style="display:flex; align-items:center; gap:${scale.gap}px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); border-radius:20px; padding:${scale.padding};">
      <div style="flex:none; width:${scale.fontSize + 28}px; height:${scale.fontSize + 28}px; border-radius:50%; background:#16A34A; display:flex; align-items:center; justify-content:center;">
        ${checkIcon}
      </div>
      <div style="font-size:${scale.fontSize}px; font-weight:600; color:#FFFFFF;">${esc(text)}</div>
    </div>`).join('')

  return `<div style="position:absolute; left:80px; right:80px; top:250px; z-index:1;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:78px; line-height:1.08; color:#FFFFFF; letter-spacing:-1px; max-width:820px;">${esc(c.titulo)}</h1>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:560px; display:flex; flex-direction:column; gap:${scale.gap}px; z-index:1;">
    ${itemsHtml}
  </div>`
}

// ── Layout: cta-precio ──

export interface CtaPrecioContent {
  tituloPre:    string
  tituloAccent: string
  tituloPost:   string
  subtitulo:    string
  planNombre:   string
  precioUsd:    number  // DEBE venir de @/lib/plan-limits BILLING_CYCLES -- nunca hardcodeado
  ctaLabel:     string
}

export function buildCtaPrecioContent(c: CtaPrecioContent): string {
  return `<div style="position:absolute; left:80px; right:80px; top:330px; z-index:1;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:84px; line-height:1.08; color:#FFFFFF; letter-spacing:-1px; max-width:860px;">${esc(c.tituloPre)}<span style="font-style:italic; font-weight:600; color:#EF8E01;">${esc(c.tituloAccent)}</span>${esc(c.tituloPost)}</h1>
    <p style="margin:32px 0 0 0; font-size:34px; line-height:1.4; color:#DCE6FF; font-weight:500; max-width:760px;">${esc(c.subtitulo)}</p>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:760px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); border-radius:24px; padding:44px 48px; display:flex; align-items:baseline; justify-content:space-between; z-index:1;">
    <div>
      <div style="font-size:24px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#DCE6FF;">${esc(c.planNombre)}</div>
      <div style="margin-top:14px; display:flex; align-items:baseline; gap:10px;">
        <span style="font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:88px; color:#FFFFFF;">$${c.precioUsd}</span>
        <span style="font-size:30px; font-weight:600; color:#DCE6FF;">/ mes</span>
      </div>
    </div>
    <div style="background:#EF8E01; color:#0D1B2E; font-size:22px; font-weight:800; padding:12px 22px; border-radius:999px;">Todo incluido</div>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:1010px; display:flex; z-index:1;">
    <div style="background:#EF8E01; color:#0D1B2E; font-size:38px; font-weight:800; padding:28px 56px; border-radius:16px; box-shadow:0 20px 40px rgba(239,142,1,0.35);">${esc(c.ctaLabel)} &rarr;</div>
  </div>`
}

// ── Layout: foto-lateral ──

export interface FotoLateralContent {
  titulo:    string
  subtitulo: string
  statLabel: string
  statValor: string  // ilustrativo por defecto -- dato real requiere query aparte, no incluida aquí
  fotoUrl:   string  // URL de Cloudinary YA resuelta server-side antes de llamar esta función
}

export function buildFotoLateralContent(c: FotoLateralContent): string {
  return `<div style="position:absolute; left:0; top:220px; width:486px; height:700px; z-index:1;">
    <img src="${esc(c.fotoUrl)}" style="width:100%; height:100%; object-fit:cover; border-radius:0 24px 24px 0;">
  </div>
  <div style="position:absolute; left:526px; right:80px; top:260px; z-index:1;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:64px; line-height:1.08; color:#FFFFFF; letter-spacing:-1px;">${esc(c.titulo)}</h1>
    <p style="margin:28px 0 0 0; font-size:30px; line-height:1.45; color:#DCE6FF; font-weight:500;">${esc(c.subtitulo)}</p>
    <div style="margin-top:44px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); border-radius:18px; padding:26px 30px;">
      <div style="font-size:22px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#DCE6FF;">${esc(c.statLabel)}</div>
      <div style="margin-top:8px; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:52px; color:#FFFFFF;">${esc(c.statValor)}</div>
    </div>
  </div>`
}

// ── Layout 7: curva-corte ──

export interface CurvaCorteContent {
  titulo:      string
  subtitulo:   string
  statLabel:   string   // ej. "Tu día · hoy"
  statValor:   string   // ilustrativo por defecto -- MISMA duda pendiente que foto-lateral
  statValorBs: string
  statNota:    string   // ej. "32 ventas registradas"
}

export function buildCurvaCorteContent(c: CurvaCorteContent): string {
  const checkIcon = `<svg width="26" height="20" viewBox="0 0 26 20" fill="none"><path d="M2 10L9 17L24 2" stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  return `
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" style="position:absolute; top:0; left:0; z-index:0;">
    <path d="M0,0 H1080 V820 C 760,960 320,700 0,880 Z" fill="#0038BD"/>
    <path d="M0,0 H1080 V760 C 780,880 340,640 0,800 Z" fill="#4D7AFF" opacity="0.35"/>
  </svg>
  <div style="position:absolute; left:80px; right:80px; top:230px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:82px; line-height:1.08; color:#FFFFFF; letter-spacing:-1px; max-width:820px;">${esc(c.titulo)}</h1>
    <p style="margin:28px 0 0 0; font-size:32px; line-height:1.4; color:#DCE6FF; font-weight:500; max-width:700px;">${esc(c.subtitulo)}</p>
  </div>
  <div style="position:absolute; left:120px; top:780px; width:520px; background:#FFFFFF; border-radius:20px; padding:36px 40px; transform:rotate(-4deg); box-shadow:0 30px 70px rgba(0,10,40,0.4); z-index:2;">
    <div style="font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#4D7AFF;">${esc(c.statLabel)}</div>
    <div style="margin-top:22px; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:56px; color:#0038BD;">${esc(c.statValor)}</div>
    <div style="margin-top:16px; font-size:22px; color:#8A93A6;">${esc(c.statValorBs)} &middot; tasa BCV</div>
    <div style="margin-top:24px; border-top:2px dashed #DCE6FF; padding-top:16px; display:flex; align-items:center; gap:10px;">
      ${checkIcon}<span style="font-size:22px; color:#0D1B2E; font-weight:600;">${esc(c.statNota)}</span>
    </div>
  </div>
  <div style="position:absolute; right:130px; top:1030px; width:22px; height:22px; border-radius:50%; background:#EF8E01; z-index:2;"></div>`
}

// ── Layout 8: split-diagonal (variante de cta-precio) ──

export interface SplitDiagonalContent {
  titulo:      string
  planNombre:  string
  precioUsd:   number   // BILLING_CYCLES, igual que cta-precio -- NUNCA hardcodear
  ctaLabel:    string
}

export function buildSplitDiagonalContent(c: SplitDiagonalContent): string {
  return `
  <div style="position:absolute; left:0; top:0; width:1080px; height:1350px; background:#0D1B2E; clip-path:polygon(0 0, 62% 0, 38% 100%, 0 100%); z-index:0;"></div>
  <div style="position:absolute; left:80px; top:280px; width:440px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:56px; line-height:1.1; color:#FFFFFF; letter-spacing:-1px;">${esc(c.titulo)}</h1>
  </div>
  <div style="position:absolute; right:70px; top:620px; width:460px; background:#FFFFFF; border-radius:20px; padding:36px 40px; transform:rotate(3deg); box-shadow:0 30px 70px rgba(0,10,40,0.4); z-index:2;">
    <div style="font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#4D7AFF;">${esc(c.planNombre)}</div>
    <div style="margin-top:20px; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:72px; color:#0038BD;">$${c.precioUsd}<span style="font-size:28px; color:#8A93A6; font-family:'DM Sans',sans-serif; font-weight:600;">/mes</span></div>
    <div style="margin-top:22px; background:#EF8E01; color:#0D1B2E; font-size:24px; font-weight:800; padding:16px 0; border-radius:12px; text-align:center;">${esc(c.ctaLabel)}</div>
  </div>`
}

// ── Layout 9: constelacion-puntos (testimonio, fondo claro) ──
// Requiere buildSlideFrame({ variant: 'light' }) -- con el frame 'dark' el texto
// oscuro de la cita queda ilegible sobre el degradado azul.

export interface TestimonioContent {
  citaSegments:   TitleSegment[]  // reusa renderTitleSegments -- resalta la frase clave de la cita
  autorNombre:    string          // OBLIGATORIO, sin default -- debe ser cliente real que autorizó
  autorNegocio:   string          // OBLIGATORIO, sin default
}

export function buildTestimonioContent(c: TestimonioContent): string {
  if (!c.autorNombre || !c.autorNegocio) {
    throw new Error('buildTestimonioContent: autorNombre/autorNegocio obligatorios -- no se publica testimonio sin atribución real')
  }
  const citaHtml = renderTitleSegments(c.citaSegments, '#EF8E01', '#0D1B2E')
  return `
  <svg width="1080" height="1350" style="position:absolute; top:0; left:0; z-index:0;">
    <circle cx="150" cy="180" r="7" fill="#4D7AFF" opacity="0.5"/>
    <circle cx="900" cy="220" r="9" fill="#4D7AFF" opacity="0.45"/>
    <circle cx="1000" cy="1230" r="16" fill="#EF8E01"/>
  </svg>
  <div style="position:absolute; left:80px; right:80px; top:520px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:76px; line-height:1.15; color:#0D1B2E; letter-spacing:-1px;">&ldquo;${citaHtml}&rdquo;</h1>
    <p style="margin:32px 0 0 0; font-size:30px; color:#3B4A63; font-weight:600;">${esc(c.autorNombre)} &middot; ${esc(c.autorNegocio)}</p>
  </div>`
}

// ── Layout 10: silueta-recibo ──

export interface SiluetaReciboContent {
  titulo: string
  items:  string[]   // reusa la misma lógica de escalado que checklist si quieres, aquí fijo a 3
}

export function buildSiluetaReciboContent(c: SiluetaReciboContent): string {
  const checkIcon = `<svg width="26" height="20" viewBox="0 0 26 20" fill="none"><path d="M2 10L9 17L24 2" stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  const items = c.items.slice(0, 3)
  const itemsHtml = items.map((text, i) => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:26px 40px; ${i < items.length - 1 ? 'border-bottom:1px dashed rgba(255,255,255,0.25);' : ''}">
      <div style="font-size:32px; font-weight:600; color:#FFFFFF;">${esc(text)}</div>
      ${checkIcon}
    </div>`).join('')
  return `
  <svg width="900" height="1240" style="position:absolute; right:-80px; top:60px; opacity:0.14; z-index:0;">
    <path d="M120 0 H620 V1140 L580 1180 L540 1140 L500 1180 L460 1140 L420 1180 L380 1140 L340 1180 L300 1140 L260 1180 L220 1140 L180 1180 L140 1140 L120 1180 Z" fill="none" stroke="#FFFFFF" stroke-width="4"/>
    <line x1="180" y1="140" x2="560" y2="140" stroke="#FFFFFF" stroke-width="4"/>
    <line x1="180" y1="220" x2="560" y2="220" stroke="#FFFFFF" stroke-width="4"/>
  </svg>
  <div style="position:absolute; left:80px; right:80px; top:250px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:72px; line-height:1.1; color:#FFFFFF; letter-spacing:-1px; max-width:800px;">${esc(c.titulo)}</h1>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:560px; z-index:2; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); border-radius:16px; padding:12px 0;">
    ${itemsHtml}
  </div>`
}

// ── Familia BICOLOR ──────────────────────────────────────────────────────────
// Namespace propio: bicolor no se elige por rol de slide como SlideLayout, es un
// modo completo del carrusel. Mezclarlos en el mismo union invitaría a que
// pickLayoutForRole devolviera un layout bicolor por accidente.

export type BicolorLayout = 'movimiento' | 'oferta' | 'testimonio' | 'stat' | 'checklist' | 'cta'

interface BicolorFrameParams {
  bgColor:        string
  categoryLabel:  string
  textColorMuted: string
  logoTextColor:  string
  logoAccent:     string
  badgeBg:        string
  badgeBorder:    string
  badgeTextColor: string
  badgeMutedColor: string
  slideNumber:    number
  totalSlides:    number
  contentHtml:    string
  decorSvg:       string
  logoSvg:        string   // igual que buildSlideFrame: este módulo no lee del disco
  logoDotOverride?: string // color del punto central del isotipo, para fondos ámbar
}

// El isotipo negativo trae el punto central en #EF8E01, que desaparece sobre el
// fondo ámbar. Se compone un <circle> encima en las mismas coordenadas del SVG
// fuente (cx/cy 250, r 72 en viewBox 0 0 500 500) en vez de editar el asset.
function applyLogoDotOverride(logoSvg: string, color?: string): string {
  if (!color) return logoSvg
  return logoSvg.replace(/<\/svg>\s*$/, `<circle fill="${color}" cx="250" cy="250" r="72"/></svg>`)
}

export function buildBicolorFrame(p: BicolorFrameParams): string {
  const logoHtml = applyLogoDotOverride(p.logoSvg, p.logoDotOverride)
  return `<style>
    * { margin:0; padding:0; box-sizing:border-box; }
    .bc-frame { position:relative; width:1080px; height:1350px; background:${p.bgColor};
      overflow:hidden; font-family:'DM Sans', -apple-system, Helvetica, Arial, sans-serif; }
    .bc-top { position:absolute; top:80px; left:80px; right:80px; display:flex; align-items:center; justify-content:space-between; z-index:10; }
    .bc-top-label { font-size:20px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:${p.textColorMuted}; }
    .bc-bottom { position:absolute; left:80px; right:80px; bottom:76px; display:flex; align-items:center; justify-content:space-between; z-index:10; }
    .bc-logo { display:flex; align-items:center; gap:16px; }
    .bc-logo svg { width:56px; height:56px; }
    .bc-logo-text { font-size:34px; font-weight:800; color:${p.logoTextColor}; letter-spacing:-0.5px; }
    .bc-logo-text span { font-weight:400; color:${p.logoAccent}; }
    .bc-badge { display:flex; align-items:center; gap:10px; background:${p.badgeBg}; border:1px solid ${p.badgeBorder}; border-radius:999px; padding:14px 28px; }
    .bc-badge-current { font-size:26px; font-weight:700; color:${p.badgeTextColor}; }
    .bc-badge-total { font-size:26px; font-weight:500; color:${p.badgeMutedColor}; }
  </style>
  <div class="bc-frame">
    ${p.decorSvg}
    <div class="bc-top">
      <div class="bc-top-label">ActivoPOS.com</div>
      <div class="bc-top-label">${esc(p.categoryLabel)}</div>
    </div>
    ${p.contentHtml}
    <div class="bc-bottom">
      <div class="bc-logo">${logoHtml}<div class="bc-logo-text">Activo<span>POS</span></div></div>
      <div class="bc-badge"><span class="bc-badge-current">${p.slideNumber}</span><span class="bc-badge-total">/ ${p.totalSlides}</span></div>
    </div>
  </div>`
}

export const BICOLOR_ON_ORANGE = {
  textColorMuted: '#0D1B2E', logoTextColor: '#0D1B2E', logoAccent: '#0038BD',
  badgeBg: 'rgba(13,27,46,0.1)', badgeBorder: 'rgba(13,27,46,0.2)',
  badgeTextColor: '#0D1B2E', badgeMutedColor: '#3B2200',
  logoDotOverride: '#0D1B2E',   // el punto ámbar del isotipo se pierde sobre ámbar
}
export const BICOLOR_ON_NAVY = {
  textColorMuted: '#DCE6FF', logoTextColor: '#FFFFFF', logoAccent: '#4D7AFF',
  badgeBg: 'rgba(255,255,255,0.12)', badgeBorder: 'rgba(255,255,255,0.25)',
  badgeTextColor: '#FFFFFF', badgeMutedColor: '#DCE6FF',
}

function bicolorCluster(fillMain: string, fillCenter: string, size: number, top: string, left: string, right: string, bottom: string, rotate: number, opacity = 1, ringColor?: string): string {
  const pos = `${top ? `top:${top};` : ''}${left ? `left:${left};` : ''}${right ? `right:${right};` : ''}${bottom ? `bottom:${bottom};` : ''}`
  const ring = ringColor ? `<circle fill="none" stroke="${ringColor}" stroke-width="5" opacity="0.5" cx="250" cy="250" r="108"/>` : ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 500 500" style="position:absolute; ${pos} transform:rotate(${rotate}deg); opacity:${opacity}; z-index:0;">
    <g><path fill="${fillMain}" d="M 26,82 Q 26,26 82,26 L 190,26 Q 220,26 220,56 Q 220,88 190,88 L 100,88 Q 88,88 88,100 L 88,190 Q 88,220 56,220 Q 26,220 26,190 Z"/>
    <path fill="${fillMain}" d="M 474,82 Q 474,26 418,26 L 310,26 Q 280,26 280,56 Q 280,88 310,88 L 400,88 Q 412,88 412,100 L 412,190 Q 412,220 444,220 Q 474,220 474,190 Z"/>
    <path fill="${fillMain}" d="M 26,418 Q 26,474 82,474 L 190,474 Q 220,474 220,444 Q 220,412 190,412 L 100,412 Q 88,412 88,400 L 88,310 Q 88,280 56,280 Q 26,280 26,310 Z"/>
    <path fill="${fillMain}" d="M 474,418 Q 474,474 418,474 L 310,474 Q 280,474 280,444 Q 280,412 310,412 L 400,412 Q 412,412 412,400 L 412,310 Q 412,280 444,280 Q 474,280 474,310 Z"/></g>
    ${ring}<circle fill="${fillCenter}" cx="250" cy="250" r="72"/></svg>`
}

// ── Decors, tamaño/posición consistente ──
export function buildBicolorMovimientoDecor(): string {
  return bicolorCluster('#0D1B2E', '#EF8E01', 620, '-140px', '', '-150px', '', -12, 0.9, '#EF8E01')
}
export function buildBicolorOfertaDecor(): string {
  return bicolorCluster('#B56700', '#0038BD', 620, '-140px', '-150px', '', '', 10, 0.85, '#0038BD')
}
export function buildBicolorTestimonioDecor(): string {
  return bicolorCluster('#001D7A', '#EF8E01', 620, '', '-150px', '', '-140px', -10, 0.85, '#EF8E01')
}
export function buildBicolorStatDecor(): string {
  return bicolorCluster('#B56700', '#0038BD', 620, '-140px', '', '-150px', '', 12, 0.85)
}
export function buildBicolorChecklistDecor(): string {
  return bicolorCluster('#4D7AFF', '#EF8E01', 620, '-410px', '-410px', '', '', -12, 0.55)
}
export function buildBicolorCtaDecor(): string {
  return bicolorCluster('#B56700', '#0038BD', 620, '', '', '-150px', '190px', 10, 0.85, '#0038BD')
}

// ── Contents ──
export function buildBicolorMovimientoContent(c: { lineas: string[]; highlight: string; subtitulo: string }): string {
  const lineasHtml = c.lineas.map(l => esc(l)).join('<br/>')
  return `<div style="position:absolute; left:80px; right:100px; top:640px; z-index:2;">
    <h1 style="margin:0; font-size:96px; font-weight:800; line-height:1.02; letter-spacing:-2px; text-transform:uppercase; color:#FFFFFF;">${lineasHtml}<br/><span style="position:relative; display:inline-block; margin-top:10px;"><span style="position:absolute; inset:6px -14px; background:#EF8E01; transform:rotate(-2deg); border-radius:8px; z-index:0;"></span><span style="position:relative; z-index:1; color:#0D1B2E; padding:0 10px;">${esc(c.highlight)}</span></span>.</h1>
    <p style="margin:40px 0 0 0; font-size:32px; line-height:1.4; color:#DCE6FF; font-weight:500; max-width:640px;">${esc(c.subtitulo)}</p>
  </div>`
}
export function buildBicolorOfertaContent(c: { statPrefix: string; highlight: string; subtitulo: string }): string {
  return `<div style="position:absolute; left:80px; right:100px; top:640px; z-index:2;">
    <h1 style="margin:0; font-size:92px; font-weight:800; line-height:1.03; letter-spacing:-2px; text-transform:uppercase; color:#0D1B2E;">${esc(c.statPrefix)} <span style="position:relative; display:inline-block;"><span style="position:absolute; inset:6px -14px; background:#0038BD; transform:rotate(-2deg); border-radius:8px; z-index:0;"></span><span style="position:relative; z-index:1; color:#FFFFFF; padding:0 10px;">${esc(c.highlight)}</span></span>.</h1>
    <p style="margin:40px 0 0 0; font-size:32px; line-height:1.4; color:#0D1B2E; font-weight:600; max-width:660px;">${esc(c.subtitulo)}</p>
  </div>`
}
export function buildBicolorTestimonioContent(c: TestimonioContent): string {
  if (!c.autorNombre || !c.autorNegocio) {
    throw new Error('buildBicolorTestimonioContent: autorNombre/autorNegocio obligatorios')
  }
  const citaHtml = renderTitleSegments(c.citaSegments, '#EF8E01', '#0D1B2E')
  return `<div style="position:absolute; left:80px; right:80px; top:400px; z-index:2;">
    <h1 style="margin:0; font-size:66px; font-weight:800; line-height:1.14; letter-spacing:-1px; color:#FFFFFF;">&ldquo;${citaHtml}&rdquo;</h1>
    <p style="margin:40px 0 0 0; font-size:28px; font-weight:600; color:#DCE6FF;">${esc(c.autorNombre)} &middot; ${esc(c.autorNegocio)}</p>
  </div>`
}
export function buildBicolorStatContent(c: { statNumero: string; statUnidad: string; statLabel: string; subtitulo: string }): string {
  return `<div style="position:absolute; left:80px; right:80px; top:520px; z-index:2;">
    <div style="font-size:280px; font-weight:800; letter-spacing:-8px; line-height:0.9; color:#0D1B2E;">${esc(c.statNumero)}<span style="font-size:120px; font-weight:800;">${esc(c.statUnidad)}</span></div>
    <div style="margin-top:24px; font-size:50px; font-weight:800; text-transform:uppercase; letter-spacing:-1px; color:#0038BD;">${esc(c.statLabel)}</div>
    <p style="margin-top:28px; font-size:30px; line-height:1.4; color:#0D1B2E; font-weight:600; max-width:660px;">${esc(c.subtitulo)}</p>
  </div>`
}
export function buildBicolorChecklistContent(c: { titulo: string; highlight: string; items: string[] }): string {
  const items = c.items.slice(0, 4)
  const itemsHtml = items.map(text => `
    <div style="display:flex; align-items:center; gap:24px; background:rgba(255,255,255,0.1); border-left:6px solid #EF8E01; border-radius:4px; padding:26px 30px;">
      <div style="font-size:32px; font-weight:700; color:#FFFFFF;">${esc(text)}</div>
    </div>`).join('')
  return `<div style="position:absolute; left:80px; right:80px; top:260px; z-index:2;">
    <h1 style="margin:0; font-size:70px; font-weight:800; line-height:1.08; letter-spacing:-1px; text-transform:uppercase; color:#FFFFFF; max-width:820px;">${esc(c.titulo)} <span style="position:relative; display:inline-block;"><span style="position:absolute; inset:4px -10px; background:#EF8E01; transform:rotate(-2deg); border-radius:6px; z-index:0;"></span><span style="position:relative; z-index:1; color:#0D1B2E; padding:0 8px;">${esc(c.highlight)}</span></span>.</h1>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:520px; display:flex; flex-direction:column; gap:22px; z-index:2;">${itemsHtml}</div>`
}
export function buildBicolorCtaContent(c: { tituloPre: string; highlight: string; tituloPost: string; subtitulo: string; ctaLabel: string }): string {
  return `<div style="position:absolute; left:80px; right:80px; top:380px; z-index:2;">
    <h1 style="margin:0; font-size:96px; font-weight:800; line-height:1.02; letter-spacing:-2px; text-transform:uppercase; color:#0D1B2E;">${esc(c.tituloPre)} <span style="position:relative; display:inline-block;"><span style="position:absolute; inset:6px -14px; background:#0038BD; transform:rotate(-2deg); border-radius:8px; z-index:0;"></span><span style="position:relative; z-index:1; color:#FFFFFF; padding:0 10px;">${esc(c.highlight)}</span></span> ${esc(c.tituloPost)}</h1>
    <p style="margin:36px 0 0 0; font-size:32px; line-height:1.4; color:#0D1B2E; font-weight:600; max-width:640px;">${esc(c.subtitulo)}</p>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:900px; z-index:2;">
    <div style="background:#0038BD; color:#FFFFFF; font-size:38px; font-weight:800; padding:28px 56px; border-radius:16px; display:inline-block;">${esc(c.ctaLabel)} &rarr;</div>
  </div>`
}

// ── Familia POP ──────────────────────────────────────────────────────────────
// Namespace propio, mismo criterio que BicolorLayout: pop es un modo completo
// del carrusel, no un layout que pickLayoutForRole pueda devolver por rol.
// A diferencia de bicolor, el frame pop NO recibe logoSvg: su lockup es un punto
// de color + texto, no el isotipo, así que no necesita leer nada del disco.

export type PopLayout = 'ghost-hero' | 'highlight-text' | 'chat-bubble' | 'checklist' | 'cta-precio' | 'foto-lateral'

interface PopFrameParams {
  slideNumber:  number
  totalSlides:  number
  contentHtml:  string
  decorSvg:     string   // el blob/polígono/dots decorativo, distinto por layout -- no hay ghost number único compartido
}

export function buildPopFrame(p: PopFrameParams): string {
  return `<style>
    * { margin:0; padding:0; box-sizing:border-box; }
    .pop-frame { position:relative; width:1080px; height:1350px;
      background:oklch(97% 0.018 75); overflow:hidden;
      font-family:'DM Sans', -apple-system, Helvetica, Arial, sans-serif; }
    .pop-logo { position:absolute; top:80px; left:80px; display:flex; align-items:center; gap:14px; z-index:2; }
    .pop-logo-dot { width:14px; height:14px; border-radius:50%; background:#0038BD; }
    .pop-logo-text { font-size:24px; font-weight:800; letter-spacing:1px; color:#0D1B2E; }
    .pop-logo-text span { font-weight:400; color:#0038BD; }
    .pop-badge { position:absolute; left:80px; bottom:80px; display:flex; align-items:center; gap:10px;
      background:rgba(13,27,46,0.06); border:1px solid rgba(13,27,46,0.15); border-radius:999px; padding:14px 28px; z-index:2; }
    .pop-badge-current { font-size:24px; font-weight:700; color:#0D1B2E; }
    .pop-badge-total { font-size:24px; font-weight:500; color:#3B4A63; }
  </style>
  <div class="pop-frame">
    ${p.decorSvg}
    <div class="pop-logo">
      <div class="pop-logo-dot"></div>
      <div class="pop-logo-text">Activo<span>POS</span></div>
    </div>
    ${p.contentHtml}
    <div class="pop-badge">
      <span class="pop-badge-current">${p.slideNumber}</span>
      <span class="pop-badge-total">/ ${p.totalSlides}</span>
    </div>
  </div>`
}

// ── 1. ghost-number-hero-pop ──
export interface PopGhostHeroContent {
  titulo: string
  subtitulo: string
}
export function buildPopGhostHeroDecor(ghostNumber: number): string {
  const n = String(ghostNumber).padStart(2, '0')
  return `<svg width="620" height="600" style="position:absolute; bottom:-100px; right:-120px;">
    <path d="M60,120 C160,20 380,-20 480,90 C580,200 560,340 460,420 C360,500 180,520 90,430 C0,340 -30,220 60,120 Z" fill="#EF8E01" opacity="0.85"/>
  </svg>
  <div style="position:absolute; top:640px; left:70px; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:520px; line-height:1; color:transparent; -webkit-text-stroke:3px rgba(0,56,189,0.18); letter-spacing:-16px; z-index:1;">${esc(n)}</div>
  <svg width="180" height="180" style="position:absolute; top:150px; left:80px;">
    <circle cx="8" cy="8" r="6" fill="#0D1B2E"/><circle cx="44" cy="8" r="6" fill="#0D1B2E"/>
    <circle cx="8" cy="44" r="6" fill="#0D1B2E"/><circle cx="44" cy="44" r="6" fill="#0D1B2E"/>
  </svg>`
}
export function buildPopGhostHeroContent(c: PopGhostHeroContent): string {
  return `<div style="position:absolute; left:80px; right:100px; top:300px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:96px; line-height:1.06; color:#0D1B2E; letter-spacing:-1px;">${esc(c.titulo)}</h1>
    <p style="margin:34px 0 0 0; font-size:34px; line-height:1.4; color:#3B4A63; font-weight:500; max-width:700px;">${esc(c.subtitulo)}</p>
  </div>`
}

// ── 2. highlight-text-pop (reusa TitleSegment/renderTitleSegments) ──
export function buildPopHighlightDecor(): string {
  return `<svg width="520" height="480" style="position:absolute; top:-40px; right:-60px;">
    <polygon points="520,0 520,400 120,0" fill="#EF8E01" opacity="0.9"/>
  </svg>
  <div style="position:absolute; top:420px; right:120px; width:60px; height:60px; border-radius:50%; background:#0038BD;"></div>`
}
export function buildPopHighlightContent(tituloSegments: TitleSegment[], subtitulo: string): string {
  const titleHtml = renderTitleSegments(tituloSegments, '#0038BD', '#FFFFFF')
  return `<div style="position:absolute; left:80px; right:80px; top:540px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:88px; line-height:1.12; color:#0D1B2E; letter-spacing:-1px;">${titleHtml}</h1>
    <p style="margin:34px 0 0 0; font-size:32px; line-height:1.4; color:#3B4A63; font-weight:500; max-width:680px;">${esc(subtitulo)}</p>
  </div>`
}

// ── 3. chat-bubble-pop ──
export function buildPopChatBubbleDecor(): string {
  return `<svg width="480" height="440" style="position:absolute; top:-60px; left:-80px;">
    <path d="M60,120 C160,20 340,-10 420,90 C500,190 480,300 400,360 C320,420 160,430 90,360 C20,290 -20,220 60,120 Z" fill="#EF8E01" opacity="0.14"/>
  </svg>`
}
// check-icon en #16A34A sobre blanco -- Design lo trajo en ámbar/#0D1B2E, viola la
// regla de verde-para-check del proyecto.
export function buildPopChatBubbleContent(c: ChatBubbleContent): string {
  const clienteTexto = stripEmoji(c.clienteTexto)
  return `<div style="position:absolute; left:80px; right:80px; top:280px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:72px; line-height:1.1; color:#0D1B2E; letter-spacing:-1px; max-width:780px;">${esc(c.titulo)}</h1>
  </div>
  <div style="position:absolute; left:80px; top:560px; max-width:600px; background:#FFFFFF; border:2px solid rgba(0,56,189,0.15); border-radius:26px 26px 26px 6px; padding:34px 38px; box-shadow:0 20px 44px rgba(13,27,46,0.08); z-index:2;">
    <p style="margin:0; font-size:32px; line-height:1.4; color:#0D1B2E; font-weight:500;">${esc(clienteTexto)}</p>
    <div style="display:flex; justify-content:flex-end; margin-top:16px;">
      <span style="font-size:20px; color:#8A93A6;">${esc(c.clienteHora)}</span>
    </div>
  </div>
  <div style="position:absolute; right:80px; top:790px; max-width:500px; background:#0038BD; border-radius:26px 26px 6px 26px; padding:30px 34px; z-index:2;">
    <p style="margin:0; font-size:28px; line-height:1.4; color:#FFFFFF; font-weight:500;">${esc(c.respuestaTexto)} &#10003;</p>
  </div>
  <div style="position:absolute; right:80px; top:920px; width:56px; height:56px; border-radius:50%; background:#16A34A; display:flex; align-items:center; justify-content:center; z-index:2;">
    <svg width="26" height="20" viewBox="0 0 26 20" fill="none"><path d="M2 10L9 17L24 2" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>`
}

// ── 4. checklist-iconos-pop ──
export function buildPopChecklistDecor(): string {
  return `<svg width="520" height="480" style="position:absolute; bottom:-60px; left:-80px;">
    <polygon points="0,480 0,80 440,480" fill="#0038BD" opacity="0.9"/>
  </svg>`
}
export function buildPopChecklistContent(c: ChecklistContent): string {
  const items = c.items.slice(0, 4)
  const checkIcon = `<svg width="26" height="20" viewBox="0 0 26 20" fill="none"><path d="M2 10L9 17L24 2" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  const itemsHtml = items.map(text => `
    <div style="display:flex; align-items:center; gap:26px; background:#FFFFFF; border-radius:18px; padding:28px 34px; box-shadow:0 14px 30px rgba(13,27,46,0.06);">
      <div style="flex:none; width:56px; height:56px; border-radius:50%; background:#16A34A; display:flex; align-items:center; justify-content:center;">${checkIcon}</div>
      <div style="font-size:32px; font-weight:600; color:#0D1B2E;">${esc(text)}</div>
    </div>`).join('')
  return `<div style="position:absolute; left:80px; right:80px; top:230px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:72px; line-height:1.1; color:#0D1B2E; letter-spacing:-1px; max-width:820px;">${esc(c.titulo)}</h1>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:540px; display:flex; flex-direction:column; gap:24px; z-index:2;">
    ${itemsHtml}
  </div>`
}

// ── 5. cta-precio-pop ──
export function buildPopCtaPrecioDecor(): string {
  return `<svg width="640" height="600" style="position:absolute; top:-120px; right:-140px;">
    <path d="M60,120 C160,20 380,-20 480,90 C580,200 560,340 460,420 C360,500 180,520 90,430 C0,340 -30,220 60,120 Z" fill="#EF8E01" opacity="0.85"/>
  </svg>`
}
export function buildPopCtaPrecioContent(c: CtaPrecioContent): string {
  return `<div style="position:absolute; left:80px; right:80px; top:280px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:80px; line-height:1.1; color:#0D1B2E; letter-spacing:-1px; max-width:800px;">${esc(c.tituloPre)}<span style="font-style:italic; font-weight:600; color:#EF8E01;">${esc(c.tituloAccent)}</span>${esc(c.tituloPost)}</h1>
    <p style="margin:30px 0 0 0; font-size:32px; line-height:1.4; color:#3B4A63; font-weight:500; max-width:700px;">${esc(c.subtitulo)}</p>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:700px; background:#0038BD; border-radius:24px; padding:44px 48px; z-index:2;">
    <div style="font-size:22px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#DCE6FF;">${esc(c.planNombre)}</div>
    <div style="margin-top:14px; display:flex; align-items:baseline; gap:10px;">
      <span style="font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:84px; color:#FFFFFF;">$${c.precioUsd}</span>
      <span style="font-size:28px; font-weight:600; color:#DCE6FF;">/ mes</span>
    </div>
  </div>
  <div style="position:absolute; left:80px; right:80px; top:960px; z-index:2;">
    <div style="background:#EF8E01; color:#0D1B2E; font-size:36px; font-weight:800; padding:26px 52px; border-radius:16px; display:inline-block;">${esc(c.ctaLabel)} &rarr;</div>
  </div>`
}

// ── 6. foto-lateral-pop ──
export function buildPopFotoLateralDecor(): string {
  return ''  // el blob va pegado a la foto, se resuelve dentro del content, no como decor separado
}
export function buildPopFotoLateralContent(c: FotoLateralContent): string {
  return `<div style="position:absolute; left:80px; top:220px; width:420px; height:420px; z-index:1;">
    <div style="position:absolute; inset:-14px; background:#EF8E01; opacity:0.85; border-radius:50% 50% 45% 55% / 55% 45% 55% 45%;"></div>
    <img src="${esc(c.fotoUrl)}" style="position:relative; width:100%; height:100%; object-fit:cover; clip-path:ellipse(48% 48% at 50% 50%);">
  </div>
  <div style="position:absolute; left:80px; right:80px; top:700px; z-index:2;">
    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:62px; line-height:1.1; color:#0D1B2E; letter-spacing:-1px;">${esc(c.titulo)}</h1>
    <p style="margin:26px 0 0 0; font-size:28px; line-height:1.45; color:#3B4A63; font-weight:500;">${esc(c.subtitulo)}</p>
    <div style="margin-top:40px; background:#FFFFFF; border-radius:18px; padding:26px 30px; box-shadow:0 14px 30px rgba(13,27,46,0.06); display:inline-block;">
      <div style="font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#0038BD;">${esc(c.statLabel)}</div>
      <div style="margin-top:8px; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:48px; color:#0D1B2E;">${esc(c.statValor)}</div>
    </div>
  </div>`
}

// ── Orquestador público ──

export type SlideLayout = 'ghost-hero' | 'highlight-text' | 'chat-bubble' |
  'checklist' | 'cta-precio' | 'foto-lateral' | 'curva-corte' | 'split-diagonal' |
  'testimonio' | 'silueta-recibo'

export { buildSlideFrame, FOTO_LATERAL_GHOST_STYLE, DEFAULT_GHOST_STYLE }
