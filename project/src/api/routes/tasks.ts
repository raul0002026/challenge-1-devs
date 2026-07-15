import type { FastifyInstance } from 'fastify';
import type { TaskUpdate } from '../../db/index';
import {
  applyStatusTransition,
  filterTasks,
  InvalidTransitionError,
  sortByPriority,
  validateNewTask,
  validateTaskUpdate,
  type TaskFilters,
} from '../../domain/tasks';
import { isPriority, isTaskStatus } from '../../domain/types';

interface ListQuery {
  status?: string;
  priority?: string;
  search?: string;
}

interface PatchBody {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
  dueDate?: unknown;
}

export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get<{ Querystring: ListQuery }>('/', async (request) => {
    const all = app.repo.listTasks(request.user!.userId);
    const filters: TaskFilters = {};
    if (request.query.status && isTaskStatus(request.query.status)) filters.status = request.query.status;
    if (request.query.priority && isPriority(request.query.priority)) filters.priority = request.query.priority;
    if (request.query.search) filters.search = request.query.search;
    return { tasks: sortByPriority(filterTasks(all, filters)) };
  });

  app.post<{ Body: unknown }>('/', async (request, reply) => {
    const result = validateNewTask((request.body ?? {}) as Record<string, unknown>);
    if (!result.ok) {
      return reply.code(400).send({ error: 'validation failed', details: result.errors });
    }
    const task = app.repo.insertTask(request.user!.userId, result.value);
    return reply.code(201).send({ task });
  });

  app.patch<{ Params: { id: string }; Body: PatchBody }>('/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'invalid task id' });
    }

    const task = app.repo.getTask(id);
    if (!task || task.userId !== request.user!.userId) {
      return reply.code(404).send({ error: 'task not found' });
    }

    const body = request.body ?? {};

    const result = validateTaskUpdate(body);
    if (!result.ok) {
      return reply.code(400).send({ error: 'validation failed', details: result.errors });
    }
    const changes: TaskUpdate = { ...result.value };

    if (body.status !== undefined) {
      if (!isTaskStatus(body.status)) return reply.code(400).send({ error: 'invalid status' });
      try {
        changes.status = applyStatusTransition(task.status, body.status);
      } catch (err) {
        if (err instanceof InvalidTransitionError) return reply.code(400).send({ error: err.message });
        throw err;
      }
    }

    const updated = app.repo.updateTask(id, changes);
    return reply.send({ task: updated });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'invalid task id' });
    }

    const task = app.repo.getTask(id);
    if (!task || task.userId !== request.user!.userId) {
      return reply.code(404).send({ error: 'task not found' });
    }

    app.repo.deleteTask(id);
    return reply.send({ deleted: true });
  });
}
