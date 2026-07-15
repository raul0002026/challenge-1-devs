# Nota corta

## Alcance

El agente cubre un ciclo completo de auto-reparación sobre `project/`:
diagnóstico desde la salida real de `npm test`, corrección en código de
producto (`src/**`), verificación real (correr la suite de nuevo) y
repetición. No cubre `npm run build` ni el front en el navegador; el
criterio de éxito es exclusivamente la suite de Vitest en verde.

## Criterio de parada

Tres condiciones independientes, la que se cumpla primero corta el bucle:

1. Suite en verde.
2. Presupuesto agotado: `AGENT_MAX_ITERATIONS` (6) invocaciones o
   `AGENT_MAX_SECONDS` (900s) de tiempo de pared.
3. No-progreso: la firma del fallo (hash de las líneas `FAIL`/assert/error)
   se repite `AGENT_NO_PROGRESS_LIMIT` (2) veces seguidas.

## Cómo se evita el bucle infinito

Presupuesto explícito (arriba) + detección de no-progreso. Además, cada
invocación al agente tiene su propio `max_turns` (30) como red de seguridad
para que una sola iteración no se cuelgue internamente.

## Cuando no puede arreglarlo

Se detiene y deja en la bitácora (`agent/logs/run-*.md`) el motivo exacto
(presupuesto agotado o no-progreso), la firma del último fallo, y el
historial de qué se intentó en cada iteración y con qué resultado. No repite
intentos: el prompt de cada iteración incluye el historial previo, y si la
firma no cambió respecto a la iteración anterior se le advierte
explícitamente que no repita la misma corrección.

## Qué faltó por tiempo

- El bloqueo de comandos peligrosos en Bash es por patrón (lista de regex),
  no un sandbox real de shell; es suficiente para el alcance de esta prueba
  pero no es aislamiento a nivel de proceso/filesystem.
- No hay reintento con estrategias explícitamente distintas más allá de la
  advertencia en el prompt (p.ej. no se le fuerza a cambiar de archivo o de
  hipótesis); depende del propio razonamiento del modelo al leer la
  advertencia de no-progreso.
- No se paraleliza ni se exploran múltiples hipótesis de corrección por
  iteración: es un intento por vuelta, secuencial.
