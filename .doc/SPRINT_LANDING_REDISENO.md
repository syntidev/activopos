# SPRINT — Rediseño Landing ActivoPOS
## Estado: PENDIENTE | Prioridad: Post-demo 11 Jul | Skill: emil-design-eng

---

## DIAGNÓSTICO

La landing actual comunica "SaaS genérico" en lugar de "solución venezolana cercana".
El problema no es la paleta — ya existe y es correcta. El problema es la jerarquía de uso.

**Problema raíz:** Navy oscuro domina hero + testimonios + footer simultáneamente.
Resultado: tensión visual donde debería haber confianza y cercanía.

---

## REGLAS VISUALES PARA LA LANDING PÚBLICA

| Elemento | Estado actual | Debe ser |
|----------|--------------|----------|
| Hero fondo | `#0D1B2E` navy | `#FAFBFC` o `#EEEDF4` |
| Secciones intermedias | Navy | `#FFFFFF` alternando `#EEF2FF` |
| Testimonios | Cards oscuras | Cards blancas, fondo `#FAFBFC` |
| Franja azul "nunca más..." | Azul sólido `#0038BD` | Panel claro con acento lateral |
| CTA final | Ámbar sobre oscuro | `#EF8E01` sobre fondo claro |
| Footer | Navy casi negro | `#0D1B2E` — respira, menos denso |
| Login | Navy `#0D1B2E` | Se mantiene — es puerta al sistema |
| Dashboard | Dark heredado del tenant | Se mantiene |

**Distribución visual objetivo:**
- 65–70% fondos claros: `#FFFFFF`, `#FAFBFC`, `#EEEDF4`
- 15–20% azul suave: `#DCE6FF` para bloques, pills, fondos de apoyo
- 10–12% azul marca: `#0038BD` para titulares, botones, microdetalles
- 3–5% CTA ámbar: `#EF8E01` — una acción dominante por viewport

---

## DIAGNÓSTICO POR SECCIÓN

### 1. Hero
**Problema:** Fondo navy genera tensión visual — sirve para fintech, no para POS venezolano cercano.
**Fix:**
- Fondo base: `#FAFBFC` o `#EEEDF4`
- Manchas suaves `#DCE6FF` al 20-35% opacidad
- Headline en `#0038BD` o casi negro textual
- Mockup del producto sobre card blanca con sombra suave
- CTA primario: "Empezar gratis" → `/registro`
- CTA secundario: "Ver demostración" → WhatsApp

**Copy B2H:**
- ❌ "Tu negocio activo"
- ✅ "Cobra, controla y repón sin enredarte"
- ✅ "Hecho para vender en Venezuela como se vende de verdad"

### 2. Beneficios iniciales
**Fix:**
- Fondo blanco
- Íconos Lucide sin círculos decorativos exagerados
- Brand-soft `#DCE6FF` para badges
- Lenguaje operacional: cobro, caja, inventario, reposición, tasa, reporte

### 3. Sección producto / "Cada producto como realmente es"
**Fix:**
- Fondo `#FAFBFC`
- Card demo con más contraste
- Título: "Tu inventario deja de ser una adivinanza"
- 3 microbeneficios junto a la demo

### 4. Dolor / fricción operativa
**Fix:**
- Fondo `#EEEDF4`
- Cards blancas con borde tenue
- Patrón por item: problema visible → costo diario → alivio concreto

**Copy B2H:**
- "Vendes, pero no sabes qué te quedó"
- "Cobras, pero después cuadras a ojo"
- "Repones tarde porque no ves qué salió"

### 5. Comparativa manual vs ActivoPOS
**Fix:**
- Columna izquierda: "Así se te va hoy" (no "método tradicional")
- Columna derecha: "Así trabajas con ActivoPOS" (no "solución")
- Fondo blanco con `#DCE6FF` en encabezados

### 6. Franja azul "Nunca más calcules bolívares a mano"
**Fix:**
- Convertir en panel claro con acento azul lateral o badge superior
- Reservar azul intenso para el número clave, no para el fondo completo

