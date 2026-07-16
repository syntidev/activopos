# HANDOFF — Auditoría Marketing ActivoPOS
**Fecha:** 2026-07-11 | **Agente:** CLI-C (solo lectura, sin correcciones) | **Alcance:** src/app/(marketing)/** completo

Metodología: lectura completa de cada archivo de página + componentes compartidos + query directa a MySQL (tablas `segments`, `plans`) para verificar contra código real, no contra documentación. `graphify`/`tsc`/2 subagentes (typescript-reviewer, security-reviewer) corriendo en paralelo — sección de sus hallazgos al final, marcada `[PENDIENTE AGENTE]` si no llegaron a tiempo de este corte.

---

## P0 — Precio/dinero incorrecto

### [P0] `src/app/(marketing)/recursos/page.tsx:19-23, 62`
```ts
prisma.plan.findMany({
  where: { active: true },
  orderBy: { sort_order: 'asc' },
  select: { key: true, name: true, price_usd: true },
}),
...
<span className={styles.planPrice}>${plan.price_usd}<span className={styles.planPer}>/mes</span></span>
```
**Evidencia DB (tabla `plans`, consulta directa):**
```
key      name        price_usd
inicio   Mostrador   15
pro      Negocio     25
business Pro         40
```
**Evidencia canónica (`src/lib/plan-limits.ts:58-60`, usada por Home/PricingSection, TODAS las /para-[slug]/SegmentPricing, /planes, PlanToggle):**
```ts
inicio:   buildCycles(9),
pro:      buildCycles(19),
business: buildCycles(29),
```
`/recursos` es la ÚNICA página del sitio que no lee de `plan-limits.ts` — tiene su propia fuente independiente (tabla `plans` en DB) que quedó desincronizada. Coincide exactamente con los montos reportados en el incidente ($15/$25/$40). Un visitante que pase por Home→ve $9/$19/$29, luego entre a /recursos→ve $15/$25/$40 para los mismos 3 planes.
Confianza: ALTA (verificado con query SQL directa + lectura de ambos archivos fuente)

### [P0 — riesgo money/legal, no monto] `src/app/(marketing)/recursos/page.tsx:60`
```tsx
<Link key={plan.key} href="/#pricing" className={styles.planCard}>
```
Cada card de plan en /recursos enlaza a `/#pricing` (ancla de Home) en vez de a `/planes` — el usuario ve un precio (equivocado) y al hacer clic aterriza en una sección con OTRO precio (el correcto), sin ninguna explicación del salto. Refuerza la percepción de bug/estafa de precio.
Confianza: ALTA

---

## P1 — Navegación rota / huérfana

### [P1] `/planes` — huérfana del flujo principal (hallazgo que originó la auditoría, confirmado)
`src/components/marketing/MarketingNav.tsx:21`
```ts
{ label: 'Planes', href: '/#pricing' },
```
`src/components/marketing/MarketingFooter.tsx:9`
```ts
{ label: 'Planes',  href: '/#pricing' },
```
Ni el nav ni el footer enlazan a `/planes` — ambos usan el ancla `/#pricing` de Home. La única entrada real a `/planes` es el link "Ver todos los detalles" dentro de `PricingSection.tsx:115` (home); `SegmentPricing`/otros NO la enlazan en absoluto. `/planes` es alcanzable pero de un solo punto de entrada, no anclada al nav/footer como el resto de páginas legales/producto.
Confianza: ALTA

### [P1] Nav: CTA principal "Ingresar →" e "Iniciar sesión" apuntan al mismo destino
`src/components/marketing/MarketingNav.tsx:70-75`
```tsx
<Link href="/login" className={styles.loginLink}>Iniciar sesión</Link>
<Link href="/login" className={styles.ctaBtn}>Ingresar →</Link>
```
Dos links con texto distinto, mismo `href`. Cada otro CTA "de conversión" del sitio (Hero, blog, /recursos, SegmentPricing) apunta a `/registro`. El botón destacado (`.ctaBtn`, estilo prominente) del nav —el que un usuario nuevo vería primero— manda a login en vez de registro, rompiendo el funnel de conversión esperado.
Confianza: ALTA

### [P1] CTA "Empezar con {plan}" — mismo texto, dos destinos distintos según página
`src/components/marketing/sections/PricingSection.tsx:100-108` (Home):
```tsx
<a href={`${WA_BASE}?text=${waMsg}`} ...>Empezar con {PLAN_DISPLAY[tier]}</a>
```
`src/components/marketing/sections/segment/SegmentPricing.tsx:71-76` (usado en las 9 /para-[slug] activas):
```tsx
<Link href={`/registro?plan=${tier}`} ...>Empezar con {PLAN_DISPLAY[tier]}</Link>
```
Texto de botón idéntico ("Empezar con Mostrador/Negocio/Pro") — en Home abre WhatsApp, en cada página de segmento va directo a `/registro?plan=X`. Inconsistencia de comportamiento tras el mismo copy, en ~10 páginas distintas.
Confianza: ALTA

### [P1] Segmentos inactivos en DB — huérfanos pero potencialmente indexables
Query directa (`segments`, 12 filas totales):
```
9 activos: carniceria, restaurante, ferreterias, farmacias, tiendas-ropa, abastos, tecnologia, repuestos, servicios
3 inactivos: joyerias, clinicas, gestoria-tramites
```
`src/app/(marketing)/[segmento]/page.tsx:36` filtra `where: { slug, active: true }` → los 3 inactivos devuelven `notFound()` correctamente si alguien escribe la URL a mano (`/para-joyerias`, `/para-clinicas`, `/para-gestoria-tramites`). Esto está bien (no es P0), pero no se verificó si existe un sitemap.xml dinámico que pudiera exponerlos igual — fuera de alcance de archivos listados en este pase. Nota para verificación futura.
Confianza: MEDIA (comportamiento actual correcto; el riesgo es solo si un sitemap.xml no filtrado los expone)

---

## P2 — Contenido / copy

### [P2] Voseo rioplatense — 2 ocurrencias reales, una de alto impacto
`src/app/(marketing)/recursos/page.tsx:32`
```tsx
<h1 className={styles.heroTitle}>Todo lo que necesitás saber sobre ActivoPOS</h1>
```
`src/components/marketing/sections/segment/SegmentFAQ.tsx:16`
```tsx
Todo lo que necesitás saber sobre ActivoPOS para tu {segmentName}
```
`SegmentFAQ` se renderiza en las 9 páginas `/para-[slug]` activas — el voseo aparece simultáneamente en carniceria, restaurante, ferreterias, farmacias, tiendas-ropa, abastos, tecnologia, repuestos y servicios. Alto impacto por reutilización de un solo componente.
Confianza: ALTA

### [P2] Componente huérfano confirmado — `src/app/(marketing)/LandingPage.tsx`
```tsx
export default async function LandingPage() { ... }
```
Grep de `import.*LandingPage` en todo `src/`: **cero resultados** fuera de la propia declaración. El archivo real que Next.js sirve en `/` es `src/app/(marketing)/page.tsx` (que importa `HeroSection`, `PricingSection`, etc., no `LandingPage.tsx`). `LandingPage.tsx` es 100% código muerto, inalcanzable — y además contiene una TERCERA versión de precios, ya obsoleta:
```tsx
// línea 441, 465, 487
<span className={styles.planAmount}>$15</span>  // "Mostrador"
<span className={styles.planAmount}>$25</span>  // "Catálogo Activo"
<span className={styles.planAmount}>$35</span>  // "Pulso"
```
Nombres de planes ("Catálogo Activo", "Pulso") tampoco coinciden con los nombres actuales (`PLAN_DISPLAY`: Mostrador/Negocio/Pro). Recomendación: eliminar el archivo completo — mismo patrón que el precedente EcosystemSection/DT-15 citado en el brief.
Confianza: ALTA (grep exhaustivo, cero importadores)

### [P2] Blog — sanitización correcta, mencionado para cerrar la duda de seguridad
`src/app/(marketing)/blog/[slug]/page.tsx:95, 108`
```tsx
const contentHtml = DOMPurify.sanitize(post.content_html)
...
const jsonLdSafe = JSON.stringify(jsonLd).replace(/</g, '\\u003c')
```
Ambos usos de `dangerouslySetInnerHTML` en el sitio de marketing están correctamente mitigados (DOMPurify para el HTML del post, escape de `<` para el JSON-LD). Confirmado OK, no es un hallazgo — se documenta para que quede registrado en la auditoría de seguridad.
Confianza: ALTA

### [P2] `theme_key` compartido entre segmentos — comportamiento intencional, no bug
`tiendas-ropa` usa `theme_key: 'joyeria'`, `tecnologia` usa `theme_key: 'tropical'`, `repuestos` comparte `'ferreteria'` con `ferreterias`. Inicialmente parecía data entry error; el propio código lo documenta como diseño (`SegmentIcon.tsx:7-9`): *"theme_key se comparte entre negocios distintos (ferreterias/repuestos ambos 'ferreteria') y necesitan verse visualmente diferentes"* — el ícono real se resuelve por `slug` (`SegmentIcon.tsx` tiene mapa propio 1:1 por slug, no por theme_key). Confirmado OK.
Confianza: ALTA

### [P2] `SegmentsMenu.tsx` — mapa de íconos con 13 slugs que no existen en DB
`src/components/marketing/shared/SegmentsMenu.tsx:29-41` define íconos para `panaderia, fruteria, mascotas, papeleria, belleza, muebleria, lavanderia, deportes, mayorista, licoreria, optica, jugueteria, electronica` — ninguno existe en la tabla `segments` actual (12 filas totales, ninguna coincide). No rompe nada (fallback a `Store` nunca se activa para los 9 slugs reales, todos mapeados), pero es preparación especulativa sin uso — código muerto de facto hasta que esos segmentos se creen en DB.
Confianza: ALTA

---

## Rutas auditadas — resumen de cobertura

| Ruta | Archivo | Anclada en nav | Anclada en footer | Precio mostrado | Estado |
|---|---|---|---|---|---|
| `/` | `page.tsx` (función `LandingPage`, no confundir con el archivo huérfano) | — (es home) | — | $9/$19/$29 ✅ | OK |
| `/planes` | `planes/page.tsx` | ❌ (`/#pricing`) | ❌ (`/#pricing`) | $9/$19/$29 ✅ | **P1 huérfana** |
| `/para-carniceria` … `/para-servicios` (9 activos) | `[segmento]/page.tsx` | ✅ (SegmentsMenu) | — | $9/$19/$29 ✅ | OK (con voseo, ver P2) |
| `/para-joyerias`, `/para-clinicas`, `/para-gestoria-tramites` (3 inactivos) | `[segmento]/page.tsx` | ❌ | ❌ | `notFound()` correcto | OK |
| `/segmentos` | `segmentos/page.tsx` | ✅ (vía SegmentsMenu "Ver todos") | ✅ (footer si >6) | — | OK |
| `/faq` | `faq/page.tsx` | ✅ | — | — | OK (ya auditado/corregido sesión previa) |
| `/soporte` (Ayuda) | `soporte/page.tsx` | ✅ | ✅ | — | OK |
| `/contacto` | `contacto/page.tsx` | ✅ | ✅ | — | OK |
| `/terminos` | `terminos/page.tsx` | ❌ | ✅ | menciona "precios en USD" sin monto | OK |
| `/privacidad` | `privacidad/page.tsx` | ❌ | ✅ | — | OK |
| `/nosotros` | `nosotros/page.tsx` | ❌ | ✅ | — | OK |
| `/blog` + `/blog/[slug]` | `blog/page.tsx`, `blog/[slug]/page.tsx` | ✅ | ✅ | — | OK |
| `/recursos` | `recursos/page.tsx` | ✅ | ✅ | **$15/$25/$40 ❌** | **P0** |
| `LandingPage.tsx` | (sin ruta — huérfano) | n/a | n/a | $15/$25/$35 (código muerto) | **P2 eliminar** |

`terminos`, `privacidad` y `nosotros` no están en el nav principal (`MarketingNav.tsx` `NAV_LINKS`) pero sí en el footer (`COMPANY_LINKS`/`LEGAL_LINKS`) — no son huérfanas, es el patrón esperado para páginas legales/institucionales. No se reporta como hallazgo.

---

## OK confirmado (verificado contra código, no asumido)

- Enlaces externos (WhatsApp `wa.me`, Instagram, `syntiweb.com`) — todos usan `target="_blank" rel="noopener noreferrer"` en los archivos leídos.
- `segmentos/page.tsx` construye la URL de fetch desde `NEXT_PUBLIC_APP_URL`, nunca desde el header `Host` — previene SSRF, con comentario explícito en el código.
- DOMPurify + escape de JSON-LD en blog — correctos (ver P2 arriba).
- Ningún Lorem ipsum encontrado en las páginas leídas.
- `plan-limits.ts` es la fuente canónica correcta y CASI todas las páginas la usan correctamente (única excepción: `/recursos`, arriba).
- Copy de `terminos`/`privacidad`/`nosotros` respeta la regla "nunca implicar que ActivoPOS reemplaza la facturación SENIAT" — lo aclara explícitamente en los 2 documentos legales.

---

## ⚠️ HALLAZGO CRÍTICO ADICIONAL — Formulario de contacto posiblemente fake

**[P1 — cero fachadas, corroborado por 2 subagentes independientes]**
`src/app/(marketing)/contacto/ContactForm.tsx:15`
```ts
const FORMSPREE_URL = 'https://formspree.io/f/activopos-contact'
```
Los IDs reales de formulario de Formspree son un hash alfanumérico opaco asignado por su dashboard (ej. `https://formspree.io/f/xrgnkqpj`), NO un slug legible como `activopos-contact`. Esto tiene toda la forma de un placeholder que nunca se conectó a una cuenta Formspree real. Si es así, **el formulario de /contacto falla en silencio**: cada envío devuelve 404 de Formspree, el usuario ve el estado de error genérico ("Hubo un problema al enviar…"), y el negocio nunca recibe el mensaje — un caso textual del "Principio 5 — Cero fachadas" (UI que parece funcionar pero no funciona). Ninguno de los dos subagentes pudo confirmar contra la red real si el endpoint responde; **requiere verificación manual contra la cuenta Formspree de Carlos antes de asumir que /contacto funciona.**
Confianza: MEDIA (no se pudo probar la red real, pero el patrón del ID es sospechoso en los dos análisis independientes)

---

## Auditoría TypeScript (typescript-reviewer — subagente)

**Compilador:** `npx tsc --noEmit` → 0 errores en todo el árbol de marketing (19 archivos en `app/(marketing)`, 25 en `components/marketing`).

### P1 — Componentes huérfanos (código muerto confirmado)
- **`src/app/(marketing)/LandingPage.tsx`** (571 líneas) — corrobora el hallazgo propio arriba. Cero importadores en TODO el repo.
- **`src/components/marketing/shared/RotatingBadge.tsx`** — componente con animación Framer Motion, cero importadores.
- **`src/components/marketing/shared/SegmentPill.tsx`** — cero importadores (su dependencia `SegmentIcon` sí se usa en otros lados, solo este wrapper está muerto).

Todo lo demás bajo `sections/` y `sections/segment/` fue trazado y confirmado vivo (Home importa `DifferentiatorsSection`, `PaymentMethodsSection`, `FeatureTabsSection`, `FinancialBrainSection`, `CatalogShowcaseSection`, etc. — todos con importador real).

### P2 — Tipos duplicados
`interface Segment`/`SegmentListItem`/`ApiSegment` con la MISMA forma (`slug/name/tag_line`) declarada por separado en 4 archivos (`MarketingNav.tsx:9`, `SegmentsMenu.tsx:13`, `segmentos/page.tsx:22`, `SegmentsSection.tsx:8`) en vez de importar un tipo compartido — un rename de campo futuro requiere tocar los 4.

### P2 — Errores silenciados sin logging
`blog/types.ts` (`fetchBlogList`/`fetchBlogPost`), `segmentos/page.tsx` (`getSegments`), `SegmentsSection.tsx` (`getSegments`) — los 4 tragan cualquier error de red con `catch { return null }` sin loguear. Degradación aceptable para UI pública, pero cero visibilidad si el backend empieza a fallar.

### P2 — JSON-LD sin escape consistente
`faq/page.tsx:134`, `page.tsx:48`, `planes/page.tsx:70` inyectan `JSON.stringify(jsonLd)` sin el escape de `</script>` que sí aplica `blog/[slug]/page.tsx:108`. Hoy no explotable (datos 100% hardcodeados), pero el patrón seguro no es uniforme.

### OK confirmado
Cero `any`, cero TODO/Lorem ipsum, `PlanTier`/`BILLING_CYCLES`/`PLAN_DISPLAY` correctamente centralizados y consumidos desde `@/lib/plan-limits` en los 4 archivos que los necesitan.

---

## Auditoría de Seguridad (security-reviewer — subagente)

### P1 — Sin rate limiting en 5 rutas públicas de marketing/blog
`api/blog/route.ts`, `api/blog/[slug]/route.ts`, `api/marketing/segments/route.ts`, `api/marketing/segments/[slug]/route.ts`, `api/marketing/plans/route.ts` — ninguna usa los limiters ya existentes en `src/lib/rate-limit.ts` (patrón ya usado en catálogo). **Viola directamente la regla sellada de CLAUDE.md: "Rate limiting en login y todos los endpoints publicos".** La peor de las 5: `api/blog/[slug]/route.ts:18-21` hace un **write** no autenticado en cada hit (`prisma.blogPost.update({ data: { views: { increment: 1 } } })`) — sin throttle, trivialmente scripteable para generar carga de escritura sostenida o inflar el contador de vistas.
Confianza: ALTA

### P1 — ContactForm sin validación server-side ni control de spam
`contacto/ContactForm.tsx:29-34` — el POST va directo desde el browser a Formspree, sin backend de ActivoPOS en el medio. `noValidate` (línea 58) desactiva la validación nativa del browser y no hay validación JS antes del fetch. Cualquiera puede scriptear POSTs arbitrarios al Formspree ID (bypaseando el form de React) sin ningún control de volumen desde el lado de ActivoPOS. (Ver también el hallazgo del ID sospechoso arriba — si el form ni siquiera es real, este punto es discutible pero se reporta igual por si el ID se corrige.)
Confianza: ALTA

### OK confirmado
- Los 5 usos de `dangerouslySetInnerHTML` en marketing verificados uno por uno — todos seguros (JSON-LD estático o contenido con DOMPurify + escape).
- Contenido de blog confirmado admin-only (`super_admin` + Zod) con AI-generated content en `draft` por defecto — sanitización en render es capa adicional correcta, no la única defensa.
- SSRF: los 3 sitios que arman URLs de fetch interno usan `NEXT_PUBLIC_APP_URL`, nunca headers de la request — sin riesgo.
- Cero secretos hardcodeados en el árbol de marketing.
- Todos los `target="_blank"` llevan `rel="noopener noreferrer"` — sin excepciones.
- Las rutas públicas de marketing/blog solo exponen datos ya públicos (`status: published`/`active: true` server-side), slugs validados con regex — sin IDOR.

---

## Resumen ejecutivo

| Severidad | Cantidad | Acción recomendada |
|---|---|---|
| P0 | 2 | `/recursos` debe leer de `plan-limits.ts` (o sincronizar tabla `plans`) — decisión de arquitectura para CLI-A, no un fix de una línea trivial dado que hay una tabla `plans` en DB compitiendo con el archivo de constantes |
| P1 | 8 | Anclar `/planes` en nav/footer; unificar destino de "Ingresar →"; unificar destino de "Empezar con {plan}"; **verificar si Formspree de /contacto es real**; agregar rate limiting a las 5 rutas públicas de blog/segments/plans (prioridad: la que escribe en DB) |
| P2 | 8 | Corregir voseo (2 archivos); eliminar `LandingPage.tsx`, `RotatingBadge.tsx`, `SegmentPill.tsx` (código muerto); limpiar íconos especulativos en `SegmentsMenu.tsx`; unificar 4 declaraciones duplicadas de `Segment`; loguear errores silenciados; uniformar escape de JSON-LD |

No se corrigió nada en este pase — reporte puro, según instrucción. Total: **18 hallazgos** (2 P0, 8 P1, 8 P2) más el resumen de cobertura de las 14 rutas auditadas.
