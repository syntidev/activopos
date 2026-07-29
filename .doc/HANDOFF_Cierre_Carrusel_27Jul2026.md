# HANDOFF — Cierre Carrusel Social (selector permutable)
# Compilado por: Claude Code (CLI-C, solo lectura)
# Fecha: 2026-07-28
# Estado: 3 familias + selector permutable commiteados y pusheados. Ver
# "Discrepancias vs. premisa de cierre" antes de asumir nada como 100% cerrado.
# Próximo agente: LEE ESTO COMPLETO. No asumas continuidad de conversación previa.

---

## 0. Discrepancias encontradas vs. la premisa de cierre — LEER PRIMERO

Este documento se pidió asumiendo cierto estado. Verificando contra el código y
el disco real, 3 puntos no coinciden exactamente con esa premisa. Se documentan
aquí en vez de escribirse como hecho consumado:

1. **"renderPathFor exhaustivo con assertNever"** — ya NO es así. El refactor
   `3528f85`/`9a69488` (retiro de `CarouselMode`) reemplazó el `switch` con
   `assertNever` por una cadena de `if` sobre `CarruselModoInput` (ver §2.2).
   `assertNever` existió entre `6184c8f` y `9a69488`, pero no en el código actual.

2. **"7 combinaciones certificadas con evidencia real de Cloudinary"** — la
   MATRIZ LÓGICA (`scripts/_modoinput-matrix.ts`) confirma las 7 combinaciones
   a nivel de `renderPathFor` (qué función se llama por slide). Pero evidencia
   REAL descargada de Cloudinary y medida en disco (`scripts/_e2e-carrusel-check.ts`,
   guarda en `.tmp/e2e-carrusel/`) **solo existe para 3 de 7**: Geométrico solo,
   Bicolor solo, Pop solo (los 3 en `.tmp/e2e-carrusel/{geometric,bicolor,pop}/`,
   medidos: 1080×1350 los tres, confirmado con `sharp().metadata()`). **No hay
   evidencia en disco para Humana sola, Geométrico+Humana, Bicolor+Humana,
   Pop+Humana** — exactamente las 4 combinaciones que dependían de los fixes de
   `91b0984` y `9fa2cf8` (compose.ts + mockup), commiteados apenas minutos antes
   de este handoff. No corrí el E2E de nuevo para generar esa evidencia (CLI-C
   es solo lectura, y ese script gasta llamadas reales a Gemini/FLUX/Cloudinary).

3. **"3 instancias duplicadas de Fraunces"** — el conteo real es **4**, no 3:
   `src/app/layout.tsx`, `src/app/(auth)/layout.tsx`,
   `src/app/(marketing)/layout.tsx`, `src/app/catalogo/layout.tsx` — cada uno
   con su propio `Fraunces({...})` de `next/font/google` independiente (ver §4).

Todo lo demás en este documento sí está verificado contra código/git real.

---

## 1. Resumen ejecutivo

El carrusel social tiene **3 familias de layouts geométricos** renderizados
como HTML/CSS → Puppeteer (`render-slide.ts`) → WebP, más un modo de **fotos
humanas** (Gemini/FLUX → `compose.ts`, sin Puppeteer):

| Familia | Archivo de layouts | # layouts declarados |
|---|---|---|
| Navy/geométrico | `carousel-layouts.ts` (`SlideLayout`) | 10 |
| Bicolor | `carousel-layouts.ts` (`BicolorLayout`) | 6 |
| Pop | `carousel-layouts.ts` (`PopLayout`) | 6 |
| **Total declarado** | | **22** (no 21 — recontado, ver `carousel-layouts.ts:452,612,783-785`) |

De esos 22, los que de verdad se usan hoy (asignados a un rol por
`pickLayoutForRole`/`pickBicolorLayoutForRole`/`pickPopLayoutForRole`,
`brand.ts:271-307`): 4 de 10 (navy), 4 de 6 (bicolor), 5 de 6 (pop). El resto
está definido pero deliberadamente sin asignar — ver §4 (deuda técnica).

