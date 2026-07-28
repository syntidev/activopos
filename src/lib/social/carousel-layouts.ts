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

interface SlideFrameParams {
  ghostNumber:   number
  eyebrowText:   string
  accentColor:   string   // solo se usa de verdad si isCtaSlide=true
  isCtaSlide?:   boolean
  slideNumber:   number
  totalSlides:   number
  contentHtml:   string
  ghostStyle?:   GhostNumberStyle
}

function buildSlideFrame(p: SlideFrameParams): string {
  const ghostNum = String(p.ghostNumber).padStart(2, '0')
  const gs = p.ghostStyle ?? DEFAULT_GHOST_STYLE
  const chromeAccent = p.isCtaSlide ? p.accentColor : CHROME_ACCENT_DEFAULT

  return `<style>
    * { margin:0; padding:0; box-sizing:border-box; }
    .frame { position:relative; width:1080px; height:1350px;
      background:linear-gradient(160deg, #0038BD 0%, #002FA0 55%, #001D7A 100%);
      overflow:hidden; font-family:'DM Sans', -apple-system, Helvetica, Arial, sans-serif; }
    .ghost-number { position:absolute; top:${gs.top}; left:${gs.left};
      ${gs.transform ? `transform:${gs.transform};` : ''}
      font-family:'Fraunces', Georgia, serif; font-weight:700; font-size:${gs.fontSize}; line-height:1;
      color:transparent; -webkit-text-stroke:3px rgba(255,255,255,0.16); letter-spacing:${gs.letterSpacing};
      user-select:none; pointer-events:none; z-index:0; }
    .eyebrow { position:absolute; top:96px; left:80px; right:80px; display:flex; align-items:center; gap:14px; z-index:1; }
    .eyebrow-bar { width:34px; height:3px; background:${chromeAccent}; }
    .eyebrow-text { font-size:22px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#DCE6FF; }
    .fr-bottom { position:absolute; left:80px; right:80px; bottom:76px; display:flex; align-items:center; justify-content:space-between; z-index:1; }
    .fr-logo { display:flex; align-items:center; gap:14px; }
    .fr-logo-dot { width:14px; height:14px; border-radius:50%; background:${chromeAccent}; }
    .fr-logo-text { font-size:34px; font-weight:800; color:#FFFFFF; letter-spacing:-0.5px; }
    .fr-logo-text span { font-weight:400; color:#4D7AFF; }
    .fr-badge { display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); border-radius:999px; padding:14px 28px; }
    .fr-badge-current { font-size:26px; font-weight:700; color:#FFFFFF; }
    .fr-badge-total { font-size:26px; font-weight:500; color:#DCE6FF; }
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
        <div class="fr-logo-dot"></div>
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

// ── Orquestador público ──

export type SlideLayout = 'ghost-hero' | 'highlight-text' | 'chat-bubble' | 'checklist' | 'cta-precio' | 'foto-lateral'

export { buildSlideFrame, FOTO_LATERAL_GHOST_STYLE, DEFAULT_GHOST_STYLE }
