import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/api/server';
import { openDb } from '../src/db/index';

describe('API de punta a punta (Fastify inject + SQLite :memory:)', () => {
  let app: FastifyInstance;
  let token = '';

  beforeAll(async () => {
    app = buildServer(openDb(':memory:'));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra un nuevo usuario y devuelve un token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'user@test.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(typeof body.token).toBe('string');
    expect(body.user).toMatchObject({ email: 'user@test.com' });
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('rechaza un registro duplicado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'user@test.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('inicia sesión con credenciales válidas', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@test.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    token = res.json().token;
    expect(token).toBeTruthy();
  });

  it('rechaza el inicio de sesión con credenciales incorrectas', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@test.com', password: 'nope' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rechaza el acceso a tareas sin autenticación', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(401);
  });

  it('crea y lista una tarea', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: auth,
      payload: { title: 'First task', priority: 'high', dueDate: '2026-12-01' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().task).toMatchObject({ title: 'First task', status: 'todo', priority: 'high' });

    const listed = await app.inject({ method: 'GET', url: '/api/tasks', headers: auth });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().tasks).toHaveLength(1);
  });

  it('rechaza un payload de tarea inválido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: '   ' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('avanza el estado de forma válida y rechaza una transición inválida', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: auth,
      payload: { title: 'Transition task' },
    });
    const id = created.json().task.id;

    const illegal = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: auth,
      payload: { status: 'done' },
    });
    expect(illegal.statusCode).toBe(400);

    const legal = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: auth,
      payload: { status: 'doing' },
    });
    expect(legal.statusCode).toBe(200);
    expect(legal.json().task.status).toBe('doing');
  });

  it('devuelve las métricas agregadas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.byStatus).toEqual(expect.objectContaining({ todo: expect.any(Number) }));
    expect(typeof body.completionRate).toBe('number');
    expect(Array.isArray(body.upcoming)).toBe(true);
  });

  it('edita los campos editables y los persiste', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: auth,
      payload: { title: 'Editable task', description: 'before', priority: 'low', dueDate: '2026-01-01' },
    });
    const id = created.json().task.id;

    const edited = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: auth,
      payload: { title: 'Edited title', description: 'after', priority: 'high', dueDate: '2026-06-15' },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().task).toMatchObject({
      title: 'Edited title',
      description: 'after',
      priority: 'high',
      dueDate: '2026-06-15',
    });

    const listed = await app.inject({ method: 'GET', url: '/api/tasks', headers: auth });
    const persisted = listed.json().tasks.find((t: { id: number }) => t.id === id);
    expect(persisted).toMatchObject({
      title: 'Edited title',
      description: 'after',
      priority: 'high',
      dueDate: '2026-06-15',
    });
  });

  it('rechaza una edición con un payload inválido', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: auth,
      payload: { title: 'Invalid edit target' },
    });
    const id = created.json().task.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: auth,
      payload: { title: '   ', priority: 'urgent', dueDate: '15/06/2026' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('devuelve 404 al editar una tarea inexistente', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/999999',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'ghost' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rechaza una edición sin autenticación', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/1',
      payload: { title: 'nope' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('elimina una tarea y la quita del listado', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: auth,
      payload: { title: 'Task to delete' },
    });
    const id = created.json().task.id;

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${id}`,
      headers: auth,
    });
    expect(deleted.statusCode).toBe(200);

    const listed = await app.inject({ method: 'GET', url: '/api/tasks', headers: auth });
    expect(listed.json().tasks.some((t: { id: number }) => t.id === id)).toBe(false);
  });

  it('elimina una tarea enviada con content-type JSON y cuerpo vacío', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: auth,
      payload: { title: 'Delete with empty JSON body' },
    });
    const id = created.json().task.id;

    // Reproduces the browser bug: a bodyless DELETE that still advertises a JSON
    // content-type (with content-length so Fastify runs the parser). Without the
    // empty-body-tolerant parser this returns 400 FST_ERR_CTP_EMPTY_JSON_BODY.
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${id}`,
      headers: { ...auth, 'content-type': 'application/json', 'content-length': '0' },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().deleted).toBe(true);

    const listed = await app.inject({ method: 'GET', url: '/api/tasks', headers: auth });
    expect(listed.json().tasks.some((t: { id: number }) => t.id === id)).toBe(false);
  });

  it('devuelve 404 al eliminar una tarea inexistente', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/tasks/999999',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rechaza una eliminación sin autenticación', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/tasks/1' });
    expect(res.statusCode).toBe(401);
  });
});
