import {
  isPriority,
  isTaskStatus,
  type Priority,
  type Task,
  type TaskStatus,
} from './types';

export interface NewTaskInput {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
  dueDate?: unknown;
}

export interface ValidNewTask {
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
}

export type ValidationResult =
  | { ok: true; value: ValidNewTask }
  | { ok: false; errors: string[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TITLE_LENGTH = 200;

export function validateNewTask(input: NewTaskInput): ValidationResult {
  const errors: string[] = [];

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) errors.push('title is required');
  else if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }

  const description = typeof input.description === 'string' ? input.description.trim() : '';

  let priority: Priority = 'medium';
  if (input.priority !== undefined) {
    if (isPriority(input.priority)) priority = input.priority;
    else errors.push('priority must be one of low, medium, high');
  }

  let status: TaskStatus = 'todo';
  if (input.status !== undefined) {
    if (isTaskStatus(input.status)) status = input.status;
    else errors.push('status must be one of todo, doing, done');
  }

  let dueDate: string | null = null;
  if (input.dueDate !== undefined && input.dueDate !== null && input.dueDate !== '') {
    if (typeof input.dueDate === 'string' && DATE_RE.test(input.dueDate)) dueDate = input.dueDate;
    else errors.push('dueDate must be a YYYY-MM-DD date');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { title, description, priority, status, dueDate } };
}

export interface TaskUpdateInput {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  dueDate?: unknown;
}

export interface ValidTaskUpdate {
  title?: string;
  description?: string;
  priority?: Priority;
  dueDate?: string | null;
}

export type TaskUpdateValidationResult =
  | { ok: true; value: ValidTaskUpdate }
  | { ok: false; errors: string[] };

/**
 * Validate a partial edit of a task's editable fields. Only the keys present in
 * `input` are validated and returned; status transitions are handled separately.
 */
export function validateTaskUpdate(input: TaskUpdateInput): TaskUpdateValidationResult {
  const errors: string[] = [];
  const value: ValidTaskUpdate = {};

  if (input.title !== undefined) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) errors.push('title is required');
    else if (title.length > MAX_TITLE_LENGTH) {
      errors.push(`title must be ${MAX_TITLE_LENGTH} characters or fewer`);
    } else value.title = title;
  }

  if (input.description !== undefined) {
    value.description = typeof input.description === 'string' ? input.description.trim() : '';
  }

  if (input.priority !== undefined) {
    if (isPriority(input.priority)) value.priority = input.priority;
    else errors.push('priority must be one of low, medium, high');
  }

  if (input.dueDate !== undefined) {
    if (input.dueDate === null || input.dueDate === '') value.dueDate = null;
    else if (typeof input.dueDate === 'string' && DATE_RE.test(input.dueDate)) value.dueDate = input.dueDate;
    else errors.push('dueDate must be a YYYY-MM-DD date');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['doing'],
  doing: ['done'],
  done: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: TaskStatus, to: TaskStatus) {
    super(`invalid status transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/** Whether a task may move from `from` to `to`. Staying put is always allowed. */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Enforce the todo -> doing -> done progression. Throws on illegal moves. */
export function applyStatusTransition(from: TaskStatus, to: TaskStatus): TaskStatus {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
  return to;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: Priority;
  search?: string;
}

export function filterTasks(tasks: Task[], filters: TaskFilters = {}): Task[] {
  const search = filters.search?.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (search) {
      const haystack = `${task.title} ${task.description}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

const PRIORITY_RANK: Record<Priority, number> = { high: 2, medium: 1, low: 0 };

/** Return a new array ordered high -> medium -> low (stable). Does not mutate input. */
export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
}
