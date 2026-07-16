# BUILD SPEC — Landing ActivoPOS · Dirección "Bento cálido"
# Para: CLI-B | Generado por: Claude Web (director creativo/marketing) | 2026-07-11
# Aprobado visualmente por Carlos Bolívar en sesión de diseño — este doc es la fuente de verdad

---

## 0. ALCANCE

Rediseño completo de:
1. Landing principal — `src/app/(marketing)/page.tsx` + `sections/*.tsx` (9 secciones)
2. Template de segmento — `src/app/(marketing)/para-[segmento]/page.tsx` + los 6 componentes:
   `SegmentHero`, `SegmentPains`, `SegmentFeatures`, `SegmentPricing`, `SegmentFAQ`, `SegmentCTA`

Ambos consumen el mismo sistema de tokens y componentes base descritos abajo.
El template de segmento usa variables dinámicas de DB (`SegmentData`) — NO hardcodear copy por segmento.

**Fuera de alcance de este doc:** DT-14 (variant_id en catalog order), bugs de Sprint 82, build roto en blog/page.tsx. Esos son fixes técnicos de CLI-A, no tocan diseño.

---

## 1. TOKENS DE COLOR — REGLA DE USO SEMÁNTICO (irrompible)

Ningún color se usa fuera de su trabajo semántico. Esto es una regla de diseño, no solo de paleta.

| Token | Hex | Uso permitido | Uso PROHIBIDO |
|---|---|---|---|
| Navy | `#0D1B2E` | **Exactamente 2 zonas en toda la página**: Hero (apertura) y el cierre — Testimonios + CTA final fusionados como una sola zona navy continua (van consecutivos, se leen como un solo bloque de cierre, no como secciones navy separadas por contenido claro entre medio) | Cualquier zona navy adicional que quede aislada entre bloques claros — la regla es sobre zonas continuas, no sobre contar secciones una por una |
| Persian Blue | `#0038BD` | Marca, identidad del sistema, CTA secundario, bloque "Tu día" | — |
| Brand Light | `#4D7AFF` | Degradados junto a Persian Blue (nunca sólido) | — |
| Brand Soft | `#DCE6FF` | Fondos de bloque azul suave, pills de métodos de pago | — |
| Carrot (CTA) | `#EF8E01` | **Solo** en el botón de acción principal y badges de precio flotantes | Nunca como fondo de sección completa |
| Sand (NUEVO) | `#FBF3E7` | Fondos de bloque neutro/cálido — utilidad práctica, métodos de pago, tabs secundarias | — |
| Sand claro | `#FFEBC2` | Iconos/acentos dentro de bloques Sand | — |
| Success | `#16A34A` | **Solo** confirmación financiera verificada: "ya cubriste tus gastos", "todo al día", punto de equilibrio superado | Nunca decorativo, nunca en métodos de pago (evita leerse como "pago procesado" — no somos pasarela) |
| Success claro | `#EAF3DE` / `#C0DD97` | Fondo de bloque de confirmación financiera | — |
| Danger | `#EF4444` | Solo alertas reales (stock crítico, error) | — |
| Warning | `#F59E0B` | Solo alertas de vencimiento/atención | — |
| Base | `#F4F6FB` | Fondo de página — 80%+ del sitio | — |

**Regla de fondo:** el sitio respira en `#F4F6FB`. Navy es bookend, no wallpaper.

---

## 1.5 SPECS PRESCRIPTIVAS — VALORES EXACTOS (no interpretar, no aproximar)

La primera pasada de Sprint 1 quedó plana porque el doc usaba lenguaje descriptivo
("padding generoso", "degradado suave") en vez de valores exactos. Esto se corrige
con números literales, obligatorios, sin margen de interpretación:

- **Cards bento (todas):** `border-radius: 18px` a `20px`. `padding: 20px 24px` mínimo,
  nunca menos. `box-shadow: 0 2px 8px rgba(47,43,61,0.10)` en cards blancas.
- **Card firma "Tu día":** fondo `radial-gradient(circle at 20% 20%, #4D7AFF 0%, #0038BD 80%)`
  — degradado real, NUNCA color sólido ni blanco. `padding: 22px`. Título 19-22px/700.
  `box-shadow: 0 12px 32px rgba(0,56,189,0.25)`.
