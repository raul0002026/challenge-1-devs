import { describe, expect, it } from 'vitest';
import {
  applyStatusTransition,
  canTransition,
  filterTasks,
  InvalidTransitionError,
  sortByPriority,
  validateNewTask,
  validateTaskUpdate,
} from '../src/domain/tasks';
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

describe('applyStatusTransition', () => {
  it('permite todo -> doing', () => {
    expect(applyStatusTransition('todo', 'doing')).toBe('doing');
  });

  it('permite doing -> done', () => {
    expect(applyStatusTransition('doing', 'done')).toBe('done');
  });

  it('permite permanecer en el mismo estado (sin cambios)', () => {
    expect(applyStatusTransition('doing', 'doing')).toBe('doing');
  });

  it('rechaza saltear de todo -> done', () => {
    expect(() => applyStatusTransition('todo', 'done')).toThrow(InvalidTransitionError);
  });

  it('rechaza retroceder de doing -> todo', () => {
    expect(() => applyStatusTransition('doing', 'todo')).toThrow(InvalidTransitionError);
  });

  it('rechaza reabrir de done -> doing y de done -> todo', () => {
    expect(() => applyStatusTransition('done', 'doing')).toThrow();
    expect(() => applyStatusTransition('done', 'todo')).toThrow();
  });
});

describe('canTransition', () => {
  it('coincide con los avances permitidos', () => {
    expect(canTransition('todo', 'doing')).toBe(true);
    expect(canTransition('doing', 'done')).toBe(true);
    expect(canTransition('todo', 'done')).toBe(false);
    expect(canTransition('done', 'todo')).toBe(false);
  });
});

describe('validateNewTask', () => {
  it('acepta una tarea mínima y aplica los valores por defecto', () => {
    const result = validateNewTask({ title: 'Write docs' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        title: 'Write docs',
        description: '',
        priority: 'medium',
        status: 'todo',
        dueDate: null,
      });
    }
  });

  it('recorta los espacios del título', () => {
    const result = validateNewTask({ title: '   spaced   ' });
    expect(result.ok && result.value.title).toBe('spaced');
  });

  it('rechaza un título vacío', () => {
    const result = validateNewTask({ title: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('title is required');
  });

  it('rechaza una prioridad inválida', () => {
    const result = validateNewTask({ title: 'x', priority: 'urgent' });
    expect(result.ok).toBe(false);
  });

  it('rechaza un formato de fecha de vencimiento inválido', () => {
    const result = validateNewTask({ title: 'x', dueDate: '01/02/2026' });
    expect(result.ok).toBe(false);
  });

  it('acepta una fecha de vencimiento válida', () => {
    const result = validateNewTask({ title: 'x', dueDate: '2026-03-01' });
    expect(result.ok && result.value.dueDate).toBe('2026-03-01');
  });
});

describe('validateTaskUpdate', () => {
  it('acepta una actualización vacía y no devuelve cambios', () => {
    const result = validateTaskUpdate({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({});
  });

  it('valida solo los campos presentes', () => {
    const result = validateTaskUpdate({ priority: 'high' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ priority: 'high' });
  });

  it('recorta los espacios del título', () => {
    const result = validateTaskUpdate({ title: '   spaced   ' });
    expect(result.ok && result.value.title).toBe('spaced');
  });

  it('rechaza un título vacío cuando se envía', () => {
    const result = validateTaskUpdate({ title: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('title is required');
  });

  it('recorta la descripción y permite vaciarla', () => {
    const result = validateTaskUpdate({ description: '  hello  ' });
    expect(result.ok && result.value.description).toBe('hello');
    const cleared = validateTaskUpdate({ description: '' });
    expect(cleared.ok && cleared.value.description).toBe('');
  });

  it('rechaza una prioridad inválida', () => {
    const result = validateTaskUpdate({ priority: 'urgent' });
    expect(result.ok).toBe(false);
  });

  it('rechaza un formato de fecha de vencimiento inválido', () => {
    const result = validateTaskUpdate({ dueDate: '01/02/2026' });
    expect(result.ok).toBe(false);
  });

  it('acepta una fecha de vencimiento válida', () => {
    const result = validateTaskUpdate({ dueDate: '2026-03-01' });
    expect(result.ok && result.value.dueDate).toBe('2026-03-01');
  });

  it('vacía la fecha de vencimiento con null o cadena vacía', () => {
    const withNull = validateTaskUpdate({ dueDate: null });
    expect(withNull.ok).toBe(true);
    if (withNull.ok) expect(withNull.value.dueDate).toBeNull();
    const withEmpty = validateTaskUpdate({ dueDate: '' });
    expect(withEmpty.ok).toBe(true);
    if (withEmpty.ok) expect(withEmpty.value.dueDate).toBeNull();
  });

  it('acumula varios errores a la vez', () => {
    const result = validateTaskUpdate({ title: '  ', priority: 'nope', dueDate: 'bad' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('filterTasks', () => {
  const tasks = [
    makeTask({ id: 1, status: 'todo', priority: 'high', title: 'Deploy release' }),
    makeTask({ id: 2, status: 'done', priority: 'low', title: 'Write tests' }),
    makeTask({ id: 3, status: 'doing', priority: 'medium', title: 'Review deploy plan' }),
  ];

  it('filtra por estado', () => {
    expect(filterTasks(tasks, { status: 'done' }).map((t) => t.id)).toEqual([2]);
  });

  it('filtra por prioridad', () => {
    expect(filterTasks(tasks, { priority: 'high' }).map((t) => t.id)).toEqual([1]);
  });

  it('filtra por búsqueda sin distinción de mayúsculas en título y descripción', () => {
    expect(filterTasks(tasks, { search: 'deploy' }).map((t) => t.id)).toEqual([1, 3]);
  });

  it('devuelve todo cuando no hay filtros', () => {
    expect(filterTasks(tasks)).toHaveLength(3);
  });
});

describe('sortByPriority', () => {
  it('ordena high -> medium -> low', () => {
    const tasks = [
      makeTask({ id: 1, priority: 'low' }),
      makeTask({ id: 2, priority: 'high' }),
      makeTask({ id: 3, priority: 'medium' }),
      makeTask({ id: 4, priority: 'high' }),
    ];
    expect(sortByPriority(tasks).map((t) => t.priority)).toEqual(['high', 'high', 'medium', 'low']);
  });

  it('no muta el arreglo de entrada', () => {
    const tasks = [makeTask({ id: 1, priority: 'low' }), makeTask({ id: 2, priority: 'high' })];
    const before = tasks.map((t) => t.id);
    sortByPriority(tasks);
    expect(tasks.map((t) => t.id)).toEqual(before);
  });
});