Selector permutable de **2 dimensiones ortogonales** (`CarruselModoInput`,
`brand.ts:187-201`):
- `tipo: 'humano_puro' | 'familia'`
- `familia?: 'geometric' | 'bicolor' | 'pop'` (solo si `tipo==='familia'`)
- `incluirEscenaHumana?: boolean` (solo si `tipo==='familia'`, portada por fotos)

7 combinaciones posibles: Humana sola, Geométrico solo, Geométrico+Humana,
Bicolor solo, Bicolor+Humana, Pop solo, Pop+Humana. Estado de certificación
real: **ver §0.2** — 3/7 con evidencia en disco, 4/7 sin evidencia (aunque los
2 bugs que las bloqueaban ya están cerrados en código).

---

## 2. Arquitectura

### 2.1 `CarruselModoInput` — única fuente de verdad del modo

```typescript
// brand.ts:187-201
/* Rediseño del selector (reemplaza CarouselMode -- no borrado todavía, lo
   consumen route.ts/carrusel.ts, se migra en el siguiente prompt una vez
   probado). 'human' puro deja de ser un valor más del enum plano: es un modo
   de render total y distinto (100% fotos, ninguna de las 3 familias de
   layouts), no una familia -- por eso vive en `tipo`, no en `familia`.
   'hybrid' (slide 0 humano + resto de una familia) se modela como
   tipo:'familia' + incluirEscenaHumana:true -- dimensión ortogonal a la
   familia elegida, en vez de un quinto/sexto valor hardcodeado por familia. */
export type CarouselFamilia = 'geometric' | 'bicolor' | 'pop'

export interface CarruselModoInput {
  tipo: 'humano_puro' | 'familia'
  familia?: CarouselFamilia       // requerido si tipo === 'familia'
  incluirEscenaHumana?: boolean   // solo aplica si tipo === 'familia', default false
}
```
El comentario menciona "no borrado todavía" porque se escribió ANTES del
refactor `3528f85` — hoy `CarouselMode` (el enum plano de 5 valores) ya no
existe en `brand.ts`, `carrusel.ts` ni `route.ts` (confirmado: 0 resultados de
`grep CarouselMode` en esos 3 archivos tras `3528f85`). El comentario quedó
desactualizado respecto al propio código que describe — no se tocó porque
CLI-C es solo lectura.

### 2.2 `renderPathFor` — hoy, NO exhaustivo con assertNever

```typescript
// carrusel.ts:124-130
type RenderPath = 'human' | 'geometric' | 'bicolor' | 'pop'
const renderPathFor = (i: number): RenderPath => {
  const m = input.modoInput
  if (m.tipo === 'humano_puro') return 'human'
  if (i === 0 && m.incluirEscenaHumana) return 'human'
  return m.familia ?? 'geometric'
}
```
Sin `switch`, sin `assertNever`. Correcto porque `CarouselFamilia` (3 valores)
es subconjunto exacto de `RenderPath` (4 valores) — no hay un 4º/5º valor de
`tipo`/`familia` que pueda escapar sin que TypeScript ya lo bloquee en el tipo
de `modoInput`. Consumo en el loop principal, sin cambios respecto a antes:
```typescript
// carrusel.ts:357-361
const imagen_url =
  path === 'human'   ? await renderHuman(spec, i)   :
  path === 'bicolor' ? await renderBicolor(spec, i) :
  path === 'pop'     ? await renderPop(spec, i)     :
                       await renderGeometric(spec, i)
```

### 2.3 Picker de campos del LLM consciente de la familia (`gemini.ts`)

