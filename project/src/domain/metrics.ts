import type { Task, TaskStatus } from './types';

export type StatusCounts = Record<TaskStatus, number>;

export function countByStatus(tasks: Task[]): StatusCounts {
  const counts: StatusCounts = { todo: 0, doing: 0, done: 0 };
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}

/**
 * A task is overdue when its dueDate is strictly BEFORE `today` and it is not done.
 * A task due exactly today is NOT overdue.
 * `today` and dueDate are ISO calendar days (YYYY-MM-DD), safe to compare lexicographically.
 */
export function countOverdue(tasks: Task[], today: string): number {
  return tasks.filter(
    (task) => task.status !== 'done' && task.dueDate !== null && task.dueDate < today,
  ).length;
}

/** Percentage of tasks in state `done` over the total, rounded to an integer. */
export function completionRate(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status === 'done').length;
  return Math.round((done / tasks.length) * 100);
}

/** Not-done tasks due between today and today+withinDays (inclusive), earliest first. */
export function upcomingDue(tasks: Task[], today: string, withinDays = 7): Task[] {
  const limit = addDays(today, withinDays);
  return tasks
    .filter(
      (task) =>
        task.status !== 'done' &&
        task.dueDate !== null &&
        task.dueDate >= today &&
        task.dueDate <= limit,
    )
    .sort((a, b) => compareDate(a.dueDate, b.dueDate));
}

function compareDate(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
