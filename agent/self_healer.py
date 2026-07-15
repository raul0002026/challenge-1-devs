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
from pathlib import Path

from dotenv import load_dotenv

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    query,
)

AGENT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = (AGENT_DIR / ".." / "project").resolve()

# --- Presupuesto (criterio de parada explicito) ---------------------------
MAX_ITERATIONS = int(os.environ.get("AGENT_MAX_ITERATIONS", "6"))
MAX_SECONDS = int(os.environ.get("AGENT_MAX_SECONDS", str(15 * 60)))
MAX_TURNS_PER_ITERATION = int(os.environ.get("AGENT_MAX_TURNS", "30"))
# Si la "firma" del fallo no cambia en N iteraciones seguidas, se detiene:
# es la senal de que la correccion no ataca la causa (no-progreso).
NO_PROGRESS_LIMIT = int(os.environ.get("AGENT_NO_PROGRESS_LIMIT", "2"))

ALLOWED_TOOLS = ["Read", "Grep", "Glob", "Edit", "Bash"]


# --- Runner de tests --------------------------------------------------------

def run_tests() -> tuple[bool, str]:
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    try:
        proc = subprocess.run(
            [npm_cmd, "test"],
            cwd=str(PROJECT_DIR),
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or "") + (exc.stderr or "") + "\n[TIMEOUT corriendo npm test]"
        return False, output
    output = proc.stdout + "\n" + proc.stderr
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


async def run_agent_iteration(prompt: str) -> str:
    options = ClaudeAgentOptions(
        cwd=str(PROJECT_DIR),
        allowed_tools=ALLOWED_TOOLS,
        permission_mode="acceptEdits",
        max_turns=MAX_TURNS_PER_ITERATION,
    )

    actions: list[str] = []

    async for message in query(prompt=prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock) and block.text.strip():
                    print(f"  [razonamiento] {block.text.strip()[:500]}")
                    actions.append(f"dijo: {block.text.strip()[:120]}")
                elif isinstance(block, ToolUseBlock):
                    print(f"  [herramienta] {block.name}")
                    actions.append(block.name)
        elif isinstance(message, ResultMessage):
            print(f"  [resultado agente] subtype={message.subtype} is_error={message.is_error}")

    return "; ".join(actions[-6:]) if actions else "(sin acciones registradas)"


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

    start = time.monotonic()

    passed, output = run_tests()
    print(f"npm test inicial: {'VERDE' if passed else 'ROJO'}")
    if passed:
        print("La suite ya esta en verde antes de invocar al agente. Abortando.")
        return

    attempts: list[dict] = []
    signatures: list[str] = []

    for iteration in range(1, MAX_ITERATIONS + 1):
        if time.monotonic() - start > MAX_SECONDS:
            print("Presupuesto de tiempo agotado.")
            break

        sig = failure_signature(output)
        recent = signatures[-(NO_PROGRESS_LIMIT - 1):] if NO_PROGRESS_LIMIT > 1 else []
        if len(recent) == NO_PROGRESS_LIMIT - 1 and all(s == sig for s in recent):
            print(
                f"No-progreso: la firma del fallo ({sig}) se repite "
                f"{NO_PROGRESS_LIMIT} veces seguidas. Me detengo con diagnostico."
            )
            break

        warn_same = bool(signatures) and signatures[-1] == sig
        print(f"\n== Iteracion {iteration} (firma={sig}) ==")
        prompt = build_prompt(output, attempts, warn_same)
        actions_summary = await run_agent_iteration(prompt)

        passed, output = run_tests()
        result_text = "VERDE" if passed else "sigue en ROJO"
        print(f"Resultado tras la correccion: {result_text}")

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
            break

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
