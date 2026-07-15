# Gestor de tareas — proyecto objetivo (EVAL-DEV-1)

Web app full-stack mínima pero real: un gestor de tareas con login, tablero de tareas
(crear, editar, eliminar, avanzar de estado, filtrar) y un panel de métricas.

## Stack

- **Front:** Vite + React 18 (SPA, TypeScript).
- **Back:** Fastify 4 + SQLite vía `better-sqlite3`.
- **Tests:** Vitest (modo run) — dominio puro + API vía `inject` con SQLite en memoria.
- **Auth:** scrypt (`node:crypto`) para el hash de contraseña, token de sesión firmado con HMAC.
- **Runtime:** Node LTS (ver `.nvmrc` / `engines`).

## Arquitectura por capas

```
src/
  domain/   # lógica de negocio PURA y testeable (auth, tasks, metrics). Sin DB ni Fastify.
  db/       # esquema SQLite + repositorios + seed demo
  api/      # Fastify: buildServer(db) + rutas (auth, tasks, metrics) con auth por bearer token
  web/      # SPA React (login, tablero de tareas, panel de métricas)
tests/      # Vitest: unit de dominio + API end-to-end
```

La API se construye con `buildServer(db)` para poder testearla con `app.inject` y una DB
SQLite `:memory:`, sin abrir puertos ni tocar el disco.

## Credenciales demo

Al levantar el backend por primera vez se crea una DB local (`data/app.db`) y, si está vacía,
se siembra un usuario demo con tareas variadas (distintos estados, prioridades y vencimientos,
algunas vencidas) para que la UI no arranque vacía:

- **Email:** `demo@factorit.com`
- **Password:** `demo1234`

El seed solo corre en el entrypoint con DB de archivo; los tests usan SQLite en memoria.

## Cómo correr

Guía para alguien que ve el proyecto por primera vez.

### Requisitos

- Node LTS (ver `.nvmrc`: versión **24**). Con `nvm` basta `nvm use`.
- `npm` (viene con Node).

### Levantar la app

```bash
npm install   # instala dependencias (lockfile fijado)
npm run dev   # levanta API (:3001) + Vite (:5173) en paralelo
```

Luego abre `http://localhost:5173` en el navegador. Las llamadas a `/api/*` se redirigen
automáticamente al backend en `http://localhost:3001` (proxy de Vite); el puerto del backend
es configurable con la variable de entorno `PORT`.

Credenciales demo para iniciar sesión:

- **Email:** `demo@factorit.com`
- **Password:** `demo1234`

### Correr los tests

```bash
npm test         # corre toda la suite (vitest run, reporter verbose)
npm run typecheck  # tsc --noEmit (chequeo de tipos, sin emitir archivos)
```

`npm test` lista **cada test** con su nombre y un símbolo de color:

- **verde (✓)** = el test pasa.
- **rojo (✗)** = el test falla (debajo se detalla qué se esperaba y qué se obtuvo).

Al final imprime el resumen (archivos y tests, cuántos pasaron/fallaron). El exit code es
`0` si todo está en verde y distinto de `0` si algún test falla, para que sirva en CI.

### Dónde se guardan los datos

Al levantar el backend por primera vez se crea una DB SQLite local en `data/app.db` (se genera
sola en el primer arranque) y, si está vacía, se siembra el usuario demo con tareas variadas.
Los tests **no** tocan ese archivo: usan SQLite en memoria (`:memory:`), aislado y efímero.

### Otros comandos

```bash
npm run build   # typecheck + build del front (Vite)
npm start       # levanta solo el backend (tsx src/index.ts)
```
