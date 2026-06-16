# AGENTS.md — ActivoPOS
# Orquestación de agentes autónomos
# Versión: 1.0 | Junio 2026

## PROYECTO

ActivoPOS — POS SaaS venezolano.
Stack: Next.js 14 + TypeScript + CSS Modules + Prisma + MySQL
Local: C:\laragon\www\activopos\

## LEER SIEMPRE PRIMERO

1. CLAUDE.md — gobernanza, reglas críticas, stack sellado
2. .doc/SYSTEM_MAP.md — estado actual del sistema
3. .doc/DB_SCHEMA.md — modelo de datos canónico

---

## AGENTES DISPONIBLES

| Agente       | Cuándo invocar                                    | Prohibido                          |
|--------------|---------------------------------------------------|------------------------------------|
| @consultant  | Tarea ambigua, decisión arquitectural, análisis   | Escribir código                    |
| @executor    | Tarea clara y definida, implementar spec          | Salirse del scope                  |
| @reviewer    | Post-implementación, auditoría de calidad         | Proponer refactors no pedidos      |
| @debugger    | Error específico diagnosticado                    | Tocar código fuera del error       |
| @designer    | Componentes UI, tokens, diseño de pantallas       | Implementar lógica de negocio      |

## FLUJO DE TRABAJO

```
Tarea ambigua / nueva    →  @consultant primero
Tarea clara y especada   →  @executor directamente
Post-implementación      →  @reviewer
Bug reportado            →  @debugger
Nueva pantalla / UI      →  @designer → @executor → @reviewer
```

---

## VENTANAS CLI PARALELAS

Para máxima velocidad, trabajar con 4 ventanas CLI simultáneas:

```
CLI-A → Arquitectura, API routes, lógica de negocio, Prisma
CLI-B → Componentes UI, CSS Modules, design system
CLI-C → /software-architecture quality gate continuo
CLI-D → /webapp-testing certificación por módulo
```

### Asignación por módulo

| Módulo          | CLI principal | CLI soporte |
|-----------------|--------------|-------------|
| Dashboard       | CLI-B        | CLI-A       |
| Punto de Venta  | CLI-A + CLI-B| CLI-D       |
| Productos       | CLI-A        | CLI-B       |
| Caja            | CLI-A        | CLI-D       |
| Cotizaciones    | CLI-A        | CLI-B       |
| Clientes        | CLI-A        | CLI-B       |
| Reportes        | CLI-B        | CLI-A       |
| Finanzas        | CLI-A        | CLI-B       |
| Configuración   | CLI-A        | CLI-B       |
| Design System   | CLI-B        | CLI-C       |

---

## SKILLS DISPONIBLES EN CLI

```
/software-architecture  → Clean Architecture, SOLID, design patterns
/ui-ux-pro-max          → Design thinking, paletas, tipografía
/impeccable             → Interfaces production-grade
/frontend-design        → Gusto de diseño aplicado al código
/webapp-testing         → Tests con Playwright, certificación
/code-review high       → Revisión exhaustiva de código
/security-review        → OWASP, XSS, inyección SQL
/emil-design-eng        → Polish invisible, animaciones naturales
/web-design-guidelines  → Accesibilidad, UX, mejores prácticas
/performance            → Bundle, lazy load, Core Web Vitals
```

### Cuándo usar cada skill

| Skill                  | Cuándo                                          |
|------------------------|-------------------------------------------------|
| /software-architecture | Antes de diseñar cualquier módulo nuevo         |
| /ui-ux-pro-max         | Al diseñar pantallas o componentes              |
| /impeccable craft      | Cuando una pantalla está lista para pulir       |
| /webapp-testing        | Al certificar cada módulo completado            |
| /code-review high      | Antes de marcar sprint como completado          |
| /security-review       | Antes de cada deploy a producción               |
| /performance           | Al terminar la app antes del primer cliente     |

---

## PROTOCOLO DE SPRINT

### Inicio de sprint
1. Leer CLAUDE.md completo
2. Leer .doc/SYSTEM_MAP.md — estado actual
3. Confirmar módulo objetivo y scope exacto
4. Declarar modo: [DISEÑO] primero, [EJECUCIÓN] después

### Durante el sprint
- Máximo 1 archivo por request salvo instrucción explícita
- Nunca inferir cambios fuera del scope
- Bugs encontrados fuera del scope: reportar en 1 línea, no corregir
- Actualizar SYSTEM_MAP.md al completar cada módulo

### Cierre de sprint
1. /code-review high del diff completo
2. /webapp-testing del módulo
3. Actualizar .doc/SYSTEM_MAP.md con estado nuevo
4. Crear SESSION_HANDOFF con commits y pendientes
5. Push a repo + deploy si corresponde

---

## REGLAS QUE NINGÚN AGENTE PUEDE VIOLAR

- TypeScript strict — cero `any`
- CSS Modules únicamente — cero Tailwind
- Server Components por defecto
- Eager loading Prisma — cero N+1
- Paradigma venta: qty × price (NUNCA bs → qty)
- Sin branch_id en tablas transaccionales
- Moneda: price_usd × rate = total_bs
- NUNCA tocar C:\laragon\www\synticorex\
- NUNCA tocar C:\laragon\www\sportbar\ (solo lectura de referencia)
