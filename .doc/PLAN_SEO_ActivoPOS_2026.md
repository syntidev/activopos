# PLAN SEO ActivoPOS — Hoja de Ruta Día a Día
**Basado en Google Search Central Documentation (actualizado julio 2026)**
**Dominio:** activopos.com | **Estado inicial:** dominio nuevo, 0 backlinks, GSC verificada

---

## ESTADO ACTUAL (12 julio 2026)

### ✅ Completado en esta sesión
- `llms.txt` — 25 segmentos documentados para agentes IA
- `robots.txt` — ClaudeBot, GPTBot, PerplexityBot, Google-Extended permitidos
- `sitemap.xml` — 35 URLs dinámicas incluyendo todos los segmentos
- Redirect 301 www → apex
- Canonical en todas las páginas
- `SoftwareApplication` schema en homepage
- `FAQPage` schema en los 25 segmentos
- `meta-geo.region: VE` + `meta-geo.placename: Venezuela`
- `meta-robots: max-image-preview:large, max-snippet:-1`
- Brand duplicada eliminada de todos los títulos
- `maximum-scale` eliminado del viewport
- 404 reales (no redirect a /login)
- 300 FAQs únicas por segmento — sin duplicate content
- `meta_title` ≤60 chars en 25 segmentos
- `meta_description` con keywords del giro en venezolano
- synti.dev → activopos.com (primer backlink de calidad)
- ActivoPOS en synti.dev sección SaaS Flagship

### ⚠️ Pendiente técnico
- `X-Powered-By` header expuesto — fix en `next.config.ts`
- ALT faltante en imágenes hero de segmentos
- Twitter card con título genérico (no toma el dinámico del segmento)
- `lastmod` en sitemap idéntico para todas las páginas
- `/planes` no está en sitemap

---

## SEMANA 1 (13-19 julio) — Fundamentos técnicos

### Día 1 — Lunes 13 julio
**Objetivo:** Cerrar fixes técnicos pendientes del audit

**CLI-A ejecuta:**
```
- poweredByHeader: false en next.config.ts
- /planes en sitemap.xml
- twitter:title dinámico en páginas de segmento
- lastmod real en sitemap (fecha updatedAt del segmento)
```

**Tú ejecutas:**
- Ir a GSC → Sitemaps → Agregar `https://activopos.com/sitemap.xml`
- Ir a GSC → URL Inspection → inspeccionar `https://activopos.com` → "Solicitar indexación"
- Repetir con `https://activopos.com/para-carniceria`

**Verificación:**
```
curl -I https://activopos.com | grep -i x-powered
```
No debe aparecer `X-Powered-By: Next.js`

---

### Día 2 — Martes 14 julio
**Objetivo:** ALT en imágenes + directorios de software

**CLI-B ejecuta:**
- Agregar `alt` descriptivo en todas las imágenes hero de segmentos
  - Formato: `alt="Sistema de ventas para carnicerías venezolanas — ActivoPOS"`
- Agregar `alt` en imágenes de la landing principal

**Tú ejecutas (30 minutos):**
1. Crear perfil en **G2.com** → `g2.com/products/new`
   - Categoría: Point of Sale Software
   - Descripción: pegar meta_description de la homepage
   - URL: `activopos.com`
   - País: Venezuela

2. Crear perfil en **Capterra.com** → `capterra.com/vendors/sign-up`
   - Misma info que G2
   - Categoría: POS Software + Inventory Management

3. Crear perfil en **GetApp.com** — mismo grupo que Capterra, un formulario sirve para los dos

---

### Día 3 — Miércoles 15 julio
**Objetivo:** Product Hunt + AlternativeTo

**Tú ejecutas:**
1. **Product Hunt** → `producthunt.com/ships/new`
   - Nombre: ActivoPOS
   - Tagline: "El sistema de ventas e inventario para negocios venezolanos"
   - URL: `activopos.com`
   - Tags: SaaS, POS, Venezuela, Inventory Management
   - Descripción en inglés (Product Hunt es global):
     *"ActivoPOS is a cloud-based POS and inventory system built natively for Venezuelan SMBs. Dual currency (USD/Bs) with automatic BCV rate, digital catalog with WhatsApp checkout, and segment-specific solutions for 25+ business types."*

2. **AlternativeTo** → `alternativeto.net/software/add`
   - Agregar ActivoPOS como alternativa a: Fina, Negotiale, Control Total
   - Esto captura tráfico de gente buscando alternativas a competidores

---

### Día 4 — Jueves 16 julio
**Objetivo:** Directorios venezolanos + CAVECOM

**Tú ejecutas:**
1. **CAVECOM-e** → `cavecom-e.org.ve` — registro como empresa de comercio electrónico venezolana
2. **VenAmCham** → `venamcham.com` — directorio Cámara Venezolano-Americana
3. Buscar en Google: `"directorio empresas tecnología venezuela"` y registrar en los primeros 5 resultados

