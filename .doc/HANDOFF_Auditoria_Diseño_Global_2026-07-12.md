# HANDOFF — Auditoría de Diseño Global ActivoPOS
**Fecha:** 2026-07-12 | **Agente:** CLI-C (solo lectura, sin correcciones) | **Alcance:** 34 páginas de (marketing), 2 viewports c/u (1280px desktop, 390px mobile)

Metodología: servidor dev levantado limpio (`.next` purgado tras detectar caché corrupta — ver nota metodológica), barrido Playwright real (no DevTools simulado) por las 34 páginas × 2 viewports, con captura de overflow horizontal, elementos recortados, texto desbordado en badge/pill/chip, links muertos, y errores de consola/red. Cruzado contra consulta SQL directa a MySQL para el hallazgo principal. TypeScript y accesibilidad delegados a subagentes ECC vía Task tool.

---

## ⚠️ Nota metodológica — falso arranque descartado

El primer barrido corrió contra un servidor dev con caché `.next` corrupta (síntoma: `Cannot find module './1682.js'`, CSS/JS bundles devolviendo 500). Esto generaba falsos positivos masivos: logo renderizando a 500×500px (el CSS real nunca cargaba), overflow horizontal de 118px en TODAS las páginas, 4 páginas con HTTP 500. Se descartó ese corrido completo, se limpió `.next` (fix documentado en el propio CLAUDE.md del proyecto), se reinició el servidor, y se confirmó red limpia (`0` requests fallidos) antes de re-correr el barrido completo. Los hallazgos de este documento son todos del corrido limpio, verificados dos veces cuando fue posible.

---

## P0 — Visual roto

### [P0] Contraste del CTA principal del sitio — falla en TODAS las páginas
*(hallazgo del subagente de accesibilidad, re-clasificado aquí por severidad visual)*
Token `--cta: #EF8E01` (tokens.css:89) usado como fondo con texto blanco `#FFFFFF` da un ratio de contraste de **2.46:1**, contra el mínimo requerido de 3:1 (texto grande/bold) o 4.5:1 (texto normal). Es el botón de conversión principal del sitio: "Empezar gratis" (Home hero + CTA final), "Crear cuenta gratis" (/recursos, 4 páginas de segmento verificadas), "Contactar soporte" (/soporte), "Escríbenos por WhatsApp" (/faq), badge "Más popular" de pricing. Afecta `/`, `/planes`, `/recursos`, `/soporte`, `/faq`, `/para-carniceria`, `/para-restaurante`, `/para-tecnologia`, `/para-servicios` — desktop y mobile.
Confianza: ALTA (ratio calculado con fórmula WCAG de luminancia relativa, verificado contra fondo real con alpha-compositing)

### [P0 → reclasificado tras investigar] Tabla comparativa de `/planes` en mobile — scroll horizontal sin affordance visible
**Viewport:** mobile (390px) | **Archivo:** `src/app/(marketing)/planes/page.module.css:196-207`
```css
.tableWrap { overflow-x: auto; ... }
.table { width: 100%; border-collapse: collapse; min-width: 560px; }
```
Medido: `tableWrap.scrollWidth=560` vs `clientWidth=311` → 249px de contenido no visible sin hacer scroll horizontal. El scroll SÍ funciona (contenedor tiene `overflow-x:auto`, no es un bug de layout roto), pero en el screenshot mobile solo se alcanza a ver la columna "Función" + "Mo..." (Mostrador cortado) — nada indica al usuario que debe deslizar para ver Negocio/Pro.
Confianza: ALTA (medido + confirmado visualmente en screenshot)

---

## P1 — Molesto

### [P1] Texto secundario/mudo — falla de contraste en ~90 de ~105 ocurrencias medidas
*(subagente de accesibilidad)* Token `--mkt-text-3` / `#94A3B8` (tokens.css:21) usado como texto real (no decorativo): links sociales del footer "Instagram"/"WhatsApp" (ratio 2.56, todas las páginas), descripciones de la tabla comparativa (2.56, /planes), taglines de segmento (2.46–2.56, /segmentos, /recursos), metadata de blog (2.56), pills de categoría de FAQ (2.2), label "(opcional)" del form de contacto (2.56), sufijo "/mes" en pricing de segmentos (2.56). Todos requieren 4.5:1. Es un solo token de diseño manifestándose en ~90 fallas distintas.
Confianza: ALTA