### 7. Planes / Pricing
**Fix:**
- Plan recomendado: borde `#0038BD`, fondo blanco (no bloque oscuro)
- Copy de desriesgo:
  - "Empieza donde estás"
  - "No cambias tu forma de vender de golpe"
  - "Tu operación sigue. Solo la ordenas"

### 8. Testimonios
**Fix:**
- Fondo `#FAFBFC` o `#EEEDF4`
- Cards blancas
- Más contexto real: rubro, ciudad, tipo de operación
- Copy:
  - ❌ "Excelente sistema"
  - ✅ "Ahora sí sabemos qué salió y qué quedó"
  - ✅ "Dejamos de resolver por WhatsApp y libreta"

### 9. CTA Final
**Fix:**
- `#EF8E01` sobre base clara (no franja naranja gigante)
- Copy:
  - "Te mostramos cómo se adapta a tu negocio"
  - "Ve cómo cobrar, controlar y reponer sin cambiar toda tu operación"

### 10. Footer
**Fix:**
- Fondo `#0D1B2E` máximo — no casi negro
- Menos densidad de links
- Más respiración y claridad de contacto

---

## LOGIN — SPRINT SEPARADO

El login va después de la landing. Es la puerta al sistema interno.

**Concepto:** Split-screen desktop
- Columna izquierda (60%): Marca — logo, tagline, 3 beneficios con íconos Lucide, gradiente `#0D1B2E` → `#0D2547`
- Columna derecha (40%): Formulario — card blanca elevada, email + password, botón Persian Blue, link a `/registro`
- Mobile: solo columna derecha con logo pequeño arriba

**Regla irrompible:** Login siempre dark navy — es la puerta al sistema, no al marketing.

---

## COPY B2H — PRINCIPIOS

Hablarle al dueño/encargado que piensa:
- "¿Cuánto vendí hoy?"
- "¿Qué me quedó?"
- "¿A cuánto estoy cobrando?"
- "¿Qué tengo que reponer?"
- "¿Esto me complica o me ayuda?"

**Reglas de tono:**
- Español venezolano neutro-comercial
- Sin rastro rioplatense
- Sin jerga startup
- Directo, útil, sin grandilocuencia
- Verbos de acción: cobras, vendes, cierras, repones, ves, controlas

---

## SKILL DISPONIBLE

`emil-design-eng` — instalada globalmente en Claude Code
Usar en todos los prompts de CLI-B para este sprint:
`/emil-design-eng` al inicio del prompt

---

## ORDEN DE IMPLEMENTACIÓN

1. Hero + CTA final → mayor impacto en conversión
2. Testimonios → humanizar
3. Franja azul intermedia → bajar agresividad
4. Footer → aligerar
5. Copy B2H sección por sección
6. Login split-screen
7. Segmentos faltantes en DB

---

## ARCHIVOS A TOCAR

```
src/app/(marketing)/page.tsx
src/components/marketing/sections/HeroSection.tsx
src/components/marketing/sections/TestimonialsSection.tsx
src/components/marketing/sections/PricingSection.tsx
src/components/marketing/sections/CTASection.tsx
src/components/marketing/sections/FooterSection.tsx
src/app/login/page.tsx
src/app/login/login.module.css
public/tokens.css → NO TOCAR — solo consumir tokens existentes
```

---

## RIESGOS

| Riesgo | Mitigación |
|--------|-----------|
| Suavizar demasiado y perder autoridad | Mantener `#0038BD` en titulares y botones |
| Web bonita pero genérica | Anclar cada sección a problema venezolano real |
| Exceso de ámbar | Un CTA dominante por viewport — regla sellada |
| Mezclar reglas dashboard con landing | Separar contextos explícitamente en CSS Modules |

---

*Generado: 2026-07-08 | Sprint 80 | Para ejecutar post-demo 11 Jul*
