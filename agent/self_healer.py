"""Agente autorreparable para project/ (gestor de tareas).

Arquitectura: bucle externo determinista (Python) + una invocacion del Claude
Agent SDK por iteracion. El bucle corre "npm test", y si falla, invoca al
agente con la salida real del fallo; el agente diagnostica y corrige codigo
de PRODUCTO (no tests), el bucle vuelve a correr los tests y repite hasta
verde o hasta agotar presupuesto.
"""

import asyncio
import hashlib
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    HookMatcher,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    query,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

AGENT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = (AGENT_DIR / ".." / "project").resolve()
TESTS_DIR = (PROJECT_DIR / "tests").resolve()

# --- Presupuesto (criterio de parada explicito) ---------------------------
MAX_ITERATIONS = int(os.environ.get("AGENT_MAX_ITERATIONS", "6"))
MAX_SECONDS = int(os.environ.get("AGENT_MAX_SECONDS", str(15 * 60)))
MAX_TURNS_PER_ITERATION = int(os.environ.get("AGENT_MAX_TURNS", "30"))
# Si la "firma" del fallo no cambia en N iteraciones seguidas, se detiene:
# es la senal de que la correccion no ataca la causa (no-progreso).
NO_PROGRESS_LIMIT = int(os.environ.get("AGENT_NO_PROGRESS_LIMIT", "2"))

ALLOWED_TOOLS = ["Read", "Grep", "Glob", "Edit", "Bash"]

# --- Salvaguardas en codigo (no en el prompt) ------------------------------
DANGEROUS_BASH_PATTERNS = [
    r"git\s+push",
    r"git\s+reset\s+--hard",
    r"git\s+checkout\s+--",
    r"git\s+clean\s+-f",
    r"\brm\s+-rf\b",
    r"\brm\s+-fr\b",
    r"\.env\b",
    r">\s*tests?[\\/]",
]


def _resolve_path(raw_path: str) -> Path | None:
    if not raw_path:
        return None
    p = Path(raw_path)
    if not p.is_absolute():
        p = PROJECT_DIR / p
    try:
        return p.resolve()
    except OSError:
        return None


async def hook_tool_whitelist(input_data, tool_use_id, context):
    """Deniega cualquier herramienta fuera del set minimo autorizado."""
    if input_data["tool_name"] not in ALLOWED_TOOLS:
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    f"Herramienta '{input_data['tool_name']}' fuera del set "
                    "de minimo privilegio para este agente."
                ),
            }
        }
    return {}


async def hook_block_dangerous_bash(input_data, tool_use_id, context):
    command = input_data.get("tool_input", {}).get("command", "")
    for pattern in DANGEROUS_BASH_PATTERNS:
        if re.search(pattern, command, flags=re.IGNORECASE):
            return {
                "hookSpecificOutput": {
                    "hookEventName": input_data["hook_event_name"],
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        f"Comando bloqueado por patron de seguridad: '{pattern}'. "
                        "No se permiten operaciones destructivas, push, ni tocar "
                        "tests o secretos desde Bash."
                    ),
                }
            }
    return {}


async def hook_protect_tests_and_scope(input_data, tool_use_id, context):
    """Bloquea edicion de tests/ y cualquier ruta fuera de project/."""
    file_path = input_data.get("tool_input", {}).get("file_path", "")
    resolved = _resolve_path(file_path)
    if resolved is None:
        return {}
    if TESTS_DIR in resolved.parents or resolved == TESTS_DIR:
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    "No se permite editar archivos de tests. La correccion "
                    "debe atacar la causa en el codigo de producto."
                ),
            }
        }
    if PROJECT_DIR not in resolved.parents and resolved != PROJECT_DIR:
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "deny",
                "permissionDecisionReason": "Ruta fuera del proyecto objetivo.",
            }
        }
    return {}


async def hook_scope_reads(input_data, tool_use_id, context):
    """Confina Read/Grep/Glob al directorio del proyecto (evita fugas del secreto)."""
    tool_input = input_data.get("tool_input", {})
    raw_path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not raw_path:
        return {}
    resolved = _resolve_path(raw_path)
    if resolved is None:
        return {}
    if PROJECT_DIR not in resolved.parents and resolved != PROJECT_DIR:
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    "Lectura fuera del proyecto objetivo no permitida "
                    "(evita fuga del token/secreto del agente)."
                ),
            }
        }
    return {}


def build_hooks():
    return {
        "PreToolUse": [
            HookMatcher(hooks=[hook_tool_whitelist]),
            HookMatcher(matcher="Bash", hooks=[hook_block_dangerous_bash]),
            HookMatcher(matcher="Edit", hooks=[hook_protect_tests_and_scope]),
            HookMatcher(matcher="Read|Grep|Glob", hooks=[hook_scope_reads]),
        ]
    }