### [P1] Texto secundario oscuro — falla de contraste, principalmente en footer y cards con fondo tintado
*(subagente de accesibilidad)* `#64748B` (`--mkt-text-2`) sobre footer navy `#0D1B2E`: ratio 3.64 en títulos de columna ("Producto", "Segmentos", "Empresa", "Legal"), copyright, crédito synti.dev — todas las páginas. Sobre fondos claros tintados: 3.19–4.4 en subtítulos de /soporte, /contacto, tabs de categoría de /soporte (3.83), descripción de CTA de /faq (3.81). Todos bajo el mínimo 4.5:1, varios muy cerca (4.4) pero aún fallando.
Confianza: ALTA

### [P1] Sin indicador de foco visible en el formulario de `/contacto`
*(subagente de accesibilidad)* `form.module.css:39` fija `outline: none` sin condición; `:focus` (líneas 46-49) solo cambia `border-color`, sin `box-shadow`/outline de reemplazo. Verificado en vivo (no solo leyendo el CSS): los 4 campos (`#cf-name`, `#cf-email`, `#cf-biz`, `#cf-msg`) muestran `outline-style: none` al enfocar, sin alternativa. El resto del sitio sí tiene `:focus-visible { outline: 2px solid }` global — este formulario lo anula localmente.
Confianza: ALTA

### [P1] Salto de jerarquía de encabezados en `/planes`
*(subagente de accesibilidad)* `PlanToggle.tsx:60` renderiza `<h3>{PLAN_DISPLAY[tier]}</h3>` (nombres de plan "Mostrador"/"Negocio"/"Pro") inmediatamente después del `<h1>` de la página, antes del primer `<h2>` ("Todo lo que incluye cada plan", `page.tsx:86`). h1→h3 sin h2 intermedio.
Confianza: ALTA

---

## P2 — Estético

### [P2] Touch targets bajo 44px — 81 ocurrencias, sistemático en nav y footer
*(subagente de accesibilidad, regla propia del proyecto: "Touch targets minimo 44px")* Toda la franja de nav principal (~21px desktop, 17-35px mobile: "Cómo funciona", "Planes", "Recursos", "Blog", "Ayuda", "FAQ", "Contacto", "Iniciar sesión"); links de columna del footer (206×25px desktop / 350×25px mobile, todas las páginas); botón hamburguesa (40×40px mobile, 4px corto); chips de categoría de blog (~38px), tabs de segmento de /soporte (~37px), tabs de ciclo de facturación (~38px).
Confianza: ALTA (medido con `getBoundingClientRect`)

### [P2] `SegmentsMenu.tsx:19-42` — mapa de íconos del dropdown de nav, incompleto para 3 de 25 segmentos activos
*(subagente typescript-reviewer)* Faltan `comida-rapida`, `bisuteria`, `gestoria-tramites` — caen al ícono genérico `Store`, mientras `SegmentIcon.tsx` (usado en home/segmentos) SÍ los tiene completos.
Confianza: ALTA

### [P2] `SegmentsSection.tsx` y `segmentos/page.tsx` — mapa `SEGMENT_ACCENT` duplicado y desactualizado
*(subagente typescript-reviewer)* Ambos archivos repiten el mismo mapa de 9 entradas (segmentos originales, pre-crecimiento a 26). 16 de los 25 segmentos activos no tienen acento de color propio.
Confianza: ALTA

### [P2] `FeatureTabsSection.tsx` (Home, desktop) — overflow de texto menor en demo card
`.demo`: `scrollWidth=476` vs `clientWidth=462` — 14px de desborde interno ("BCV congelado en la venta · 2 × Harina P.A.N. · $1.70"). Menor, no genera scroll de página.
Confianza: MEDIA

---

## Investigado y descartado — no son bugs (documentado para evitar re-trabajo)

