# ECC BRIEFING — ActivoPOS
# Lo que todo agente CLI debe saber antes de su primer prompt
# Versión: 1.0 | Junio 2026 | Carlos Bolívar — SYNTIdev
# Fuente: ECC v2.0.0 (github.com/affaan-m/ECC) + instalación real en ~/.claude/

---

## ¿QUÉ ES ECC Y POR QUÉ LO TIENES?

ECC (Everything Claude Code) es un sistema de optimización de rendimiento para agentes.
No es un framework. No es un conjunto de reglas opcionales. Es infraestructura de agente
instalada globalmente en `~/.claude/` que opera por debajo de tu sesión de trabajo.

Estado instalado confirmado:
- 77 agents activos
- 93 skills activos
- 38 hooks activos
- 2 plugin MCP servers
- 1 plugin LSP server (TypeScript intelligence en tiempo real)

Plugin registrado como: `ecc@ecc` (user scope — aplica a TODOS los proyectos)

---

## ACCIÓN OBLIGATORIA AL INICIAR CADA SESIÓN

```
/instinct-status
```

Este comando carga los patrones aprendidos de sesiones anteriores.
Sin él, operas sin memoria acumulada. No es opcional.

---

## SISTEMA DE MEMORIA — CÓMO FUNCIONA

ECC implementa memoria persistente entre sesiones via 3 hooks automáticos.
No requieren ninguna acción manual de tu parte — operan solos.

| Hook              | Cuándo dispara              | Qué hace                                                      |
|-------------------|-----------------------------|---------------------------------------------------------------|
| `session-start`   | Al abrir Claude Code        | Carga contexto de sesión anterior desde `~/.claude/session-data/` |
| `pre-compact`     | Antes de comprimir contexto | Guarda estado crítico antes de que se comprima la ventana     |
| `session-end`     | Al cerrar sesión            | Persiste aprendizajes, patrones descubiertos, estado pendiente |

### Lo que debes guardar manualmente en sesiones largas

Cuando descubras algo no trivial — un workaround, un patrón específico del proyecto,
una solución a un error repetido — añádelo como skill:

```
# Dentro de Claude Code
"Guarda esto como skill: [descripción del patrón descubierto]"
```

El Stop hook lo persistirá automáticamente al final de la sesión.

### Archivos de sesión

Cada sesión genera un archivo en `~/.claude/session-data/`.
Al inicio de la siguiente sesión, session-start lo carga como contexto.
Contiene: qué funcionó, qué falló, qué quedó pendiente.

---

## HOOKS ACTIVOS — LO QUE OPERA EN SEGUNDO PLANO

Estos 38 hooks se ejecutan automáticamente sin que hagas nada:

### Hooks de calidad de código (post-edit)
- `post-edit-typecheck` — Corre TypeScript check después de cada edición
- `post-edit-console-warn` — Alerta si introduces console.log/debugger
- `post-edit-format` — Formatea automáticamente archivos editados
- `stop-format-typecheck` — TypeScript check + formato al terminar respuesta

### Hooks de calidad de commits (pre-bash)
- `pre-bash-commit-quality` — Antes de git commit: lint + valida formato del mensaje
- `pre-bash-git-push-reminder` — Recuerda verificar antes de push
- `block-no-verify` — Bloquea `git commit --no-verify` (nunca saltar verificaciones)

### Hooks de contexto y memoria
- `pre-compact` — Guarda estado antes de compactar
- `session-start` — Carga contexto previo
- `session-end` — Persiste aprendizajes
- `ecc-context-monitor` — Monitorea uso de ventana de contexto y avisa cuando se degrada

### Hooks de advertencia
- `doc-file-warning` — Alerta si se crean .md/.txt no estándar (protege estructura del repo)
- `pre-write-doc-warn` — Alerta antes de escribir en archivos de documentación

### Hooks de métricas
- `cost-tracker` — Registra costo estimado de cada sesión
- `session-activity-tracker` — Registra actividad para métricas de productividad
- `evaluate-session` — Evaluación de calidad al final de sesión