# --- Runner de tests --------------------------------------------------------

def run_tests() -> tuple[bool, str]:
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    try:
        proc = subprocess.run(
            [npm_cmd, "test"],
            cwd=str(PROJECT_DIR),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or "") + (exc.stderr or "") + "\n[TIMEOUT corriendo npm test]"
        return False, output
    output = (proc.stdout or "") + "\n" + (proc.stderr or "")
    return proc.returncode == 0, output


def truncate(text: str, limit: int = 6000) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n...[truncado, {len(text) - limit} caracteres omitidos]"


FAILURE_LINE_RE = re.compile(r"(?:^|\n)\s*(?:×|FAIL|AssertionError|Error:).*", re.IGNORECASE)


def failure_signature(test_output: str) -> str:
    """Hash estable de las lineas de fallo: detecta si dos corridas fallan por lo mismo."""
    lines = FAILURE_LINE_RE.findall(test_output)
    if not lines:
        lines = [test_output[-2000:]]
    normalized = "\n".join(sorted(line.strip() for line in lines))
    return hashlib.sha256(normalized.encode("utf-8", errors="ignore")).hexdigest()[:12]


# --- Bitacora incremental ----------------------------------------------------

class Logger:
    """Escribe a archivo (y a stdout) linea por linea, mientras el bucle corre."""

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = open(self.path, "a", encoding="utf-8")

    def write(self, text: str):
        self._fh.write(text + "\n")
        self._fh.flush()
        print(text)

    def close(self):
        self._fh.close()


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --- Invocacion del agente ---------------------------------------------------

def build_prompt(test_output: str, attempts: list[dict], warn_same_failure: bool) -> str:
    history_block = "Sin intentos previos."
    if attempts:
        lines = []
        for a in attempts:
            lines.append(
                f"- Iteracion {a['iteration']}: firma={a['signature']} -> "
                f"acciones: {a['actions_summary']} -> resultado: {a['result']}"
            )
        history_block = "\n".join(lines)

    warning = ""
    if warn_same_failure:
        warning = (
            "\nADVERTENCIA: el intento anterior NO cambio la firma del fallo "
            "(mismo error persiste). No repitas el mismo cambio: reconsidera "
            "la causa raiz y prueba una estrategia distinta.\n"
        )

    return f"""Estas en el repositorio de un gestor de tareas (TypeScript: Fastify+SQLite en
el backend, Vite+React en el frontend, tests con Vitest). El directorio de
trabajo es la raiz del proyecto ({PROJECT_DIR}). La suite de tests
('npm test') esta fallando. Tu tarea:

1. Diagnostica la causa real leyendo la salida de los tests de abajo y el
   codigo fuente relevante en src/ (dominio, api o web segun corresponda).
2. Aplica UNA correccion en el CODIGO DE PRODUCTO (src/**) que ataque la
   causa raiz. No edites archivos bajo tests/.
3. No hardcodees el valor que el test espera; corrige el comportamiento real
   (contrato de funcion, validacion, borde no manejado, import roto, etc).
4. Se breve: al terminar, resume en 2-3 lineas que cambiaste y por que.

Salida real de la ultima corrida de 'npm test':
```
{truncate(test_output)}
```
{warning}
Historial de intentos previos en este ciclo de reparacion:
{history_block}
"""


async def run_agent_iteration(prompt: str, logger: Logger) -> tuple[str, float, int]:
    """Ejecuta una invocacion del SDK y devuelve (resumen_acciones, costo_usd, num_turns)."""
    options = ClaudeAgentOptions(
        cwd=str(PROJECT_DIR),
        allowed_tools=ALLOWED_TOOLS,
        permission_mode="bypassPermissions",
        max_turns=MAX_TURNS_PER_ITERATION,
        hooks=build_hooks(),
        system_prompt=(
            "Eres un agente de reparacion autonomo. Arreglas la causa raiz en "
            "codigo de producto. Nunca editas tests ni debilitas validaciones."
        ),
    )

    actions: list[str] = []
    cost = 0.0
    num_turns = 0

    async for message in query(prompt=prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock) and block.text.strip():
                    logger.write(f"  [razonamiento] {block.text.strip()[:500]}")
                    actions.append(f"dijo: {block.text.strip()[:120]}")
                elif isinstance(block, ToolUseBlock):
                    detail = ""
                    if block.name == "Edit":
                        detail = f" file={block.input.get('file_path', '')}"
                    elif block.name == "Bash":
                        detail = f" cmd={block.input.get('command', '')[:120]}"
                    logger.write(f"  [herramienta] {block.name}{detail}")
                    actions.append(f"{block.name}{detail}")
        elif isinstance(message, ResultMessage):
            cost = message.total_cost_usd or 0.0
            num_turns = message.num_turns
            logger.write(
                f"  [resultado agente] subtype={message.subtype} "
                f"is_error={message.is_error} turnos={num_turns} costo=${cost:.4f}"
            )

    summary = "; ".join(actions[-6:]) if actions else "(sin acciones registradas)"
    return summary, cost, num_turns


