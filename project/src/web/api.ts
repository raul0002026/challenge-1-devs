import type { Priority, Task, TaskStatus } from '../domain/types';

const TOKEN_KEY = 'taskmanager.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };
  // Only declare a JSON content-type when a body is actually sent; a bodyless
  // request (DELETE, GET) with the header trips Fastify's empty-JSON-body guard.
  if (options.body != null) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: string[];
    };
    const detail = body.details?.length ? `: ${body.details.join(', ')}` : '';
    throw new Error(`${body.error ?? `request failed (${response.status})`}${detail}`);
  }
  return (await response.json()) as T;
}

export interface AuthResponse {
  token: string;
  user: { id: number; email: string; createdAt: string };
}

export interface Metrics {
  total: number;
  byStatus: Record<TaskStatus, number>;
  overdue: number;
  completionRate: number;
  upcoming: Task[];
}

export interface TaskFilterValues {
  status?: string;
  priority?: string;
  search?: string;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchTasks(filters: TaskFilterValues = {}): Promise<{ tasks: Task[] }> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.search) params.set('search', filters.search);
  const query = params.toString();
  return request<{ tasks: Task[] }>(`/tasks${query ? `?${query}` : ''}`);
}

export function createTask(input: {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string | null;
}): Promise<{ task: Task }> {
  return request<{ task: Task }>('/tasks', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTask(
  id: number,
  changes: {
    status?: TaskStatus;
    priority?: Priority;
    title?: string;
    description?: string;
    dueDate?: string | null;
  },
): Promise<{ task: Task }> {
  return request<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

export function deleteTask(id: number): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
}

export function fetchMetrics(): Promise<Metrics> {
  return request<Metrics>('/metrics');
}