---

## SUBAGENTES DISPONIBLES — DELEGAR, NO HACER INLINE

ECC instala 77 agentes especializados. Para ActivoPOS, los relevantes son:

### Para CLI-C (Calidad y Auditoría)
En lugar de hacer auditorías inline, delegar via Task tool:

```
# Auditoría TypeScript strict
Task: typescript-reviewer → "Auditar src/app/api/products/ para zero any y tipos explícitos"

# Auditoría de seguridad
Task: security-reviewer → "Verificar que business_id nunca viene del body en todos los endpoints"

# Revisión general de código
Task: code-reviewer → "Revisar implementación de [módulo] contra principios Karpathy"
```

### Para CLI-D (Testing)
```
# Suite E2E
Task: e2e-runner → "Correr suite CIMAAD contra flujo Productos → POS → Caja"
```

### Catálogo completo de subagentes disponibles

Los siguientes agentes están instalados y disponibles via Task tool:

**Arquitectura y código:**
- `architect` — Diseño de arquitectura de sistemas
- `code-architect` — Decisiones de arquitectura de código
- `code-reviewer` — Revisión de calidad general
- `code-simplifier` — Detecta y simplifica código sobrecomplicado
- `code-explorer` — Navega el codebase sin quemar contexto

**Calidad y seguridad:**
- `typescript-reviewer` — TypeScript strict, tipos, generics
- `security-reviewer` — IDOR, secrets, validaciones, JWT
- `a11y-architect` — Accesibilidad web (touch targets, ARIA)
- `build-error-resolver` — Resuelve errores de build TypeScript/Next.js

**Testing:**
- `e2e-runner` — Playwright, flujos E2E
- `agent-evaluator` — Evalúa calidad de outputs de agentes

**Utilidad:**
- `chief-of-staff` — Coordinación multi-agente
- `comment-analyzer` — Analiza comentarios de código
- `conversation-analyzer` — Analiza conversación para extraer decisiones

---

## SKILLS ACTIVOS — REFERENCIA POR CLI

### CLI-A (Backend)
| Skill                  | Cómo invocarlo              | Para qué                                    |
|------------------------|-----------------------------|---------------------------------------------|
| `database-migrations`  | `/database-migrations`      | Migraciones Prisma 7, alter tables MariaDB  |
| `api-design`           | `/api-design`               | Endpoints Next.js 14, REST patterns         |
| `backend-patterns`     | `/backend-patterns`         | Patrones de arquitectura backend            |
| `coding-standards`     | `/coding-standards`         | Estándares TypeScript strict                |
| `security-review`      | `/security-review`          | Revisión de seguridad de APIs               |

### CLI-B (Frontend)
| Skill                  | Cómo invocarlo              | Para qué                                    |
|------------------------|-----------------------------|---------------------------------------------|
| `accessibility`        | `/accessibility`            | Touch targets 44px, ARIA, contraste        |
| `brand-voice`          | `/brand-voice`              | Consistencia de voz y tono en UI            |
| `tdd-workflow`         | `/tdd-workflow`             | Desarrollo guiado por tests en frontend     |

### CLI-C (Calidad)
| Skill                  | Cómo invocarlo              | Para qué                                    |
|------------------------|-----------------------------|---------------------------------------------|
| `security-review`      | `/security-review`          | Auditoría completa de seguridad             |
| `agent-eval`           | `/agent-eval`               | Evaluar outputs de otros agentes            |
| `benchmark-methodology`| `/benchmark-methodology`    | Definir criterios de evaluación verificables|

### CLI-D (Testing / Deploy)
| Skill                  | Cómo invocarlo              | Para qué                                    |
|------------------------|-----------------------------|---------------------------------------------|
| `e2e-testing`          | `/e2e-testing`              | Playwright patterns, Page Object Model      |
| `deployment-patterns`  | `/deployment-patterns`      | PM2 cluster, Nginx, health checks           |
| `ai-regression-testing`| `/ai-regression-testing`    | Regresión automatizada                      |

