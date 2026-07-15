import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createTask,
  deleteTask,
  fetchMetrics,
  fetchTasks,
  getToken,
  login,
  type Metrics,
  register,
  setToken,
  updateTask,
} from './api';
import type { Priority, Task, TaskStatus } from '../domain/types';
import { PRIORITIES, TASK_STATUSES } from '../domain/types';
import { Icon, type IconName } from './Icon';

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: 'doing',
  doing: 'done',
  done: null,
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Por hacer',
  doing: 'En curso',
  done: 'Hecha',
};

const STATUS_ICON: Record<TaskStatus, IconName> = {
  todo: 'circle',
  doing: 'clock',
  done: 'check-circle',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export function App() {
  const [authed, setAuthed] = useState(() => getToken() !== null);
  return authed ? (
    <Dashboard onLogout={() => setAuthed(false)} />
  ) : (
    <AuthScreen onAuthed={() => setAuthed(true)} />
  );
}

function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('demo@factorit.com');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const action = mode === 'login' ? login : register;
      const result = await action(email, password);
      setToken(result.token);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error inesperado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="card" onSubmit={submit}>
        <h1>Gestor de tareas</h1>
        <p className="muted">{mode === 'login' ? 'Inicia sesion' : 'Crea una cuenta'}</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contrasena
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className={busy ? 'is-loading' : ''} disabled={busy}>
          {busy ? (
            <>
              <Icon name="loader" className="spin" /> Procesando...
            </>
          ) : mode === 'login' ? (
            'Entrar'
          ) : (
            'Registrarse'
          )}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
        </button>
      </form>
    </main>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancingId, setAdvancingId] = useState<number | null>(null);

  const filters = useMemo(
    () => ({ status: statusFilter, priority: priorityFilter, search }),
    [statusFilter, priorityFilter, search],
  );

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [taskResult, metricResult] = await Promise.all([fetchTasks(filters), fetchMetrics()]);
      setTasks(taskResult.tasks);
      setMetrics(metricResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error al cargar');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function logout() {
    setToken(null);
    onLogout();
  }

  async function advance(task: Task) {
    const next = NEXT_STATUS[task.status];
    if (!next || advancingId !== null) return;
    setAdvancingId(task.id);
    try {
      await updateTask(task.id, { status: next });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error al actualizar');
    } finally {
      setAdvancingId(null);
    }
  }

  return (
    <main className="dashboard">
      <header>
        <div className="header-title">
          <h1>Tareas</h1>
          {metrics && (
            <span className="muted count">
              {metrics.total} {metrics.total === 1 ? 'tarea' : 'tareas'}
            </span>
          )}
        </div>
        <button type="button" className="btn-secondary" onClick={logout}>
          <Icon name="log-out" /> Salir
        </button>
      </header>

      {metrics && <MetricsPanel metrics={metrics} />}

      <NewTaskForm onCreated={reload} />

      <section className="panel">
        <div className="panel-head">
          <Icon name="filter" /> Filtros
        </div>
        <div className="filters">
          <div className="filter-search">
            <Icon name="search" className="filter-search-icon" />
            <input
              type="search"
              placeholder="Buscar tareas..."
              aria-label="Buscar tareas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por prioridad"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">Todas las prioridades</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <ul className="task-list">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            advancingId={advancingId}
            onAdvance={advance}
            onChanged={reload}
            onError={setError}
          />
        ))}
        {tasks.length === 0 && loading && (
          <li className="empty-state">
            <Icon name="loader" size={28} className="spin" />
            <p className="muted">Cargando tareas...</p>
          </li>
        )}
        {tasks.length === 0 && !loading && (
          <li className="empty-state">
            <Icon name="inbox" size={28} />
            <p className="muted">No hay tareas que coincidan.</p>
          </li>
        )}
      </ul>
    </main>
  );
}

function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <section className="metrics">
      <Metric icon="layers" tone="sky" label="Total" value={metrics.total} />
      <Metric icon="circle" tone="slate" label="Por hacer" value={metrics.byStatus.todo} />
      <Metric icon="clock" tone="sky" label="En curso" value={metrics.byStatus.doing} />
      <Metric icon="check-circle" tone="emerald" label="Hechas" value={metrics.byStatus.done} />
      <Metric icon="alert-triangle" tone="red" label="Vencidas" value={metrics.overdue} />
      <Metric icon="pie-chart" tone="amber" label="Completado" value={`${metrics.completionRate}%`} />
    </section>
  );
}

