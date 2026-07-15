# Agente autorreparable

Agente headless (Python + Claude Agent SDK) que mantiene sano `../project/` sin
intervención humana: corre la suite de tests, y mientras siga en rojo y quede
presupuesto, invoca a Claude para diagnosticar la causa real y corregir el
**código de producto** (nunca los tests), verifica de nuevo y repite.

## Arquitectura

Bucle externo determinista (`self_healer.py`), no un turno largo:

```
correr "npm test" -> ¿verde? -> fin
                 -> rojo -> invocar al agente con la salida del fallo
                          -> correr "npm test" de nuevo -> repetir
```

Cada iteración es una invocación independiente del SDK (`query()`); la
"memoria de intentos" (qué se probó y con qué resultado) se pasa explícita en
el prompt de la siguiente iteración, no depende de mantener una sesión larga.

## Configurar el token

Dos vías, elige una y verifícala antes de correr el agente:

**OAuth (recomendado):**

```bash
claude setup-token
```

Copia el token impreso a `agent/.env` (crea el archivo a partir de
`.env.example`):

```
CLAUDE_CODE_OAUTH_TOKEN=<token>
```

**API key (alternativa):** en vez del anterior, pon en `agent/.env`:

```
ANTHROPIC_API_KEY=<api-key>
```

`agent/.env` está en `.gitignore`: el secreto nunca se sube al repositorio.

## Ejecutarlo

Instalación (una sola vez):

```bash
cd agent
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # y completar el token
npm install --prefix ../project
```

Comando único para correr el agente headless:

```bash
python self_healer.py
```

El proceso termina solo (verde, presupuesto agotado, o no-progreso detectado)
y su exit code es `0` si la suite quedó en verde, distinto de `0` si no.

## Presupuesto y parada

- `AGENT_MAX_ITERATIONS` (default `6`): máximo de invocaciones al agente.
- `AGENT_MAX_SECONDS` (default `900`, 15 min): tope de tiempo de pared.
- `AGENT_NO_PROGRESS_LIMIT` (default `2`): si la "firma" del fallo (hash de
  las líneas de error) no cambia en N iteraciones seguidas, se detiene con
  diagnóstico en vez de seguir intentando a ciegas.

Todos son variables de entorno opcionales, override sin tocar código.

## Salvaguardas (en código, no en el prompt)

Implementadas como hooks `PreToolUse` en `self_healer.py`:

- **Whitelist de herramientas:** solo `Read`, `Grep`, `Glob`, `Edit`, `Bash`.
- **Bash bloqueado por patrón:** `git push`, `git reset --hard`,
  `git checkout --`, `rm -rf`, referencias a `.env`, redirecciones hacia
  `tests/`.
- **Tests protegidos:** cualquier `Edit` sobre archivos bajo `tests/` se
  deniega — el agente no puede "arreglar" debilitando la suite.
- **Scope de rutas:** lecturas y ediciones fuera de `project/` se deniegan
  (evita que el agente lea o toque el `.env` del propio agente u otros
  archivos del sistema).

## Bitácora

Cada corrida escribe `agent/logs/run-<timestamp>.md` de forma incremental
(se escribe mientras el agente trabaja, no al final): estado inicial,
razonamiento y herramientas usadas por iteración, resultado de tests tras
cada intento, y cierre con el motivo de la parada.

## Limitaciones conocidas

Ver [`NOTA.md`](NOTA.md).