---

## RULES ACTIVAS (SIEMPRE CARGADAS)

Las siguientes rules de ECC están activas globalmente y complementan el CLAUDE.md:

```
~/.claude/rules/ecc/common/
├── coding-style.md      → Estilo de código universal
├── git-workflow.md      → Workflow git (commit format, branches)
├── testing.md           → Principios de testing
├── performance.md       → Optimización de rendimiento
├── patterns.md          → Patrones de diseño de software
├── hooks.md             → Cómo usar y crear hooks
├── agents.md            → Protocolo multi-agente
└── security.md          → Principios de seguridad universal

~/.claude/rules/ecc/typescript/
└── [TypeScript/Next.js specific patterns]
```

**Regla de precedencia:** En caso de conflicto entre rules ECC y CLAUDE.md del proyecto,
el CLAUDE.md tiene prioridad absoluta. Las rules ECC son principios universales;
el CLAUDE.md es la ley de ActivoPOS.

---

## LSP — TYPESCRIPT INTELLIGENCE EN TIEMPO REAL

El plugin LSP instalado da al agente capacidades que antes no tenía:

- **Type checking en tiempo real** — Detecta errores TypeScript mientras edita, sin esperar build
- **Go-to-definition** — Navega el codebase sin leer archivos completos (ahorra contexto)
- **Completions inteligentes** — Sugiere tipos correctos basado en el schema real
- **Error inline** — Ve errores en el archivo en edición sin correr `npx tsc --noEmit`

Esto es especialmente relevante para CLI-A con Prisma 7 (tipos generados complejos)
y para CLI-B con los módulos CSS y los tipos de componentes.

---

## OPTIMIZACIÓN DE CONTEXTO — REGLAS OPERATIVAS

### Límite de MCPs (crítico)

Máximo 10 MCPs activos por sesión.
Con más de 80 tools activas, la ventana de 200k se degrada a ~70k efectivos.
Antes de una sesión de trabajo intenso, desactivar MCPs no usados.

MCPs activos en ActivoPOS:
- NANOBANANA (imágenes) — desactivar si no se necesita
- 21ST MAGIC (componentes UI) — solo CLI-B
- STITCH (design system) — solo CLI-B
- Gmail / Google Calendar / Google Drive — desactivar en sesiones de código puro

### Gestión de ventana de contexto

El hook `ecc-context-monitor` avisa cuando la ventana se degrada.
Cuando avisa → usar `/clear` para limpiar y continuar desde un archivo de estado.

Para sesiones largas con múltiples módulos:
1. Al terminar un módulo → pedir resumen de estado
2. `/clear` para limpiar contexto
3. Proveer el resumen como contexto inicial del siguiente módulo

### Contextos dinámicos por modo (PowerShell)

```powershell
# Desarrollo activo — contexto mínimo
function claude-dev { claude --system-prompt "$(Get-Content ~/.claude/contexts/dev.md -Raw)" }

# Auditoría — contexto de revisión
function claude-review { claude --system-prompt "$(Get-Content ~/.claude/contexts/review.md -Raw)" }
```

---

## PARALIZACIÓN — CÓMO USAR LOS 4 CLIs CON ECC

### Patrón de fases secuenciales (recomendado)

```
Fase 1: RESEARCH   → CLI-D con code-explorer agent → research-summary.md
Fase 2: PLAN       → Claude Web → plan aprobado por Carlos
Fase 3: IMPLEMENT  → CLI-A (backend) + CLI-B (frontend) en paralelo
Fase 4: REVIEW     → CLI-C con typescript-reviewer + security-reviewer via Task
Fase 5: VERIFY     → CLI-D con e2e-runner → CIMAAD suite
```

### Reglas de paralización

- CLI-A y CLI-B pueden correr en paralelo SOLO cuando sus scopes no se tocan
- CLI-C corre DESPUÉS de CLI-A/B, nunca durante
- CLI-D corre al final, nunca antes de que CLI-A y CLI-B terminen
- Cada CLI usa `/rename [CLI-X — Módulo — Sprint N]` al inicio para identificación