**Nota:** Estos links pueden tardar semanas en aparecer — pero son geo-relevantes y Google los valora para búsquedas venezolanas.

---

### Día 5 — Viernes 17 julio
**Objetivo:** Blog — primeros artículos SEO

**Tú ejecutas (con NVIDIA NIM o Claude):**

Generar y publicar los primeros 3 artículos del blog. Keywords seleccionadas por intención de búsqueda venezolana:

| Artículo | Keyword target | URL |
|---|---|---|
| "Cómo controlar el inventario de tu negocio en Venezuela sin gastar en software caro" | control inventario venezuela | `/blog/control-inventario-negocio-venezuela` |
| "Cómo cobrar en dólares y bolívares en tu negocio sin calculadora" | cobrar dolares bolivares negocio | `/blog/cobrar-dolares-bolivares-negocio-venezuela` |
| "Qué es un sistema POS y por qué tu bodega lo necesita" | que es sistema pos venezuela | `/blog/que-es-sistema-pos-venezuela` |

Cada artículo debe tener:
- Mínimo 800 palabras
- H1 con la keyword principal
- H2 y H3 con variantes de búsqueda
- Link interno a la página de segmento correspondiente
- CTA al registro al final
- Schema `BlogPosting` (ya implementado)

---

### Fin de semana 19-20 julio
**Revisar en GSC:**
- Coverage → ver cuántas URLs están indexadas
- Performance → primeras impresiones (pueden ser 0 todavía, es normal)
- Inspeccionar 3 URLs de segmento → verificar que Google las ve correctamente

---

## SEMANA 2 (20-26 julio) — Contenido y backlinks

### Día 8 — Lunes 20 julio
**Objetivo:** Guest post en blog venezolano

Buscar en Google: `"blog emprendimiento venezuela" OR "emprendedores venezuela blog"` → elegir el de mayor tráfico → contactar para proponer artículo invitado.

**Tema propuesto:** *"5 errores que cometen los dueños de bodegas venezolanas al controlar el inventario"*

Al final del artículo: mención natural de ActivoPOS con link a `activopos.com/para-abastos`.

Este es el patrón que genera el backlink más valioso: contexto relevante + audiencia venezolana.

---

### Día 9 — Martes 21 julio
**Objetivo:** SoftwareAdvice + Sourceforge

1. **SoftwareAdvice** → `softwareadvice.com/vendor`
2. **SourceForge** → `sourceforge.net/software/vendors`

Ambos permiten perfil gratuito con link dofollow. Audiencia B2B latinoamericana.

---

### Día 10 — Miércoles 22 julio
**Objetivo:** Reddit + comunidades venezolanas

1. Crear cuenta en Reddit si no tienes
2. Participar en `r/vzla` y `r/venezuela` con contenido genuino (NO spam)
   - Buscar threads sobre "negocios venezuela", "bodega", "carniceria"
   - Responder con valor, mencionar ActivoPOS solo cuando sea relevante
3. Buscar grupos de Facebook de emprendedores venezolanos → unirte → participar

**Regla de oro:** Dar valor primero, mencionar el producto después. Ratio 80% contenido útil / 20% mención.

---

### Día 11 — Jueves 23 julio
**Objetivo:** Imágenes hero en Gemini

Generar las primeras 5 imágenes hero con los prompts del documento `prompts_hero_gemini_activopos.md`:
- carniceria, restaurante, ferreterias, farmacias, abastos

**Proceso:**
1. Google AI Studio → Imagen 3
2. Pegar el prompt del segmento
3. Generar 4 variantes → elegir la más natural
4. Guardar como WebP, calidad 90, máx 500KB
5. Subir al VPS: `/var/www/activopos/public/segments/[slug]-hero.webp`
6. Actualizar DB:
```sql
UPDATE segments SET hero_image = '/segments/carniceria-hero.webp' WHERE slug = 'carniceria';
```
7. `pm2 restart activopos`

---

### Día 12 — Viernes 24 julio
**Objetivo:** 2 artículos más en blog

| Artículo | Keyword | URL |
|---|---|---|
| "Sistema POS para carnicerías venezolanas — guía completa 2026" | pos carniceria venezuela | `/blog/sistema-pos-carniceria-venezuela-2026` |
| "Cómo vender por WhatsApp con catálogo digital en Venezuela" | catálogo whatsapp venezuela | `/blog/catalogo-digital-whatsapp-venezuela` |

---

## SEMANA 3-4 (27 julio - 9 agosto) — Escalar

### Semana 3 — Imágenes + blog continuo
- Generar el resto de imágenes hero (20 segmentos restantes)
- Publicar 2 artículos por semana
- Responder comentarios en GSC si aparecen queries

