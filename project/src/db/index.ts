import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../domain/auth';
import type { Priority, Task, TaskStatus, User } from '../domain/types';
import type { ValidNewTask } from '../domain/tasks';

export type Db = Database.Database;

export const DEMO_EMAIL = 'demo@factorit.com';
export const DEMO_PASSWORD = 'demo1234';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

interface TaskRow {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string | null;
}

export interface Repo {
  db: Db;
  createUser(email: string, passwordHash: string): User;
  getUserByEmail(email: string): User | undefined;
  getUserById(id: number): User | undefined;
  insertTask(userId: number, data: ValidNewTask): Task;
  listTasks(userId: number): Task[];
  getTask(id: number): Task | undefined;
  updateTask(id: number, changes: TaskUpdate): Task | undefined;
  deleteTask(id: number): boolean;
}

export function openDb(location: string = ':memory:'): Db {
  const db = new Database(location);
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(schemaPath, 'utf8'));
  return db;
}

export function createRepo(db: Db): Repo {
  function getTask(id: number): Task | undefined {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    return row ? mapTask(row) : undefined;
  }

  function createUser(email: string, passwordHash: string): User {
    const createdAt = new Date().toISOString();
    const info = db
      .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(email, passwordHash, createdAt);
    return { id: Number(info.lastInsertRowid), email, passwordHash, createdAt };
  }

  function getUserByEmail(email: string): User | undefined {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
    return row ? mapUser(row) : undefined;
  }

  function getUserById(id: number): User | undefined {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? mapUser(row) : undefined;
  }

  function insertTask(userId: number, data: ValidNewTask): Task {
    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO tasks (user_id, title, description, status, priority, due_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(userId, data.title, data.description, data.status, data.priority, data.dueDate, now, now);
    const created = getTask(Number(info.lastInsertRowid));
    if (!created) throw new Error('failed to load task after insert');
    return created;
  }

  function listTasks(userId: number): Task[] {
    const rows = db
      .prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC, id DESC')
      .all(userId) as TaskRow[];
    return rows.map(mapTask);
  }

  function updateTask(id: number, changes: TaskUpdate): Task | undefined {
    const current = getTask(id);
    if (!current) return undefined;
    const next = {
      title: changes.title ?? current.title,
      description: changes.description ?? current.description,
      status: changes.status ?? current.status,
      priority: changes.priority ?? current.priority,
      dueDate: changes.dueDate === undefined ? current.dueDate : changes.dueDate,
    };
    db.prepare(
      `UPDATE tasks
         SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, updated_at = ?
       WHERE id = ?`,
    ).run(next.title, next.description, next.status, next.priority, next.dueDate, new Date().toISOString(), id);
    return getTask(id);
  }

  function deleteTask(id: number): boolean {
    const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return info.changes > 0;
  }

  return {
    db,
    createUser,
    getUserByEmail,
    getUserById,
    insertTask,
    listTasks,
    getTask,
    updateTask,
    deleteTask,
  };
}

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function demoTasks(): ValidNewTask[] {
  return [
    { title: 'Configurar entorno de desarrollo', description: 'Instalar dependencias y correr la suite.', priority: 'high', status: 'done', dueDate: isoDay(-10) },
    { title: 'Revisar pull requests pendientes', description: 'Cola de revision del equipo.', priority: 'high', status: 'doing', dueDate: isoDay(-2) },
    { title: 'Actualizar dependencias', description: 'Bump menor de librerias.', priority: 'low', status: 'todo', dueDate: isoDay(-1) },
    { title: 'Enviar reporte semanal al lider', description: 'Resumen de avances del equipo.', priority: 'high', status: 'todo', dueDate: isoDay(0) },
    { title: 'Preparar demo para stakeholders', description: 'Guion y datos de ejemplo.', priority: 'high', status: 'todo', dueDate: isoDay(1) },
    { title: 'Escribir documentacion de la API', description: 'Endpoints de auth, tareas y metricas.', priority: 'medium', status: 'todo', dueDate: isoDay(3) },
    { title: 'Planificar sprint siguiente', description: 'Refinamiento del backlog.', priority: 'medium', status: 'doing', dueDate: isoDay(7) },
    { title: 'Refactor del modulo de metricas', description: 'Limpiar helpers de fechas.', priority: 'low', status: 'todo', dueDate: null },
  ];
}

/** Seed a demo user and a handful of varied tasks. No-op when the demo user already exists. */
export function seedDemoData(repo: Repo): void {
  if (repo.getUserByEmail(DEMO_EMAIL)) return;
  const user = repo.createUser(DEMO_EMAIL, hashPassword(DEMO_PASSWORD));
  for (const task of demoTasks()) repo.insertTask(user.id, task);
}