```typescript
// gemini.ts:168-179
function extraFieldsResolverFor(familia: CarouselFamilia): ExtraFieldsResolver {
  switch (familia) {
    case 'bicolor':
      return role => { const l = pickBicolorLayoutForRole(role); return l ? BICOLOR_EXTRA_FIELDS[l] : undefined }
    case 'pop':
      return role => { const l = pickPopLayoutForRole(role); return l ? POP_EXTRA_FIELDS[l] : undefined }
    case 'geometric':
      return role => LAYOUT_EXTRA_FIELDS[pickLayoutForRole(role)]
  }
}
```
3 mapas por familia (`BICOLOR_EXTRA_FIELDS`, `POP_EXTRA_FIELDS`,
`LAYOUT_EXTRA_FIELDS`, `gemini.ts:144-161`), construidos sobre 4 constantes de
texto compartidas (`CAMPO_HIGHLIGHT`, `CAMPO_HIGHLIGHT_CORTO`, `CAMPO_ITEMS`,
`CAMPOS_CHAT`, `gemini.ts:123-142`). `CopyInput.familia?: CarouselFamilia`
(`gemini.ts:248`) reemplazó al viejo `carouselMode?: CarouselMode`.

`generateCarrusel` decide la familia efectiva antes de llamar a `generateCopy`:
```typescript
// carrusel.ts:99-106
const familiaEfectiva: CarouselFamilia | undefined =
  input.modoInput.tipo === 'humano_puro' ? undefined : (input.modoInput.familia ?? 'geometric')

const copy = await generateCopy({
  tipo: 'carrusel', nicho: input.nicho, gancho, objetivo: input.objetivo, slides: input.count,
  familia: familiaEfectiva,
})
```

### 2.4 Guardia contra cifras monetarias inventadas

```typescript
// gemini.ts:135-142 (CAMPOS_CHAT, prompt al LLM)
'  PROHIBIDO incluir montos, totales, precios o cifras monetarias específicas en\n' +
'  clienteTexto o respuestaTexto: son mensajes simulados de conversación, no facturas.\n' +
'  Usa lenguaje genérico ("ya quedó registrada tu venta"), NUNCA un monto, ni en Bs\n' +
'  ni en dólares. Un monto inventado se publica como si fuera una venta real.'
```
Reforzado en el sanitizador de la respuesta cruda del LLM (`gemini.ts`, función
de sanitizado de slide, no citada aquí por espacio): si `clienteTexto` o
`respuestaTexto` contienen un monto detectado, el campo entero se descarta y
los renderers caen a su fallback genérico sin cifra.

---

## 3. Bugs reales cerrados esta sesión — con hash de commit

| Bug | Commit | Evidencia |
|---|---|---|
| `$0.00` publicado como dato real (curva-corte) | `3ae2e92` (sacado de `pickLayoutForRole`) + `9560490` (revienta explícito si se reasigna) | `carrusel.ts:179-180`: `case 'curva-corte': throw new Error('curva-corte: statValor no tiene fuente de dato real...')` |
| Dimensión 1:1 vs 4:5 mal cableada — familias geométricas | `76f86f1` | `renderGeometric`/`renderBicolor`/`renderPop` pasan `'4:5'` explícito a `renderSlideToPng` (`carrusel.ts:206,266,325`) |
| Dimensión 1:1 vs 4:5 mal cableada — `renderHuman`/`compose.ts` | `91b0984` | "dimensiones de composite alineadas, resuelve fallo en renderHuman" — ver auditoría previa de esta sesión (`compose.ts:227-229`, `renderText()` sin límite de alto) |
| Mockup de teléfono superpuesto en fotos humanas de carrusel | `9fa2cf8` | `carrusel.ts:345`: `formato: 'carrusel'` (antes `'post'`) — `compose.ts:241` ya condicionaba el mockup a `formato !== 'carrusel'`, solo faltaba declararlo bien |
| Fuente de cuerpo/display sin conectar a Inter/Fraunces reales | `6e3041e` (Inter auto-hospedada) + `76a1039` (Fraunces separado de `--font-display`) | fuera del dominio `social/` — tokens CSS del admin, no de `compose.ts`/`carousel-layouts.ts` |
| Precio $19/$25 inconsistente | **No se localizó un commit único de "unificación"** — `precioUsd` viene de `BILLING_CYCLES.negocio_activo.mensual` desde la primera vez que se introdujo el campo (`f543291`, `7592791`, con nota explícita "Verificado: precioUsd sale de BILLING_CYCLES, no hardcodeado" en ambos commits). Precio real actual: **$19/mes** (`plan-limits.ts:2`). `grep '\$[0-9]' carousel-layouts.ts` no devuelve ningún literal hardcodeado fuera del parámetro `precioUsd` — consistente hoy en los 3 layouts de precio (navy/bicolor/pop). Si hubo un $25 en algún punto, no dejó rastro en el historial de `src/lib/social/` — puede haber sido en `html-generator.ts` (código muerto, nunca se leyó su historial completo) o en un archivo de marketing fuera de este dominio. |