### Semana 4 — PR Digital
**Objetivo:** Aparecer en prensa venezolana

Redactar nota de prensa con este ángulo:
*"Startup venezolana lanza sistema en la nube para controlar ventas en dólares y bolívares — sin necesidad de técnico ni instalación"*

Enviar a:
- `tecnologia@eluniversal.com`
- `economia@elnacional.com`
- `redaccion@elimpulso.com`
- `noticias@lapatilla.com`

Un solo artículo publicado en cualquiera de estos es un backlink de autoridad alta.

---

## MÉTRICAS A MONITOREAR SEMANALMENTE EN GSC

| Métrica | Semana 1 meta | Semana 4 meta | Semana 8 meta |
|---|---|---|---|
| URLs indexadas | 10+ | 30+ | 35 |
| Impresiones totales | 100+ | 500+ | 2,000+ |
| Clics orgánicos | 0-5 | 20+ | 100+ |
| Queries en top 50 | 5+ | 20+ | 50+ |
| Backlinks externos | 3+ | 10+ | 20+ |

---

## REGLAS DE ORO — Google Search Central 2026

Extraídas directamente de `developers.google.com/search/docs`:

1. **Google descubre páginas principalmente por links** — sin backlinks, el crawl es lento
2. **Mobile-first indexing** — Google indexa desde mobile. Verificar en GSC → Mobile Usability
3. **ALT en imágenes** — señal directa de indexación según Google
4. **Core Web Vitals** — tiempo respuesta <0.4s (ActivoPOS tiene 0.31s ✅)
5. **Canonical** — previene que Google elija la versión incorrecta (ya implementado ✅)
6. **Structured data** — SoftwareApplication + FAQPage aumentan elegibilidad para rich snippets
7. **E-E-A-T** — Experience, Expertise, Authoritativeness, Trust. Testimonios reales son la única forma de mejorar esto
8. **llms.txt** — Google lo IGNORA. Sirve para Perplexity, ChatGPT, Claude. No para Google Search
9. **Contenido de calidad** — artículos de 800+ palabras con información genuina del mercado venezolano
10. **AI Overviews** — para aparecer en respuestas IA de Google, la página debe estar indexada y tener snippet habilitado

---

## BACKLINKS — LISTA PRIORIZADA

### Prioridad 1 — Esta semana (gratuito, impacto inmediato)
- [x] `synti.dev` → `activopos.com` ✅ HECHO
- [ ] G2.com perfil
- [ ] Capterra.com perfil
- [ ] GetApp.com perfil
- [ ] Product Hunt lanzamiento
- [ ] AlternativeTo perfil

### Prioridad 2 — Próximas 2 semanas
- [ ] CAVECOM-e directorio
- [ ] VenAmCham directorio
- [ ] SoftwareAdvice perfil
- [ ] SourceForge perfil
- [ ] Guest post blog venezolano #1

### Prioridad 3 — Mes 2
- [ ] Nota de prensa El Universal / El Nacional
- [ ] Entrevista podcast emprendimiento venezolano
- [ ] Guest post blog latinoamericano tech/pymes
- [ ] `ordena.menu` → `activopos.com` (otro producto SYNTIdev)
- [ ] Wikipedia — editar artículo "Punto de venta" con mención verificable

### Prioridad 4 — Largo plazo (3-6 meses)
- [ ] Testimonios de clientes reales → E-E-A-T
- [ ] Estudio de datos propio ("Analizamos X negocios venezolanos...") → backlinks naturales
- [ ] Alianza con asociaciones gremiales venezolanas (carniceros, ferreterías)

---

## CHECKLIST SEMANAL

Cada lunes revisar en GSC:

```
□ Coverage — URLs indexadas vs errores
□ Performance — impresiones, clics, CTR, posición promedio
□ Mobile Usability — errores nuevos
□ Core Web Vitals — degradaciones
□ Manual Actions — penalizaciones (esperemos que nunca)
□ Links — backlinks nuevos detectados
```

Cada viernes publicar:
```
□ Mínimo 1 artículo de blog
□ Mínimo 1 imagen hero nueva
□ Registro en 1 directorio nuevo
```

---

## NOTA FINAL

El SEO de un dominio nuevo tarda 3-6 meses en mostrar resultados significativos. Los primeros 30 días son de crawling e indexación. Los resultados en posiciones visibles (top 20) para keywords competitivas aparecen entre el día 60-90.

Lo que mueve aguja primero: backlinks de calidad + contenido específico del giro en venezolano + tiempo.

Lo que NO mueve aguja: comprar 200 backlinks baratos, keyword stuffing, llms.txt (para Google).

---

*ActivoPOS — Plan SEO v1*
*Generado: 12 julio 2026*
*Fuente: Google Search Central Documentation (actualizado julio 2026)*
*Próxima revisión: 19 julio 2026*