### Git Worktrees para trabajo paralelo real

Cuando CLI-A y CLI-B necesiten tocar el mismo repo simultáneamente:

```powershell
# Crear worktrees separados
git worktree add ..\activopos-backend feature/api-mejoras
git worktree add ..\activopos-frontend feature/ui-mejoras

# CLI-A trabaja en ..\activopos-backend
# CLI-B trabaja en ..\activopos-frontend
# Merge al final por Carlos
```

---

## VERIFICACIÓN — PATRONES DE EVALUACIÓN

### pass@k vs pass^k

ECC define dos métricas de verificación:

| Métrica | Significado                        | Cuándo usar                              |
|---------|------------------------------------|------------------------------------------|
| pass@k  | AL MENOS UNO de k intentos pasa    | Exploración, features nuevas             |
| pass^k  | TODOS los k intentos deben pasar   | Seguridad, paradigma de venta, monetario |

Para ActivoPOS, las reglas críticas usan **pass^k** (consistencia total):
- `business_id` desde `getSession()` — pass^3 mínimo
- Dual moneda USD + Bs — pass^3 mínimo
- `qty × price` nunca `bs → qty` — pass^3 mínimo
- Stock solo en `status='paid'` — pass^3 mínimo

### Checkpoint de verificación antes de commit

```
1. npx tsc --noEmit → 0 errores
2. npm run build → "Compiled successfully"
3. Task: typescript-reviewer → sin any, tipos explícitos
4. Task: security-reviewer → business_id limpio
5. Visual en pantalla por Carlos → aprobación explícita
```

Sin los 5 checkpoints → no existe commit.

---

## CONTINUOUS LEARNING — CÓMO MEJORAR EL SISTEMA

Cuando en una sesión se descubra:
- Un patrón específico de Prisma 7 en MariaDB
- Un workaround para Next.js 14 App Router
- Un error de TypeScript recurrente y su solución
- Un patrón de seguridad venezolano (BCV rate, dual currency)

Decirle al agente explícitamente:
```
"Guarda esto como instinct: [descripción del patrón]"
```

El hook session-end lo persiste automáticamente.
La próxima sesión, `/instinct-status` lo carga.
Así el sistema aprende de cada sprint sin que Carlos tenga que repetir contexto.

---

## REFERENCIA RÁPIDA — COMANDOS ECC ÚTILES

```
/instinct-status          → Carga instincts de sesiones anteriores (OBLIGATORIO al inicio)
/refactor-clean           → Limpia código muerto y .md files huérfanos
/tdd                      → Inicia flujo TDD
/e2e                      → Corre suite E2E
/test-coverage            → Reporte de cobertura
/security-review          → Auditoría de seguridad completa
/rename [nombre]          → Nombra la sesión actual (usar siempre: CLI-X — Módulo — Sprint N)
/clear                    → Limpia contexto (usar entre módulos en sesiones largas)
/fork                     → Bifurca la conversación para exploración paralela
```

---

## LO QUE ECC NO CAMBIA EN ACTIVOPOS

ECC es infraestructura global. No modifica ni reemplaza:

- El CLAUDE.md del repo — sigue siendo la ley de ActivoPOS
- El stack sellado (Next.js 14 + TypeScript + CSS Modules + Prisma 7 + MariaDB)
- El protocolo multi-agente (CLI-A/B/C/D con scopes exclusivos)
- Las reglas de negocio venezolanas (BCV, dual moneda, paradigma venta)
- El bloque de commit estándar
- La certificación CIMAAD como criterio de aprobación

ECC opera EN PARALELO al CLAUDE.md, no encima de él.
Conflicto entre ECC y CLAUDE.md → CLAUDE.md gana siempre.

---

*Documento generado: Junio 2026 | Basado en ECC v2.0.0 instalado en producción*
*Fuente primaria: github.com/affaan-m/ECC — the-longform-guide.md + the-shortform-guide.md*
