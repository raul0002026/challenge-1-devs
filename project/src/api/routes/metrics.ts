import type { FastifyInstance } from 'fastify';
import { completionRate, countByStatus, countOverdue, upcomingDue } from '../../domain/metrics';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const tasks = app.repo.listTasks(request.user!.userId);
    const today = todayIso();
    return {
      total: tasks.length,
      byStatus: countByStatus(tasks),
      overdue: countOverdue(tasks, today),
      completionRate: completionRate(tasks),
      upcoming: upcomingDue(tasks, today),
    };
  });
}
