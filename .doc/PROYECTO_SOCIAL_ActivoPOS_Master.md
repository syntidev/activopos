# PROYECTO SOCIAL — ActivoPOS
# Generador de contenido para Instagram (posts/stories/carruseles)
# Documento maestro A-Z | Compilado: 14 Julio 2026 | Claude Web
# Origen: análisis exhaustivo de Socialia (syntiweb.com/socialia, ~2 semanas de
# desarrollo original) + reconstrucción parcial ya ejecutada en admin.activopos.com

---

## 0. CONTEXTO Y DECISIÓN DE FONDO

Socialia es una herramienta de $35/mes de mercado (equivalente) construida por Carlos
para SYNTIweb — genera arte + copy + estrategia de marketing para Instagram, con
motor de IA (Gemini) y publicación vía Buffer. Se decidió clonar y adaptar su
arquitectura para ActivoPOS en vez de partir de cero, dado el valor real del diseño
ya probado.

**Estado real al cierre de esta sesión: se construyó ~1/3 del sistema total —
la Fase 1 (generación simple), sin Fase 2 (editor de capas) ni Fase 3 (estrategia
con roles de experto + publicación).** Esto no es un defecto de ejecución — lo que
se construyó está bien hecho — es que solo se abordó una fracción del alcance.

---

## 1. ARQUITECTURA GENERAL — LAS 3 FASES

```
FASE 1: CONCEPTO          →  FASE 2: DISEÑO           →  FASE 3: ESTRATEGIA
(formulario + generación)    (editor de capas)            (roles de experto + publicar)
```

Cada fase es una pestaña propia en la UI (01. Concepto / 02. Diseño / 03. Estrategia),
navegación secuencial pero con opción de "Saltar a Estrategia" desde Fase 1 si el
usuario confía en el auto-generado.

---

## 2. FASE 1 — CONCEPTO (documentado de las 8 capturas, pantalla 1)

### 2.1 Selector de formato
3 cards seleccionables (no dropdown):
- **Post** — 3:4
- **Story** — 9:16
- **Carrusel** — serie (N slides)