---

## 4. Deuda técnica — explícita, con ubicación exacta

**`pop-cta-precio` — el blob tapa el título, sin fix:**
```typescript
// carousel-layouts.ts:764
return ''  // el blob va pegado a la foto, se resuelve dentro del content, no como decor separado
```
Mencionado también en el mensaje de `6184c8f`: "pop-cta-precio: el blob ambar
del decor tapa el titulo, que tambien es problema conocido". Sin resolver.

**Layouts sin rol asignado por falta de fuente de dato real:**
```typescript
// brand.ts:282 — bicolor
// testimonio y stat NUNCA se devuelven: testimonio no tiene atribución real y
// stat pinta una cifra sin fuente de dato -- misma razón que curva-corte.

// brand.ts:295 — pop
// foto-lateral NUNCA se devuelve -- no hay fuente de foto real por slide.

// brand.ts:307-308 — navy
// testimonio y split-diagonal quedan definidos pero SIN asignar a ningún rol
// todavía -- testimonio por falta de atribución real, split-diagonal porque ya
// hay un layout de CTA (cta-precio) y meter los dos duplica el rol sin criterio
```
Lista completa de layouts declarados pero sin rol: `testimonio` (navy),
`split-diagonal` (navy), `testimonio` (bicolor), `stat` (bicolor),
`foto-lateral` (pop). Los 3 renderers (`renderGeometric`/`renderBicolor`/`renderPop`,
`carrusel.ts`) revientan explícito con `Error` si alguno de estos layouts
llegara a asignarse sin resolver primero la fuente de dato — no hay fallback
silencioso a cifra/foto/atribución inventada.

**`input.geometryType` sin efecto:**
```typescript
// carrusel.ts:71
geometryType?:   SlideGeometry   // override: fuerza una geometría en todas las slides geométricas
```
Único uso de `geometryType` en todo `carrusel.ts` — la declaración del campo.
`grep geometryType carrusel.ts` no devuelve ningún otro resultado: el override
del formulario no llega a ningún renderer. Pendiente documentado desde `1101430`.

**4 instancias duplicadas de `Fraunces` (no 3, ver §0.3):**
```
src/app/layout.tsx:2,15                — import { Inter, Fraunces } ...
src/app/(auth)/layout.tsx:1,7          — import { Fraunces, DM_Sans } ...
src/app/(marketing)/layout.tsx:2,8     — import { Fraunces, DM_Sans } ...
src/app/catalogo/layout.tsx:1,3        — import { Fraunces } ...
```
Cada uno instancia su propio `Fraunces({...})` de `next/font/google`,
independiente — sin compartir variable CSS entre layouts.

---

## 5. Commits de la sesión — orden cronológico

Rango: rediseño de carrusel (bicolor/pop + selector permutable), `2026-07-27
23:12` → `2026-07-28 20:21`.