- **Bloques de pilares:** `min-height: 180px`, ícono en contenedor `36x36px` con
  `border-radius: 10px`, título `15px/700`, cuerpo `12-13px` con `line-height: 1.5`.
  Colores con degradado radial sutil, NUNCA fill plano de una sola tonalidad.
- **Separación entre secciones:** `padding: 48px 0` mínimo verticalmente. No comprimir.
- **Tipografía de sección:** headline `20-26px/700` (Fraunces), NUNCA por debajo de 18px.
- Si un componente existente (`TickerSection` u otro) no aparece en la lista de
  §4, igual debe rediseñarse con este mismo sistema de tokens — "no estaba en la
  lista" no es excusa para dejarlo en su estilo viejo. Ver §1.6.

## 1.6 COMPONENTE OMITIDO — TickerSection (agregar al alcance)

`TickerSection.tsx` (entre Hero y Pilares) quedó fuera del doc original por
omisión — se corrige aquí. Rediseñar como franja de una sola línea, fondo
`#F4F6FB` (base, NO navy — ya usamos navy en Hero), texto `12px/500` en
`--text-secondary`, separador `·` entre items, sin fondo oscuro ni caja
angosta ilegible. Contenido: lista corta de diferenciadores (BCV automático,
Pago Móvil nativo, Tallas y colores, Catálogo digital 24/7, Cotización de
servicios, Pedidos por WhatsApp) — mismo texto que ya existe, solo re-estilizado.

## 2. TIPOGRAFÍA

Sin cambios — ya validada contra la dirección "Bento cálido":
- Display: **Fraunces** (headlines, números grandes) — variable, pesos 400-900
- Body: **DM Sans** — pesos 300-600
- No se introduce ninguna fuente nueva (Inter/Geist quedan descartadas — leen frío/genérico, contrario al brief)

---

## 3. LENGUAJE FINANCIERO — TRADUCCIÓN OBLIGATORIA

Ningún término contable crudo llega al usuario sin traducción a criollo. Tabla de reemplazo obligatoria:

| Nunca decir | Decir así |
|---|---|
| "Margen bruto 36.8%" | "De cada $10 que vendes, te quedan $3.68 limpios" |
| "Punto de equilibrio superado" | "Ya cubriste lo que gastaste hoy" |
| "Utilidad neta" | "Lo que de verdad ganaste" |
| "Factura" (en cualquier contexto) | "Cotización", "comprobante de venta", "control de ventas" — **nunca implicar que generamos documento fiscal SENIAT** |
| "Pasarela de pago" / "procesamos tu pago" | "Guardamos tus datos de cobro, tu cliente los recibe listo" — **nunca implicar que procesamos la transacción** |

Disclaimer legal obligatorio en footer (ya sellado, no tocar):
> "ActivoPOS es tu sistema de control de ventas e inventario. No reemplaza tu facturación SENIAT — la complementa."

---

## 4. ESTRUCTURA — LANDING PRINCIPAL (9 secciones, en orden)

