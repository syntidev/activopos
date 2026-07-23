import { type SlideSpec, type SlideGeometry } from './brand'

/**
 * HTML determinista de un slide de carrusel (Sprint 118). El LLM (generateCopy) solo
 * aporta titulo/subtitulo; el diseño —geometría SVG + paleta de marca por rol— lo pone
 * este template, no el modelo. Resultado: slides consistentes de marca, no HTML plano.
 *
 * Devuelve HTML de NIVEL BODY (un <style> + un <div>), no un documento completo: lo envuelve
 * renderSlideToPng() de render-slide.ts (mismo contrato que html-generator), reusando su pool
 * de Puppeteer y el forzado sRGB en vez de lanzar un browser nuevo por slide.
 *
 * Lienzo fijo 1080×1080 (1:1), el formato de carrusel de Instagram.
 */

const W = 1080
const H = 1080

// Escapa texto del copy antes de meterlo en el HTML (evita romper el markup / inyección).
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Geometría SVG por tipo (viewBox 0 0 1080 1080) ────────────────────────────
function geometrySvg(geo: SlideGeometry, spec: SlideSpec): string {
  const a = spec.accentColor
  switch (geo) {
    case 'diagonal':
      return `
        <line x1="-100" y1="300" x2="700" y2="-100" stroke="${a}" stroke-width="12" opacity="0.5"/>
        <line x1="-100" y1="480" x2="880" y2="-100" stroke="${a}" stroke-width="9"  opacity="0.35"/>
        <line x1="200"  y1="1180" x2="1180" y2="500" stroke="${a}" stroke-width="10" opacity="0.3"/>
        <rect x="900" y="-80" width="240" height="240" transform="rotate(45 1020 40)" fill="${a}" opacity="0.35"/>
        <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${a}"/>`
    case 'circles':
      return `
        <circle cx="920" cy="180" r="200" fill="none" stroke="${a}" stroke-width="6" opacity="0.2"/>
        <circle cx="120" cy="940" r="200" fill="${a}" opacity="0.1"/>
        <circle cx="760" cy="700" r="18" fill="${a}" opacity="0.4"/>
        <circle cx="300" cy="220" r="30" fill="${a}" opacity="0.4"/>
        <circle cx="980" cy="560" r="22" fill="${a}" opacity="0.4"/>
        <circle cx="180" cy="480" r="14" fill="${a}" opacity="0.4"/>`
    case 'bars': {
      const bars = [
        { x: 980, y: 760, h: 320, o: 0.6 },
        { x: 1010, y: 640, h: 440, o: 0.45 },
        { x: 1040, y: 820, h: 260, o: 0.3 },
        { x: 950, y: 700, h: 380, o: 0.5 },
        { x: 920, y: 880, h: 200, o: 0.2 },
      ].map(b => `<rect x="${b.x}" y="${b.y}" width="12" height="${b.h}" fill="${a}" opacity="${b.o}"/>`).join('')
      return `<rect x="72" y="80" width="88" height="5" fill="${a}"/>${bars}`
    }
    case 'grid':
      return `
        <defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0 L0 0 0 60" fill="none" stroke="${a}" stroke-width="1" opacity="0.08"/>
        </pattern></defs>
        <rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>
        <rect x="72" y="72" width="200" height="200" fill="none" stroke="${a}" stroke-width="2" opacity="0.3"/>`
    case 'radial': {
      const rays = Array.from({ length: 10 }, (_, i) => {
        const ang = (i / 10) * Math.PI * 2
        const x2 = 540 + Math.cos(ang) * 760
        const y2 = 540 + Math.sin(ang) * 760
        return `<line x1="540" y1="540" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${a}" stroke-width="2" opacity="0.15"/>`
      }).join('')
      return `
        <defs><radialGradient id="rg" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stop-color="${spec.bgColor}"/>
          <stop offset="100%" stop-color="#081020"/>
        </radialGradient></defs>
        <rect x="0" y="0" width="${W}" height="${H}" fill="url(#rg)"/>
        ${rays}
        <circle cx="540" cy="540" r="60" fill="${a}" opacity="0.2"/>`
    }
    case 'split':
      // #EF4444 (rojo del ❌) es específico de esta geometría — fuera de la paleta base
      // de 6 pero definido explícitamente en el brief para el contraste antes/después.
      return `
        <rect x="0" y="0" width="${W / 2}" height="${H}" fill="#0D1B2E"/>
        <rect x="${W / 2}" y="0" width="${W / 2}" height="${H}" fill="#0038BD"/>
        <line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="${a}" stroke-width="2"/>
        <text x="270" y="560" font-size="180" fill="#EF4444" text-anchor="middle" font-family="Inter, sans-serif">✕</text>
        <text x="810" y="560" font-size="180" fill="#16A34A" text-anchor="middle" font-family="Inter, sans-serif">✓</text>`
  }
}