### 2.2 Estilo visual
Dos modos base: **Tech SaaS** vs. **Escena Humana**, con toggle "Modo Avanzado" que
revela opciones adicionales ocultas por defecto (Carlos confirmó: "por detrás hay
más pero las oculté").

### 2.3 Variación de personaje — motor de diversidad humana
Toggle "Aleatorio" — activa un motor de randomización ya documentado en el
`geminiService.ts` original (`buildHumanVariation()`):
```typescript
GENERO = ['Venezuelan entrepreneur', 'professional woman', 'young business owner', ...]
ESCENA = ['modern home office with plants', 'urban café with laptop', ...]
ILUMINACION = ['golden morning light from window', 'bright noon natural light', ...]
ANGULO = ['frontal portrait', 'three-quarter view', 'over-the-shoulder shot']
```
Diversidad de edades y tipología genética + diversidad de establecimientos —
selección aleatoria combinatoria en cada generación para que no se repitan escenas.

**Estado en ActivoPOS: PARCIALMENTE heredado.** El patrón de arrays+pick() existe
en el código fuente de Socialia; no se confirmó si `image.ts` de ActivoPOS expone
este mismo motor de variación o usa una escena fija por prompt de Gemini.

### 2.4 Producto/Nicho
4 botones en Socialia (SYNTIweb/Studio/Food/Cat) → en ActivoPOS se reemplaza por
selector de los 20 segmentos reales (Carnicería, Farmacia, Restaurante, etc.)

### 2.5 Objetivo
3 clasificaciones de intención: **Vender / Enseñar / Dar a Conocer** — alimenta el
tono y estructura del copy generado en Fase 3.

### 2.6 Campos de entrada estructurados
- **Gancho (Título)** — límite 45 caracteres, contador en vivo
- **Beneficio (Explicación)** — límite 60 caracteres, contador en vivo
- Campo libre "Instrucciones adicionales para el diseño"
- Botón "Copiar Prompt" — expone el prompt real generado, para debug/transparencia

### 2.7 Foto de referencia
Toggle opcional — permite subir una imagen base para usar como referencia visual
en vez de generación 100% desde texto.

### 2.8 Estado en ActivoPOS
✅ Existe: formulario (formato, nicho, gancho, beneficio, objetivo, slides), llamada
a `generateCopy()` (Gemini) + `generateBackground()` (NVIDIA FLUX.1-dev) + `composeSlide()`
(sharp, compone título+subtítulo+logo sobre el fondo).
❌ Falta: "Modo Avanzado" con opciones ocultas, toggle de variación de personaje
expuesto en UI, foto de referencia, botón "Copiar Prompt".

---

## 3. FASE 2 — DISEÑO / EDITOR MAESTRO (documentado de capturas 2, 3, 4, 5)

**Esta fase NO EXISTE en ActivoPOS hoy. Es la pieza central de valor de Socialia
y la más grande por construir.**

### 3.1 Sistema de capas
3 capas independientes, cada una con:
- Nombre de capa (Título Principal / Subtítulo / Logo)
- Punto de color indicador de estado
- **Ícono de ojo** — mostrar/ocultar esa capa individualmente (el logo se puede
  quitar del todo si la imagen no lo requiere, mismo criterio para título/subtítulo)

### 3.2 Lienzo interactivo (drag real)
Preview tipo mockup de Instagram (con header de perfil, contador de likes, icons de
interacción) sobre el cual **se arrastran los elementos directamente con el mouse**.
Texto guía: *"Arrastra los elementos directamente sobre la imagen. Usa la grilla
para una alineación perfecta."* — confirma existencia de sistema de snap/grilla.

Confirmado con evidencia visual real (comparando posición del círculo del logo
entre capturas 2 y 4): el drag es funcional, no decorativo — el elemento cambia
de posición real en el lienzo.

### 3.3 Panel de ajuste — Capa Título/Subtítulo (al expandir)
- **Tamaño** — slider con valor numérico en vivo (ej. "24px")
- **Alinear** — 3 botones (izquierda / centro / derecha)
- **Color** — 8 swatches de paleta (blanco, negro, azul, naranja, verde, rojo,
  morado, ámbar + selector custom)
- **Sombra** — toggle activada/desactivada

### 3.4 Panel de ajuste — Capa Logo (al expandir)
- **Tamaño** — slider con valor numérico en vivo (ej. "110px")
- **Negativo/Positivo** — toggle entre versión clara/oscura del logo según el
  fondo detrás

### 3.5 Cierre de fase — gate de calidad
Checkbox explícito: *"Imagen lista — ya tiene título, logo y sello"* — no se avanza
sin confirmación consciente. Dos acciones: **Descargar** (exporta ya) o
**Continuar a Estrategia** (pasa a Fase 3).

### 3.6 Arquitectura técnica requerida para construir esto
El `compose.ts` actual de ActivoPOS tiene posiciones y tamaños como **constantes
fijas de código** (`MARGIN = 72`, `LOGO_SIZE = 84`). Para Fase 2 real, estos deben
convertirse en **parámetros de entrada**:

```typescript
interface LayerConfig {
  visible: boolean
  x: number; y: number          // posición en el lienzo
  size: number                   // tamaño (fontSize o width según capa)
  align?: 'left' | 'center' | 'right'
  color?: string
  shadow?: boolean
  variant?: 'negative' | 'positive'  // solo logo
}

interface ComposeConfigV2 {
  background: Buffer
  titulo:    { text: string } & LayerConfig
  subtitulo: { text: string } & LayerConfig
  logo:      LayerConfig
}
```

La UI necesita un editor de canvas real — no necesariamente Fabric.js/Konva.js
completo, pero sí un `<canvas>` HTML5 o SVG interactivo con:
- Drag & drop de 3 elementos posicionables
- Sliders sincronizados con la posición/tamaño
- Preview en vivo (puede ser client-side con la imagen de fondo ya generada +
  overlay CSS/canvas, sin necesidad de volver a llamar a `sharp` en cada ajuste —
  el compose final con `sharp` server-side ocurre solo al "Sellar diseño")

---

## 4. FASE 3 — ESTRATEGIA (documentado de capturas 6, 7, 8)

**Esta fase NO EXISTE en ActivoPOS hoy — es "la verdadera magia" según Carlos,
la pieza de mayor valor diferencial.**

### 4.1 Motor de generación — "Roles de Experto"
Pantalla de carga confirma explícito: *"Analizando con ROLES DE EXPERTOS —
Sincronizando con [marca] Intelligence"* — no es una sola llamada genérica a un
LLM, es una arquitectura de **prompt con personas específicas de marketing**
(probablemente encadenadas o combinadas: copywriter senior + estratega de redes +
especialista en SEO + media buyer), cada una aportando su sección del resultado.

### 4.2 Estructura del resultado — 4 categorías con tabs
**Tab Contenido** (5 piezas, cada una etiquetada por función retórica):
1. **Hook (Impacto)** — frase de apertura
2. **Cuerpo (Beneficio)** — desarrollo del mensaje
3. **CTA (Acción)** — llamado a la acción
4. **Pregunta (Interacción)** — pregunta para generar comentarios
5. **Hashtags (Alcance)** — set de hashtags relevantes al tema específico

Cada bloque con botón de copiar individual + botón "Copiar Todo".

**Metadata adicional generada:**
- Horario sugerido (ej. "19:00 VET") — hora óptima calculada, no fija
- Objetivo clasificado (ej. "Conversión y Autoridad de Marca")
- Palabras clave SEO
- Tipo de campaña de Ads recomendada

**Tab Estrategia** — contenido no capturado completo, pendiente de documentar
cuando se retome esta fase.

**Tab Publicidad** — contenido no capturado completo, pendiente.

**Tab SEO** — contenido no capturado completo, pendiente.

### 4.3 Estado en ActivoPOS
`generateCopy()` actual devuelve una estructura plana:
```typescript
{ slides: [{titulo, subtitulo, escena}], caption, hashtags }
```
Sin separación hook/cuerpo/cta/pregunta, sin clasificación de objetivo, sin hora
sugerida, sin tabs de estrategia/publicidad/SEO, sin arquitectura de "roles de
experto" (una sola llamada con un solo system prompt estático desde `brand.ts`).

---

## 5. PUBLICACIÓN — MODAL "Publicar Contenido" (captura 8)

### 5.1 Estructura del modal
- **Canal de publicación** — selector de íconos (Instagram vía Buffer confirmado;
  un segundo ícono presente, no identificado con certeza — posible Facebook/otra
  red conectada a la misma cuenta Buffer)
- Botón grande: **"Enviar a Buffer"**
- **Programación (opcional):**
  - Sugerencia de IA reusada de Fase 3 ("Sugerencia IA: 19:00 VET" + botón "Aplicar")
  - Selector de fecha/hora manual
  - Link "Publicar ahora" como alternativa a programar
- **Vista previa del caption** — scrolleable, muestra el texto final tal cual se
  publicaría

### 5.2 Estado real de Buffer — confirmado en auditoría previa de Socialia
El bug de mismatch de ruta (`/api/socialia/buffer` vs `/api/buffer`) está roto en
el original. **En Next.js App Router este bug es estructuralmente imposible**
(la ruta ES el archivo) — pero la integración de Buffer en sí (autenticación,
llamada real a la API de Buffer, envío del asset + caption + programación) **nunca
se construyó en ActivoPOS.** Fase 3 completa (Buffer real) queda pendiente.

### 5.3 Requiere, para construir
- Cuenta de Instagram ya migrada a Business + vinculada a Página de Facebook
  (pendiente de que Carlos lo complete, guía ya entregada en sesión anterior)
- Token de acceso de Buffer (`SOCIAL_BUFFER_ACCESS_TOKEN`, ya está en el `.env`
  del VPS desde esta sesión, sin código que lo consuma todavía)
- Endpoint `POST /api/admin/social/publish` — recibe post_id + canal + fecha
  opcional, llama a la API real de Buffer, actualiza `SocialPost.estado` a
  'publicado' o 'programado'

---

## 6. CALENDARIO — import/export (mencionado, patrón ya visto en Socialia)

Socialia tenía import/export de Excel (`.xlsx`) para el calendario de contenidos —
confirmado en captura de la interfaz "Calendario de Contenidos" vista en sesión
anterior: tabla con Día/Tipo/Producto/Título/Estado/Acciones, botones "Importar
Excel" y "Nuevo Post".

### 6.1 Estado en ActivoPOS
No construido. `calendar.ts` (tipos) fue documentado del original:
```typescript
CalendarPostStatus = 'pendiente' | 'generado' | 'publicado' | 'fallido'
CalendarPostType = 'POST' | 'STORY' | 'CARRUSEL' | 'REEL'
CalendarPost { id, dia, tipo, producto, objetivo, titulo, subtitulo, caption,
  hashtags, estado, buffer_id?, slides?, notas? }
```
Este modelo es reusable casi 1:1 para ActivoPOS (cambiar `producto` de los 4
valores de Socialia a los 20 segmentos reales).

### 6.2 Para construir (Fase 4, no numerada en el flujo original de 3 fases,
pero es la pieza de automatización real que "no requiere tocar nada")
1. Tabla `SocialCalendarEntry` en Prisma (mismo shape que `CalendarPost` arriba)
2. Import de Excel — parsear filas, crear entradas en estado 'pendiente'
3. Export de Excel — mismo patrón ya usado en Finanzas/Reportes (librería `xlsx`
   ya está en el proyecto)