1. **Hero** — "Tu negocio te cuenta cómo le fue hoy." Tarjeta "Tu día" como elemento firma (mockup A aprobado). Fondo Navy con curva de transición hacia el resto.
2. **Pilares** — Vende (azul) / Controla (Sand) / Entiende (verde-suave, NO Success puro — es aspiracional, no confirmación verificada todavía en este punto de la página)
3. **Métodos de pago** — fondo verde claro `#EAF3DE` (tono ambiente, NO el `#16A34A` sólido — ese se queda exclusivo para confirmación financiera verificada en Finanzas/Pulso, aquí es solo temperatura de confianza). Pills blancas con texto `#16A34A`/verde oscuro. Copy explícito y visible: "No somos pasarela de pago. Guardamos el dato, tu cliente lo recibe listo." — el copy es lo que evita la confusión con "pago procesado", no el color.
4. **Segmentos con color** — grid de 10 segmentos core con tema visual completo + link "Ver todos los segmentos" hacia grid ampliada (20+). Tarjeta destacada de servicios profesionales (ticket vs. carta).
5. **Tabs de funcionalidad** — Cobros / Variantes / Cocina (KDS), interactivo, un clic revela el panel. **Precisión obligatoria en el panel de Cocina:** el sistema NO tiene gestión de mesas todavía — solo armado de alimento y cola de pedidos hacia cocina. Copy correcto: "Tu cocina ve el pedido armado, en el momento" / mostrar "Pedido #084 · En preparación", nunca "Mesa 4" ni ninguna referencia a numeración de mesas. Mejora de gestión de mesas queda como feature futura, no se promete en landing.
6. **Finanzas/Pulso ("el cerebro")** — bloque azul "Tu mes" + bloque Success "Ya cubriste tus gastos" (aquí SÍ es Success real, es confirmación verificada) + 2 mini-cards blancas (CxC, mejor hora).
7. **Catálogo Digital** — posicionado como acompañante ("Cuando quieras vender también en la calle"), NO como estrella. 3 mini-preview: vitrina / catálogo / pedido por WhatsApp.
8. **Precios** — 3 planes reales del sistema, verificados en `src/lib/plan-limits.ts` (`BILLING_CYCLES`/`PLAN_DISPLAY`, fuente de código — más confiable que la captura de pantalla usada en una versión anterior de este doc): `Mostrador` ($9/mes — POS táctil, inventario, BCV automática, 2 usuarios, 200 productos), `Negocio` ($19/mes, **más popular** — todo Mostrador + catálogo digital con WhatsApp + cotizaciones PDF + CxC + finanzas completas, 5 usuarios, 500 productos), `Pro` ($29/mes — todo Negocio + analytics avanzado + usuarios/productos ilimitados + KDS + soporte prioritario). Card de "Negocio" con borde azul y badge "Más popular". Antes de construir, verificar una vez más contra `plan-limits.ts` en la sesión de build — es la fuente de verdad, no este documento.

   **Toggle de ciclo de pago (agregar — reutilizar lógica ya construida en Sprint 50, `TabPlan`, NO crear cálculo nuevo):** Mensual / Semestral (20% OFF) / Anual (30% OFF), pill horizontal encima de las 3 cards, mismo patrón visual que el resto del sitio (fondo Sand o blanco, pill activa en Persian Blue). Esto expone en la landing pública una capacidad que ya existe en el backend pero hoy solo vive dentro de Configuración — no requiere nuevo endpoint, solo UI pública consumiendo el mismo cálculo de descuento por ciclo.
9. **Testimonios + CTA final** — testimonios con foto real sobre fondo Navy con textura sutil (no plana), headline grande en blanco, cards de testimonio con fondo claro de alto contraste contra el fondo oscuro (referencia: Givingli.com). CTA final Navy con curva de cierre (segundo y último uso de navy en la página).

## 11. FOOTER — WORDMARK DE CIERRE (agregar)
El footer (zona Navy sellada) incluye, además del contenido funcional (links,
contacto), un tratamiento tipográfico grande: "Activo" en Fraunces, peso 900,
tamaño masivo (clamp 80px-180px según viewport), color blanco con opacidad
8-12% (translúcido, no texto legible funcional — es textura de marca), posicionado
detrás o debajo del contenido funcional del footer. Mismo espíritu que el
wordmark gigante de fondo que usan SaaS modernos en su footer de cierre.

## 12. SATURACIÓN — AJUSTE GENERAL (no agregar colores nuevos)
Los bloques bento en toda la página suben un nivel de saturación/contraste
respecto a la primera pasada — colores más sólidos y confiados, menos "pastel
lavado". Esto se logra intensificando los degradados radiales ya definidos
en §1 (stops más saturados), NO agregando colores fuera de la paleta sellada.

## 13. TRATAMIENTO FULL-BLEED — Finanzas/Pulso y Catálogo Digital (referencia: Airtable)
Estas 2 secciones específicas dejan de ser "card contenida con margen" y pasan
a ser bloque de color full-bleed (el color llena el ancho completo del
contenedor de sección, sin padding lateral que muestre el fondo base detrás).
Título alineado a la izquierda dentro del bloque, no centrado.

La tarjeta "Tu día" del Hero gana profundidad: 1-2 tarjetas adicionales de
días anteriores apiladas en abanico (rotate leve, -4deg/+4deg, z-index detrás),
sin agregar color nuevo — mismo degradado, solo capas.

NO adoptar: burbujas flotantes de reacción/comentario en esquinas de bloques
(lenguaje de herramienta B2B de colaboración, no encaja con el tono cálido
del proyecto). NO agregar fila de logos de clientes — no hay logos reales
disponibles todavía.

---

## 5. TEMPLATE DE SEGMENTO — `/para-[slug]`

