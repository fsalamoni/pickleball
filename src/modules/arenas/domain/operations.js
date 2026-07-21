/**
 * Domínio: Operations (Arena V3 — sprint 7).
 */

export const CHECKLIST_KIND = Object.freeze({
  OPENING: 'opening',
  CLOSING: 'closing',
  MAINTENANCE: 'maintenance',
});

export const MAINTENANCE_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled',
});

export const MAINTENANCE_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
});

/** Normaliza item de checklist. */
export function normalizeChecklistItem(input = {}) {
  return {
    title: String(input.title || '').trim().slice(0, 200),
    description: String(input.description || '').trim().slice(0, 500),
    required: input.required !== false,
    order: Number(input.order) || 0,
  };
}

/** Normaliza ordem de manutenção. */
export function normalizeMaintenanceInput(input = {}) {
  const errors = {};
  const title = String(input.title || '').trim();
  if (!title) errors.title = 'Título obrigatório.';
  if (title.length > 200) errors.title = 'Máx. 200 chars.';
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      title,
      description: String(input.description || '').trim().slice(0, 1000),
      priority: Object.values(MAINTENANCE_PRIORITY).includes(input.priority) ? input.priority : MAINTENANCE_PRIORITY.MEDIUM,
      status: MAINTENANCE_STATUS.PENDING,
      due_date: input.due_date || null,
    },
  };
}

/** Calcula % de conclusão de checklist. */
export function checklistProgress(items = []) {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.completed).length;
  return Math.round((done / items.length) * 100);
}