4. Cron/job (candidato: n8n, ya usado en el proyecto para el reporte mensual) que
   recorra entradas 'pendiente' con fecha de hoy, dispare generación automática
   (Fase 1+2+3 encadenadas sin intervención) y las deje en 'generado' o las publique
   directo si están marcadas para auto-publicar

---

## 7. INVENTARIO DE ARCHIVOS — QUÉ EXISTE HOY EN ACTIVOPOS

```
src/lib/social/
  brand.ts     ✅ — marca real (tokens.css en vivo), PRODUCT_CONTEXT con
                    features/segmentos/tono reales de ActivoPOS
  gemini.ts    ✅ — generateCopy(), estructura plana (sin roles de experto)
  image.ts     ✅ — generateBackground() vía NVIDIA FLUX.1-dev, prompt en
                    positivo (lección aprendida del bug de texto falso)
  compose.ts   ✅ — composeSlide(), posiciones/tamaños FIJOS (sin editor)
  retry.ts     ✅ — reintentos compartidos Gemini/NVIDIA

src/app/(admin)/social/
  page.tsx           ✅ — formulario Fase 1 + grilla de generados (sin Fase 2/3)
  social.module.css  ✅

src/app/api/admin/social/
  generate/route.ts  ✅ — orquesta gemini+image+compose, guarda en DB
  route.ts (GET)      ✅ — lista SocialPost recientes (tope 60, sin paginación)

Prisma: SocialPost, SocialAsset ✅ (tablas creadas, en uso)

FALTA POR COMPLETO:
  - Editor de capas (Fase 2) — ni backend parametrizado ni UI de canvas
  - Motor de roles de experto (Fase 3) — generateCopy() no tiene esta arquitectura
  - Publicación real vía Buffer — endpoint no existe
  - Calendario — tabla, import/export, automatización
```