export interface SlideHtmlParams {
  titulo:      string
  subtitulo:   string
  spec:        SlideSpec
  slideNumber: number
  totalSlides: number
  brandName:   string
  logoSvg:     string           // SVG del isotipo (negativo/blanco) como string inline
  geometryType?: SlideGeometry  // override del usuario; si viene, pisa spec.geometry
}

export function buildSlideHTML(params: SlideHtmlParams): string {
  const { titulo, subtitulo, spec, slideNumber, totalSlides, brandName, logoSvg } = params
  const geo   = params.geometryType ?? spec.geometry
  const isCta = spec.role === 'cta'
  const ctaTextColor = isCta ? '#0D1B2E' : '#FFFFFF'

  const dots = Array.from({ length: totalSlides }, (_, i) =>
    `<div class="dot ${i === slideNumber - 1 ? 'active' : ''}"></div>`,
  ).join('')

  return `<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .slide { position: relative; width: ${W}px; height: ${H}px; overflow: hidden;
             background: ${spec.bgColor}; font-family: 'Inter', -apple-system, sans-serif; }
    .geometry { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    .content { position: relative; z-index: 10; padding: 80px 72px; height: 100%;
               display: flex; flex-direction: column; justify-content: center; }
    .slide-number { font-size: 13px; font-weight: 700; color: ${spec.accentColor}; opacity: 0.7;
                    letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; }
    .titulo { font-size: 72px; font-weight: 900; line-height: 1.05; color: #FFFFFF;
              margin-bottom: 24px; text-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .subtitulo { font-size: 28px; font-weight: 500; line-height: 1.4;
                 color: rgba(255,255,255,0.85); max-width: 800px; }
    .cta-button { display: inline-block; margin-top: 40px; padding: 20px 48px;
                  background: ${spec.accentColor}; color: ${ctaTextColor}; font-size: 24px;
                  font-weight: 900; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .logo-lockup { position: absolute; bottom: 64px; left: 72px; z-index: 10;
                   display: flex; align-items: center; gap: 16px; }
    .logo-lockup svg { width: 48px; height: 48px; }
    .logo-text { font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em; }
    .progress { position: absolute; bottom: 64px; right: 72px; z-index: 10;
                display: flex; gap: 8px; align-items: center; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3); }
    .dot.active { background: ${spec.accentColor}; width: 24px; border-radius: 4px; }
  </style>
  <div class="slide">
    <svg class="geometry" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
      ${geometrySvg(geo, spec)}
    </svg>
    <div class="content">
      <div class="slide-number">${slideNumber} / ${totalSlides}</div>
      <div class="titulo">${esc(titulo)}</div>
      <div class="subtitulo">${esc(subtitulo)}</div>
      ${isCta ? '<div class="cta-button">Empieza gratis</div>' : ''}
    </div>
    <div class="logo-lockup">
      ${logoSvg}
      <span class="logo-text">${esc(brandName)}</span>
    </div>
    <div class="progress">${dots}</div>
  </div>`
}