function Metric({
  icon,
  tone,
  label,
  value,
}: {
  icon: IconName;
  tone: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="metric">
      <span className={`metric-icon tone-${tone}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="metric-text">
        <span className="metric-value">{value}</span>
        <span className="metric-label">{label}</span>
      </span>
    </div>
  );
}

function NewTaskForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('El título es obligatorio');
      return;
    }
    setCreating(true);
    try {
      await createTask({
        title: trimmedTitle,
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || null,
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setFormError(null);
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'error al crear');
    } finally {
      setCreating(false);
    }
  }

  const canSubmit = title.trim().length > 0 && !creating;

  return (
    <form className="panel new-task" onSubmit={submit}>
      <div className="panel-head">
        <Icon name="plus" /> Nueva tarea
      </div>

      <div className="field">
        <label htmlFor="nt-title">Titulo</label>
        <input
          id="nt-title"
          type="text"
          placeholder="Que hay que hacer?"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (formError) setFormError(null);
          }}
          disabled={creating}
          className={formError ? 'input-error' : undefined}
          aria-invalid={formError ? true : undefined}
          aria-describedby={formError ? 'nt-title-error' : undefined}
        />
        {formError && (
          <p id="nt-title-error" className="field-error">
            <Icon name="alert-triangle" size={13} /> {formError}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="nt-description">Descripcion</label>
        <textarea
          id="nt-description"
          placeholder="Detalles, contexto o pasos (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={creating}
          rows={3}
        />
      </div>

      <div className="new-task-row">
        <div className="field">
          <label htmlFor="nt-priority">Prioridad</label>
          <select
            id="nt-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            disabled={creating}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nt-due">Vencimiento</label>
          <input
            id="nt-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={creating}
          />
        </div>
        <button type="submit" className={creating ? 'is-loading' : ''} disabled={!canSubmit}>
          {creating ? (
            <>
              <Icon name="loader" className="spin" /> Creando...
            </>
          ) : (
            <>
              <Icon name="plus" /> Agregar
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function TaskItem({
  task,
  advancingId,
  onAdvance,
  onChanged,
  onError,
}: {
  task: Task;
  advancingId: number | null;
  onAdvance: (task: Task) => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const next = NEXT_STATUS[task.status];
  const isAdvancing = advancingId === task.id;

  async function remove() {
    setDeleting(true);
    try {
      await deleteTask(task.id);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'error al eliminar');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  if (editing) {
    return (
      <li className={`task priority-${task.priority}`}>
        <EditTaskForm
          task={task}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await onChanged();
          }}
        />
      </li>
    );
  }

  return (
    <li className={`task priority-${task.priority}`}>
      <div className="task-main">
        <span className="task-title">{task.title}</span>
        {task.description && <p className="task-desc">{task.description}</p>}
        <div className="task-badges">
          <span className={`badge status-${task.status}`}>
            <Icon name={STATUS_ICON[task.status]} size={13} /> {STATUS_LABEL[task.status]}
          </span>
          <span className={`badge prio-${task.priority}`}>
            <Icon name="flag" size={13} /> {PRIORITY_LABEL[task.priority]}
          </span>
          {task.dueDate && (
            <span className="badge badge-due">
              <Icon name="calendar" size={13} /> {task.dueDate}
            </span>
          )}
        </div>
      </div>

      <div className="task-actions">
        {next && (
          <button
            type="button"
            className={`btn-secondary task-action${isAdvancing ? ' is-loading' : ''}`}
            onClick={() => onAdvance(task)}
            disabled={advancingId !== null || deleting}
          >
            {isAdvancing ? (
              <>
                <Icon name="loader" className="spin" /> Actualizando...
              </>
            ) : (
              <>
                <Icon name="arrow-right" /> Avanzar a {STATUS_LABEL[next]}
              </>
            )}
          </button>
        )}

        {confirmingDelete ? (
          <div className="confirm-delete">
            <span className="confirm-label">Eliminar esta tarea?</span>
            <button
              type="button"
              className={`btn-danger${deleting ? ' is-loading' : ''}`}
              onClick={remove}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Icon name="loader" className="spin" /> Eliminando...
                </>
              ) : (
                <>
                  <Icon name="trash" /> Si, eliminar
                </>
              )}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              <Icon name="x" /> Cancelar
            </button>
          </div>
        ) : (
          <div className="task-tools">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditing(true)}
              disabled={advancingId !== null}
            >
              <Icon name="edit" /> Editar
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmingDelete(true)}
              disabled={advancingId !== null}
            >
              <Icon name="trash" /> Eliminar
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function EditTaskForm({
  task,
  onCancel,
  onSaved,
}: {
  task: Task;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('El título es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await updateTask(task.id, {
        title: trimmedTitle,
        description: description.trim(),
        priority,
        dueDate: dueDate || null,
      });
      await onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'error al guardar');
      setSaving(false);
    }
  }

  const canSave = title.trim().length > 0 && !saving;

  return (
    <form className="edit-task" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`et-title-${task.id}`}>Titulo</label>
        <input
          id={`et-title-${task.id}`}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (formError) setFormError(null);
          }}
          disabled={saving}
          className={formError ? 'input-error' : undefined}
          aria-invalid={formError ? true : undefined}
          aria-describedby={formError ? `et-title-error-${task.id}` : undefined}
        />
        {formError && (
          <p id={`et-title-error-${task.id}`} className="field-error">
            <Icon name="alert-triangle" size={13} /> {formError}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`et-description-${task.id}`}>Descripcion</label>
        <textarea
          id={`et-description-${task.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving}
          rows={3}
        />
      </div>

      <div className="edit-task-row">
        <div className="field">
          <label htmlFor={`et-priority-${task.id}`}>Prioridad</label>
          <select
            id={`et-priority-${task.id}`}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            disabled={saving}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`et-due-${task.id}`}>Vencimiento</label>
          <input
            id={`et-due-${task.id}`}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>

      <div className="edit-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          <Icon name="x" /> Cancelar
        </button>
        <button type="submit" className={saving ? 'is-loading' : ''} disabled={!canSave}>
          {saving ? (
            <>
              <Icon name="loader" className="spin" /> Guardando...
            </>
          ) : (
            <>
              <Icon name="check-circle" /> Guardar
            </>
          )}
        </button>
      </div>
    </form>
  );
}
