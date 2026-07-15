export type TaskStatus = 'todo' | 'doing' | 'done';
export type Priority = 'low' | 'medium' | 'high';

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Task {
  id: number;
  userId: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  /** ISO calendar day (YYYY-MM-DD) or null when the task has no deadline. */
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done'];
export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high'];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}
