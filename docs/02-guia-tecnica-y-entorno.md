# Parte 2 — Guía técnica

> Guía técnica: SDK, autenticación, ejecución headless, salvaguardas y el bucle. El encargo está en [01](01-encargo-y-contexto.md) y la entrega y evaluación en [03](03-entrega-y-rubrica.md).

## SDK

Construyes con el **Claude Agent SDK** (Python o TypeScript). La prueba asume que usas la documentación:

| Recurso | URL |
|---|---|
| Overview | `https://code.claude.com/docs/en/agent-sdk/overview` |
| Quickstart (agente que corrige errores) | `https://code.claude.com/docs/en/agent-sdk/quickstart` |
| Índice de la documentación | `https://code.claude.com/docs/llms.txt` |

El quickstart ya construye un agente que corrige errores: es tu punto de partida, no empieces en blanco.

## Autenticación

Elige una vía y **verifícala antes de construir**:

- **OAuth (recomendado):** genera el token con `claude setup-token`, consúmelo por `CLAUDE_CODE_OAUTH_TOKEN`.
- **API key (alternativa):** `ANTHROPIC_API_KEY`.

El secreto **nunca** se sube al repositorio ni se pega en el código: se inyecta por entorno (`.env`
ignorado por git, o un gestor de secretos). Son **dos autenticaciones distintas**: la de Anthropic (para
que el agente funcione) y la de **GitHub** (para el push de la entrega). No las confundas.

## Ejecución headless

El agente corre **headless** (desatendido): se invoca **una vez** y trabaja solo hasta su parada. "Una
vez" es un comando del operador, no una sola llamada al modelo. Dos arquitecturas válidas para el ciclo:

- **(A) Bucle externo (recomendado):** un `while` corre los tests → si están en verde corta, si están en
  rojo invoca al agente con la salida del fallo → repite. Control determinista y auditable del
  presupuesto y la convergencia.
- **(B) Turno largo:** una `query()` con Bash y un system prompt que instruye "itera hasta el verde o N
  intentos, registrando cada paso". Más frágil en convergencia y presupuesto.

## Aprovecha el SDK (no reimplementes)

- **Herramientas integradas:** `Bash` corre tests/build, `Read`/`Grep` diagnostican, `Edit` aplica la corrección.
- **`allowed_tools` / permisos:** acotan **en código** lo que el agente puede hacer (mínimo privilegio).
- **Hooks (`PreToolUse`):** bloquean una llamada a herramienta antes de ejecutarse (p.ej. `git push`,
  `rm -rf`, editar tests). Las salvaguardas van **en código, no en el prompt** (lo evalúa la rúbrica).

## Entorno reproducible y bucle que converge

Un tercero debe **clonar → configurar el token → ejecutar un comando → ver al agente**. Implica:
dependencias fijadas (lockfile), sin rutas absolutas, comando único en el README.

Lista de control para que el bucle puntúe (no está en el enunciado, es orientación):

1. **Rojo inicial comprobado:** confirma que la suite falla antes de invocar al agente.
2. **Presupuesto explícito:** máximo de iteraciones y/o tokens y/o tiempo. Documenta el número y el porqué.
3. **Detección de no-progreso:** guarda la "firma" del fallo; si no cambia en K iteraciones, cambia de
   estrategia o **detente con diagnóstico**.
4. **Memoria de intentos:** vuelve a pasarle al contexto qué probaste y su resultado, para no repetir la
   misma corrección.
5. **Bitácora incremental:** escribe el registro mientras se ejecuta, no al final.
