import { describe, expect, it } from 'vitest';
import { completionRate, countByStatus, countOverdue, upcomingDue } from '../src/domain/metrics';
import type { Task } from '../src/domain/types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    userId: 1,
    title: 'task',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('countByStatus', () => {
  it('cuenta las tareas por estado', () => {
    const tasks = [
      makeTask({ status: 'todo' }),
      makeTask({ status: 'todo' }),
      makeTask({ status: 'doing' }),
      makeTask({ status: 'done' }),
    ];
    expect(countByStatus(tasks)).toEqual({ todo: 2, doing: 1, done: 1 });
  });

  it('devuelve ceros para una lista vacía', () => {
    expect(countByStatus([])).toEqual({ todo: 0, doing: 0, done: 0 });
  });
});

describe('countOverdue', () => {
  const today = '2026-07-15';

  it('cuenta las tareas con vencimiento anterior a hoy que no están hechas', () => {
    const tasks = [
      makeTask({ dueDate: '2026-07-14', status: 'todo' }),
      makeTask({ dueDate: '2026-07-10', status: 'doing' }),
    ];
    expect(countOverdue(tasks, today)).toBe(2);
  });

  it('NO cuenta una tarea que vence exactamente hoy (límite)', () => {
    const tasks = [makeTask({ dueDate: today, status: 'todo' })];
    expect(countOverdue(tasks, today)).toBe(0);
  });

  it('no cuenta las tareas hechas aunque estén vencidas', () => {
    const tasks = [makeTask({ dueDate: '2026-01-01', status: 'done' })];
    expect(countOverdue(tasks, today)).toBe(0);
  });

  it('ignora las tareas sin fecha de vencimiento', () => {
    const tasks = [makeTask({ dueDate: null, status: 'todo' })];
    expect(countOverdue(tasks, today)).toBe(0);
  });

  it('combina los casos correctamente', () => {
    const tasks = [
      makeTask({ dueDate: '2026-07-14', status: 'todo' }), // overdue
      makeTask({ dueDate: today, status: 'todo' }), // due today, not overdue
      makeTask({ dueDate: '2026-07-01', status: 'done' }), // done, not overdue
      makeTask({ dueDate: null, status: 'doing' }), // no due date
    ];
    expect(countOverdue(tasks, today)).toBe(1);
  });
});

describe('completionRate', () => {
  it('es 0 para una lista vacía', () => {
    expect(completionRate([])).toBe(0);
  });

  it('es 25 cuando 1 de 4 tareas está hecha', () => {
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'todo' }),
      makeTask({ status: 'doing' }),
      makeTask({ status: 'todo' }),
    ];
    expect(completionRate(tasks)).toBe(25);
  });

  it('redondea 2 de 3 hechas a 67', () => {
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask({ status: 'todo' }),
    ];
    expect(completionRate(tasks)).toBe(67);
  });

  it('es 100 cuando todas las tareas están hechas', () => {
    expect(completionRate([makeTask({ status: 'done' }), makeTask({ status: 'done' })])).toBe(100);
  });
});

describe('upcomingDue', () => {
  const today = '2026-07-15';

  it('devuelve las tareas no hechas que vencen dentro de la ventana, de la más próxima primero', () => {
    const tasks = [
      makeTask({ id: 1, dueDate: '2026-07-20', status: 'todo' }),
      makeTask({ id: 2, dueDate: today, status: 'todo' }),
      makeTask({ id: 3, dueDate: '2026-07-17', status: 'doing' }),
    ];
    expect(upcomingDue(tasks, today).map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it('excluye las tareas pasadas, hechas y fuera de la ventana', () => {
    const tasks = [
      makeTask({ id: 1, dueDate: '2026-07-14', status: 'todo' }), // past
      makeTask({ id: 2, dueDate: '2026-07-16', status: 'done' }), // done
      makeTask({ id: 3, dueDate: '2026-08-30', status: 'todo' }), // out of window
      makeTask({ id: 4, dueDate: '2026-07-18', status: 'todo' }), // included
    ];
    expect(upcomingDue(tasks, today).map((t) => t.id)).toEqual([4]);
  });

  it('respeta una ventana personalizada', () => {
    const tasks = [
      makeTask({ id: 1, dueDate: '2026-07-16', status: 'todo' }),
      makeTask({ id: 2, dueDate: '2026-07-20', status: 'todo' }),
    ];
    expect(upcomingDue(tasks, today, 2).map((t) => t.id)).toEqual([1]);
  });
});