| Hash | Fecha/hora | Qué hizo |
|---|---|---|
| `f543291` | 07-27 23:12 | 6 layouts nuevos de carrusel (navy) — sin certificar visualmente |
| `7592791` | 07-27 23:23 | 4 layouts más (curva-corte, split-diagonal, testimonio, silueta-recibo) |
| `db35a75` | 07-27 23:30 | 3 ajustes visuales (curva-corte, silueta-recibo, split-diagonal) |
| `2d0b5ab` | 07-27 23:46 | `logoSvg` en `buildSlideFrame` + `pickLayoutForRole` en `brand.ts` |
| `1101430` | 07-27 23:52 | `pickLayoutForRole` reducido a 4 layouts compatibles con `SlideCopy` |
| `76f86f1` | 07-28 00:09 | `renderGeometric` pasa `'4:5'` explícito |
| `3ae2e92` | 07-28 00:22 | curva-corte fuera de `pickLayoutForRole` (publicaba $0.00) |
| `9560490` | 07-28 00:34 | curva-corte revienta explícito si se reasigna |
| `e57d80a` | 07-28 00:42 | `SlideCopy` extendido: `tituloHighlight`/`items`/`clienteTexto` |
| `e407e60` | 07-28 00:48 | checklist y chat-bubble conectados a datos reales del LLM |
| `28c0464` | 07-28 17:09 | `CarouselMode` importado desde `brand.ts`, bicolor visible en selector |
| `32519cc` | 07-28 17:19 | familia bicolor — frame, 6 decors, 6 contents |
| `9bd35d9` | 07-28 17:33 | bicolor — isotipo visible en fondo ámbar, z-index de chrome |
| `1ae806e` | 07-28 17:42 | bicolor — offset de decor fuera de zona de chrome |
| `41e346b` | 07-28 17:51 | opción Pop visible en selector |
| `8b372cb` | 07-28 18:01 | familia pop — frame, 6 decors, 6 contents |
| `6777c41` | 07-28 18:07 | pop — decor de checklist fuera del badge, check duplicado corregido |
| `6184c8f` | 07-28 18:25 | bicolor y pop cableados — `renderPathFor` exhaustivo con `assertNever` (luego retirado, ver §2.2) |
| `fd30e1c` | 07-28 18:36 | guardia contra cifras monetarias inventadas en chat-bubble |
| `816ec44` | 07-28 18:44 | `generateCopy` elige picker de campos según modo, no solo rol |
| `9a69488` | 07-28 19:12 | selector permutable: familia + toggle escena humana, reemplaza modelo de 5 valores |
| `3528f85` | 07-28 19:28 | `CarouselMode` retirado — `CarruselModoInput` única fuente de verdad |
| `6e3041e` | 07-28 19:35 | Inter auto-hospedada (fuera del dominio carrusel, tokens admin) |
| `76a1039` | 07-28 19:57 | Fraunces separado de `--font-display` (fuera del dominio carrusel) |
| `91b0984` | 07-28 20:07 | `compose.ts` — dimensiones de composite alineadas, resuelve fallo en `renderHuman` |
| `9fa2cf8` | 07-28 20:21 | `renderHuman` declara `formato: 'carrusel'` — sin mockup de teléfono |

---

## 6. Próximos pasos sugeridos (sin ejecutar)

- Resolver fuente de dato real para `foto-lateral` (¿Cloudinary de fotos reales
  del negocio del cliente?), `testimonio` (¿atribución real autorizada por
  cliente, o se descarta el layout?), `stat` (¿copy fijo aprobado o variable
  con fuente real?) — sin esto, 5 de 22 layouts declarados siguen sin poder
  asignarse a ningún rol.
- Correr `scripts/_e2e-carrusel-check.ts human`, `... geometric humana`,
  `... bicolor humana`, `... pop humana` para cerrar la brecha de evidencia
  real de §0.2 — las 4 combinaciones bloqueadas ya deberían funcionar tras
  `91b0984`/`9fa2cf8`, falta confirmarlo con Cloudinary real, no solo con la
  matriz lógica.
- Considerar unificar las 4 instancias de `Fraunces` (no 3, ver §0.3) en un
  único loader compartido.
- Decidir qué hacer con `pop-cta-precio` (blob tapa título) y con
  `input.geometryType` (sin efecto — ¿se conecta o se retira el campo del
  formulario para no prometer algo que no hace nada?).
- Confirmar o descartar si el precio $25 mencionado en la premisa de esta
  tarea existió alguna vez en código de `social/` — no se encontró rastro en
  el historial de este dominio; puede venir de `html-generator.ts` (código
  muerto) o de un archivo fuera de `src/lib/social/`.