# --- Bucle principal ---------------------------------------------------------

async def main():
    load_dotenv(AGENT_DIR / ".env")

    if not os.environ.get("CLAUDE_CODE_OAUTH_TOKEN") and not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "Falta autenticacion: define CLAUDE_CODE_OAUTH_TOKEN o ANTHROPIC_API_KEY "
            "(agent/.env o variable de entorno). Ver agent/.env.example.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not (PROJECT_DIR / "node_modules").exists():
        print(
            f"No existen node_modules en {PROJECT_DIR}. Corre 'npm install' ahi "
            "antes de ejecutar el agente.",
            file=sys.stderr,
        )
        sys.exit(1)

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    logger = Logger(AGENT_DIR / "logs" / f"run-{run_id}.md")
    total_cost = 0.0

    logger.write(f"# Bitacora de reparacion autonoma — {now()}")
    logger.write(
        f"\nPresupuesto: max_iteraciones={MAX_ITERATIONS}, "
        f"max_segundos={MAX_SECONDS}, no_progreso_limite={NO_PROGRESS_LIMIT}\n"
    )

    start = time.monotonic()

    logger.write("## Chequeo inicial\n")
    passed, output = run_tests()
    logger.write(f"- `npm test` inicial: {'VERDE' if passed else 'ROJO'}")
    if passed:
        logger.write(
            "\nLa suite ya esta en verde antes de invocar al agente. Se esperaba "
            "un rojo inicial inyectado; no hay nada que reparar. Abortando."
        )
        logger.close()
        return

    logger.write("```\n" + truncate(output, 3000) + "\n```\n")

    attempts: list[dict] = []
    signatures: list[str] = []
    final_state = "presupuesto de iteraciones agotado"

    for iteration in range(1, MAX_ITERATIONS + 1):
        elapsed = time.monotonic() - start
        if elapsed > MAX_SECONDS:
            final_state = f"presupuesto de tiempo agotado ({elapsed:.0f}s)"
            break

        sig = failure_signature(output)
        recent = signatures[-(NO_PROGRESS_LIMIT - 1):] if NO_PROGRESS_LIMIT > 1 else []
        if len(recent) == NO_PROGRESS_LIMIT - 1 and all(s == sig for s in recent):
            logger.write(
                f"\n## Deteccion de no-progreso en iteracion {iteration}\n\n"
                f"La firma del fallo (`{sig}`) se repite {NO_PROGRESS_LIMIT} veces "
                "seguidas: la correccion no ataca la causa real. Me detengo con "
                "diagnostico en vez de seguir intentando a ciegas.\n"
            )
            final_state = "detenido por no-progreso (firma de fallo repetida)"
            break

        warn_same = bool(signatures) and signatures[-1] == sig
        logger.write(f"\n## Iteracion {iteration} — {now()}\n")
        logger.write(f"- Firma del fallo: `{sig}`")

        prompt = build_prompt(output, attempts, warn_same)
        actions_summary, cost, num_turns = await run_agent_iteration(prompt, logger)
        total_cost += cost

        passed, output = run_tests()
        result_text = "VERDE" if passed else "sigue en ROJO"
        logger.write(f"- Resultado tras la correccion: {result_text}")

        attempts.append(
            {
                "iteration": iteration,
                "signature": sig,
                "actions_summary": actions_summary,
                "result": result_text,
            }
        )
        signatures.append(sig)

        if passed:
            final_state = f"verde alcanzado en iteracion {iteration}"
            break

    elapsed_total = time.monotonic() - start
    logger.write(
        f"\n## Cierre — {now()}\n\n"
        f"- Estado final: {final_state}\n"
        f"- Iteraciones usadas: {len(attempts)} / {MAX_ITERATIONS}\n"
        f"- Tiempo total: {elapsed_total:.0f}s / {MAX_SECONDS}s\n"
        f"- Costo total estimado: ${total_cost:.4f}\n"
        f"- Suite final: {'VERDE' if passed else 'ROJO'}\n"
    )
    logger.close()

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