- **"Corrupción de encoding" en `segments.name`/`tag_line`/`headline`/`pain_1-3` — RECLASIFICADO, falso positivo.** El hallazgo original (HEX dump mostrando `3F3F` donde debía haber "í"/"·") fue reproducido en la conexión MySQL local por `charset cp850` heredado de PowerShell/Windows en queries manuales por terminal — no un problema de los datos en sí. Confirmado con HEX dump directo en el VPS de producción: bytes UTF-8 correctos (`C3AD` = í, `C2B7` = ·). Confirmado también en local pasando `--default-character-set=utf8mb4` al cliente `mysql.exe`: el texto se ve correcto ("Carnicería", "Res · Cerdo · Aves"), tanto en VPS como en local. Producción nunca estuvo corrupta — Next.js/Prisma conectan con el charset correcto por defecto; el problema era exclusivo de mis queries manuales por terminal de Windows sin especificar charset. El subagente de accesibilidad que "corroboró" esto de forma independiente leyó bytes crudos de la respuesta HTTP del servidor, no de una query de terminal — su resultado también debe re-verificarse (posible causa: su entorno de captura también pasó los bytes por una ruta con el mismo problema de charset, o interpretó mal el mismo artefacto). Se retira como hallazgo confirmado.
- **"15 logos duplicados" en cada página** — falso positivo de mi propio selector `[class*="logo" i]`: cada lockup real (nav + drawer móvil + footer) tiene 5 sub-elementos con "logo" en el className. 3×5=15 mobile, 2×5=10 desktop. Sin superposición real, confirmado matemática y visualmente.
- **`TickerSection_track` "desbordando" 5072px en Home** — marquee intencionalmente más ancho que el viewport, contenido por `overflow:hidden` en un ancestro. Sin overflow real de página.
- **`HeroSection_halo` "cortado" en Home mobile** — mancha decorativa de fondo, se extiende intencionalmente unos px más allá del borde.
- **`.chipsScroll` en `/blog` mobile** — `overflow-x: auto` explícito en `blog.module.css:141`, scroll horizontal intencional (mismo patrón que /planes pero aquí es fila de chips, no tabla de datos).
- **Precios $15/$25/$40 en `/planes`** — NO es un error. `plan-limits.ts:57` tiene comentario explícito: *"Precios rectificados por el dueño del negocio 2026-07-11 (antes 9/19/29)"* — cambio de negocio real, posterior a la auditoría de ayer. Fuera de alcance de esta auditoría visual de todos modos.
- **`/blog/controlar-inventario-bodega-sin-papel-ni-excel` reportado como 404** por el subagente de accesibilidad (en su propia instancia, puerto 3001) — verificado directamente por mí ahora mismo (`curl` a mi instancia, puerto 3000): responde `200` con `<h1>` correcto ("Cómo controlar el inventario..."). No reproducible en mi entorno — probable artefacto de su propio rebuild/puerto, no lo incluyo como hallazgo confirmado.
- **4 páginas con HTTP 500 y errores de consola en el primer corrido** — artefacto de caché `.next` corrupta (ver nota metodológica), no reproducible en el corrido limpio.

---

## Cobertura — 34 páginas × 2 viewports

Las **25 páginas `/para-[slug]` activas** (todas, no una muestra) + `/segmentos`, `/recursos`, `/blog`, `/blog/[slug]`, `/soporte`, `/faq`, `/contacto` pasaron el barrido de overflow/clipping/dead-links sin hallazgos de layout nuevos más allá de lo reportado arriba. Ningún link muerto (`href="#"`) encontrado en ninguna página. Accesibilidad muestreada en Home, /planes, /segmentos, /recursos, /blog, /soporte, /faq, /contacto, y 4 /para-[slug] (carniceria, restaurante, tecnologia, servicios — cubriendo los 3 valores de `mode`: product/hybrid/service) — sin diferencias de a11y entre modos.

---

## Auditoría TypeScript (typescript-reviewer — subagente)

- `npx tsc --noEmit`: **0 errores**. Cero `any` confirmado de nuevo.
- Los 3 archivos huérfanos de la auditoría de ayer (`LandingPage.tsx`, `RotatingBadge.tsx`, `SegmentPill.tsx`) **ya no existen en el árbol** — verificado por mí directamente. Alguien ya los eliminó entre ayer y hoy. Resuelto.
- `MAX_VISIBLE`/`col1`/`col2` en `SegmentsMenu.tsx` confirmado size-agnostic — no rompe con el crecimiento de 9→25 segmentos activos.

---

## Resumen ejecutivo

| Severidad | Cantidad | Acción recomendada |
|---|---|---|
| P0 | 2 | Corregir `--cta`/texto blanco a un par que cumpla contraste (revisar todos los tokens de color de texto contra sus fondos reales, no solo este); agregar indicador visual de scroll horizontal en la tabla de `/planes` mobile |
| P1 | 4 | Revisar `--mkt-text-3`/`--mkt-text-2` contra fondos reales (footer navy y cards tintadas); restaurar `:focus-visible` en el form de /contacto; insertar un `<h2>` antes de las cards de plan en `/planes` o bajar esas a `<h4>` |
| P2 | 3 | Completar `SEGMENT_ICON` (3 slugs) y `SEGMENT_ACCENT` (16 slugs); ampliar touch targets de nav/footer/chips a 44px mínimo; revisar el desborde de 14px en `FeatureTabsSection` demo |

No se corrigió nada en este pase — reporte puro, según instrucción.
