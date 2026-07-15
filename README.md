# Prueba de desempeño

Este repositorio contiene la prueba de desempeño y el proyecto objetivo sobre el que se trabaja.

- **[`docs/`](docs/)** — el enunciado de la prueba, en 4 partes.
- **[`project/`](project/)** — el proyecto objetivo: una web app full-stack (gestor de tareas) sobre la que actúa el agente autorreparable. Cuando su suite de tests se rompe, el agente debe diagnosticar, corregir, verificar y repetir hasta recuperar el verde o agotar su presupuesto.

## El enunciado (`docs/`)

Leerlos en orden 1 → 3; el anexo se consulta cuando haga falta.

| # | Archivo | Contenido |
|:--:|---|---|
| 1 | [docs/01-encargo-y-contexto.md](docs/01-encargo-y-contexto.md) | El encargo: premisa, qué construyes, qué decides tú, regla de integridad. |
| 2 | [docs/02-guia-tecnica-y-entorno.md](docs/02-guia-tecnica-y-entorno.md) | Guía técnica: SDK, autenticación, ejecución headless, salvaguardas y el bucle. |
| 3 | [docs/03-entrega-y-rubrica.md](docs/03-entrega-y-rubrica.md) | Entrega y evaluación: qué subes, rúbrica de 100 pts, anti-trampa, piso y techo. |
| 4 | [docs/04-resolucion-de-problemas.md](docs/04-resolucion-de-problemas.md) | Anexo: qué construir, cómo romperlo, dudas frecuentes, problemas técnicos y presupuesto de tiempo. |

## El proyecto objetivo (`project/`)

- **Stack:** TypeScript full-stack — Vite + React (SPA) al front, Fastify + SQLite (better-sqlite3) al back.
- **Tests:** Vitest, suite rápida sobre la capa de dominio y la API.
- **Dominio:** gestor de tareas con login y módulos de tareas y métricas.
- **Almacenamiento:** SQLite local (archivo), sin servicios externos ni credenciales de nube.

Las instrucciones para instalar, levantar la app y correr los tests están en **[`project/README.md`](project/README.md)**.