### Variables de DB consumidas (ya existen en `SegmentData`, no crear nuevas)
```
headline, subheadline, tag_line, pain_1, pain_2, pain_3,
hero_image (nullable), theme_key, mode ('product'|'service'|'hybrid'), faqs[]
```

### SegmentHero
- `data-theme={segment.theme_key}` — consume los 10 bloques `[data-theme="X"]` ya sellados en `tokens.css`. Nunca hardcodear color.
- Layout formato "Pulpos": foto/ilustración de fondo (ver §6) + mockup de producto superpuesto + badge de precio flotante (Carrot).
- Si `hero_image` es null → fallback a bloque degradado ilustrado del mismo `theme_key` (mismo layout, sin foto).

### SegmentFeatures
- `mode='service'` → activa el mensaje ticket/carta: *"Ticket para el mostrador. Carta para tu cotización. Tú eliges el formato — nosotros no generamos tu factura fiscal, te ayudamos a controlar antes de que llegue a tu contador."*
- `mode='product'` → mensaje estándar de inventario/variantes.
- `mode='hybrid'` → ambos mensajes, orden según cuál pese más en `pain_1`.

### SegmentPains / SegmentPricing / SegmentFAQ / SegmentCTA
- Heredan tokens de color del §1, tipografía del §2, sin excepción por segmento.
- `SegmentCTA` es zona Navy (mismo criterio que CTA final del landing principal) — mantiene consistencia de bookend en cada mini-landing individual.

---

## 6. ASSETS VISUALES POR SEGMENTO

- **Prioridad 1:** foto real con contexto específico de negocio (ej. ferretero entre repuestos, no fondo de estudio). Evitar stock genérico corporativo — rompe la promesa de autenticidad del resto del sitio.
- **Fallback:** ilustración en el mismo estilo Bento cálido, misma composición que la foto (no cambia el layout, solo la fuente del asset).
- **Testimonios:** SIEMPRE foto real, nunca ilustrada — ahí es donde más pesa la cara real.

---

## 7. ANIMACIÓN — Framer Motion (stack ya sellado)

- **Un solo momento orquestado**, no efectos dispersos: la tarjeta "Tu día" entra con fade-up de 250ms al cargar el hero. Nada más se anima al load.
- **Scroll:** cada bloque bento aparece una vez (fade-up sutil), sin parallax, sin blinking dots, sin spotlight de mouse.
- **Hover:** bloques bento suben 2px + sombra más pronunciada (mismo patrón ya sellado en cards del dashboard — consistencia con el resto del sistema).
- `prefers-reduced-motion` respetado en todos los casos, sin excepción.
- **Curva de transición** Navy→claro (SVG `path` simple, ver mockup aprobado) en exactamente 2 puntos: fin de Hero, inicio de CTA final.
- **Halo de luz** radial suave detrás de la tarjeta "Tu día" únicamente — no replicar en otros bloques.

---

## 8. QUÉ NO HACER (aprendido de la landing anterior — no repetir)

- Nada de textura de ruido SVG en toda la página
- Nada de spotlight que sigue el cursor
- Nada de blinking dots decorativos
- Nada de reveal-on-scroll en cada elemento individual (solo por bloque completo)
- Nada de "Corre en el navegador" como diferenciador (es detalle técnico, no beneficio para el dueño del negocio)
- Ningún término contable sin traducir (ver §3)
- Ninguna implicación de que ActivoPOS procesa pagos o genera factura fiscal

---

## 9. SKILLS OBLIGATORIOS PARA CLI-B (pegar al inicio del prompt de ejecución)

```
# MEMORIA — ejecutar PRIMERO antes de cualquier tarea
/instinct-status
/emil-design-eng

/ponytail ultra
/impeccable craft
/frontend-design:frontend-design
/ui-ux-pro-max:ui-ux-pro-max
/coding-standards
/polish
```

---

## 10. CRITERIO DE CIERRE

- ✅ No cerrado hasta que Carlos lo vea funcionando en navegador (regla ya sellada)
- ✅ Cero fachadas — si un dato mostrado (ej. "$8.86 vendidos") no viene de Prisma real, no se muestra
- ✅ TypeScript strict, CSS Modules únicamente, cero Tailwind
- ✅ Verificar montos de Precios (§4.8) con Carlos antes de deploy — no están confirmados

---

*ActivoPOS · SYNTIdev · Dirección creativa: Claude Web · Sesión de diseño 2026-07-11*