---

## 8. DECISIONES YA TOMADAS EN ESTA SESIÓN (no reabrir sin razón nueva)

- **NVIDIA FLUX.1-dev**, no Gemini, para imagen — Gemini tiene cuota cero en la
  cuenta actual (falta billing en Google Cloud, decisión de Carlos pendiente si
  activarlo o quedarse en NVIDIA)
- **Sharp**, no html2canvas — html2canvas es browser-only, no corre server-side
- **Almacenamiento local** (`/public/uploads/social/`), no Cloudinary — Cloudinary
  fue descartado como decisión sellada del proyecto en sesión anterior
- **Constante TS para el número de WhatsApp** (no env var) — mismo criterio aplica
  si se necesita algo similar aquí
- **ActivoPOS es marca única** — se eliminó la arquitectura multi-marca
  (ProductType SYNTIweb/Studio/Food/Cat) heredada de Socialia; NO reintroducir
  ese concepto en ninguna fase futura
- **Sin mención de SENIAT** en el contexto de marca inyectado a la IA — decisión
  explícita de Carlos, no agregar

---

## 9. PRÓXIMOS PASOS — ORDEN RECOMENDADO (para sesión con cabeza fresca)

1. **Decisión de Carlos, primero que nada:** ¿construir Fase 2 y 3 completas
   (varios días de trabajo real) o quedarse con la Fase 1 actual por ahora?
2. Si se avanza: **Fase 2 (editor de capas)** antes que Fase 3 — es la que más
   valor visual aporta y la base técnica (parametrizar `compose.ts`) desbloquea
   mejor iteración de diseño antes de invertir en la capa de estrategia
3. **Fase 3 (roles de experto)** — diseñar el prompt/arquitectura de las 5 piezas
   de contenido + metadata, probar con casos reales de ActivoPOS antes de dar
   por bueno
4. **Buffer real** — requiere que la cuenta de Instagram ya esté en Business +
   vinculada a Facebook (pendiente de Carlos)
5. **Calendario + automatización** — la pieza que cierra el círculo completo
   ("radio frecuencia con onda cerebral", como pediste — cero intervención manual
   una vez configurado)

---

*Documento vivo — actualizar cada vez que se avance una fase. No perder este
análisis: representa ~2 semanas de trabajo de diseño de producto ya validado,
no hay que re-descubrirlo en cada sesión futura.*
