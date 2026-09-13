import { describe, it, expect } from 'vitest';
import {
  CHECKLIST_KIND, MAINTENANCE_STATUS, MAINTENANCE_PRIORITY,
  normalizeChecklistItem, normalizeMaintenanceInput, checklistProgress,
} from './operations.js';

describe('normalizeChecklistItem', () => {
  it('normaliza', () => {
    const r = normalizeChecklistItem({ title: 'Limpar quadras', order: 1 });
    expect(r.title).toBe('Limpar quadras');
    expect(r.required).toBe(true);
  });
  it('trunca título', () => {
    const r = normalizeChecklistItem({ title: 'a'.repeat(300) });
    expect(r.title.length).toBe(200);
  });
});

describe('normalizeMaintenanceInput', () => {
  it('aceita válido', () => {
    const r = normalizeMaintenanceInput({ title: 'Trocar rede', priority: 'high' });
    expect(r.valid).toBe(true);
    expect(r.value.priority).toBe('high');
  });
  it('rejeita sem título', () => {
    expect(normalizeMaintenanceInput({}).valid).toBe(false);
  });
  it('default medium priority', () => {
    const r = normalizeMaintenanceInput({ title: 'X' });
    expect(r.value.priority).toBe('medium');
  });
});

describe('checklistProgress', () => {
  it('100% todas completas', () => {
    const items = [{ completed: true }, { completed: true }];
    expect(checklistProgress(items)).toBe(100);
  });
  it('0% nenhuma', () => {
    expect(checklistProgress([{ completed: false }, { completed: false }])).toBe(0);
  });
  it('50% metade', () => {
    expect(checklistProgress([{ completed: true }, { completed: false }])).toBe(50);
  });
  it('0 para vazio', () => {
    expect(checklistProgress([])).toBe(0);
  });
});

/* ================================================================== */
/*  Onda 4 — a rotina do dia, a quadra fechada e a equipe             */
/* ================================================================== */

import {
  CHECKLIST_HISTORY_MAX, MAINTENANCE_MAX_DAYS, STAFF_ROLE, STAFF_SHIFT,
  checklistRunState, checklistsPendingToday, isMaintenanceOpen,
  maintenanceBlockPayloads, maintenanceDates, normalizeStaffMember,
  staffByRole, staffOnDuty, startChecklistDay,
} from './operations.js';

const HOJE = '2026-09-13';
const ONTEM = '2026-09-12';

const itens = (...marcados) => marcados.map((c, i) => ({
  title: `Item ${i + 1}`, required: true, order: i, completed: c,
}));

describe('⭐ checklistRunState — o checkmark de ontem não vale hoje', () => {
  it('checklist de ONTEM aparece zerado hoje', () => {
    const cl = { recurring: true, run_date: ONTEM, items: itens(true, true, true) };
    const estado = checklistRunState(cl, HOJE);
    expect(estado.freshDay).toBe(true);
    expect(estado.done).toBe(0);
    expect(estado.progress).toBe(0);
    expect(estado.items.every((i) => i.completed === false)).toBe(true);
  });

  it('checklist de HOJE mantém o que já foi feito', () => {
    const cl = { recurring: true, run_date: HOJE, items: itens(true, false, false) };
    const estado = checklistRunState(cl, HOJE);
    expect(estado.freshDay).toBe(false);
    expect(estado.done).toBe(1);
  });

  it('⭐ lista NÃO recorrente não zera nunca — é uma lista de tarefas', () => {
    const cl = { recurring: false, run_date: ONTEM, items: itens(true, true) };
    const estado = checklistRunState(cl, HOJE);
    expect(estado.freshDay).toBe(false);
    expect(estado.done).toBe(2);
  });

  it('checklist novo (sem run_date) começa o dia limpo', () => {
    const cl = { recurring: true, items: itens(false, false) };
    expect(checklistRunState(cl, HOJE).freshDay).toBe(true);
  });

  it('conta os obrigatórios que faltam, que é o que impede fechar a rotina', () => {
    const cl = {
      recurring: true,
      run_date: HOJE,
      items: [
        { title: 'a', required: true, completed: true },
        { title: 'b', required: true, completed: false },
        { title: 'c', required: false, completed: false },
      ],
    };
    expect(checklistRunState(cl, HOJE).pendingRequired).toBe(1);
  });

  it('checklist vazio não é "completo"', () => {
    expect(checklistRunState({ recurring: true, run_date: HOJE, items: [] }, HOJE).complete).toBe(false);
  });
});

describe('startChecklistDay — a virada, e o histórico', () => {
  it('não faz nada quando já é o dia de hoje', () => {
    expect(startChecklistDay({ recurring: true, run_date: HOJE, items: [] }, HOJE)).toBeNull();
  });

  it('não faz nada em lista não recorrente', () => {
    expect(startChecklistDay({ recurring: false, run_date: ONTEM, items: [] }, HOJE)).toBeNull();
  });

  it('⭐ limpa os itens e guarda o dia anterior no histórico', () => {
    const cl = { recurring: true, run_date: ONTEM, items: itens(true, true, false), history: [] };
    const patch = startChecklistDay(cl, HOJE);
    expect(patch.run_date).toBe(HOJE);
    expect(patch.items.every((i) => !i.completed)).toBe(true);
    expect(patch.completed_pct).toBe(0);
    expect(patch.history).toEqual([{ date: ONTEM, progress: 67, done: 2, total: 3 }]);
  });

  it('⭐ checklist recém-criado não inventa um dia de 0% que nunca existiu', () => {
    const patch = startChecklistDay({ recurring: true, items: itens(false) }, HOJE);
    expect(patch.history).toEqual([]);
  });

  it(`o histórico não cresce para sempre (teto de ${CHECKLIST_HISTORY_MAX})`, () => {
    const velho = Array.from({ length: CHECKLIST_HISTORY_MAX + 5 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`, progress: 100, done: 1, total: 1,
    }));
    const patch = startChecklistDay(
      { recurring: true, run_date: ONTEM, items: itens(true), history: velho }, HOJE,
    );
    expect(patch.history.length).toBe(CHECKLIST_HISTORY_MAX);
    // O mais recente (ontem) sobrevive; o mais antigo cai.
    expect(patch.history[patch.history.length - 1].date).toBe(ONTEM);
  });
});

describe('checklistsPendingToday — o resumo da manhã', () => {
  it('só lista o que tem pendência HOJE', () => {
    const lista = [
      { id: 'a', title: 'Abertura', kind: 'opening', recurring: true, run_date: HOJE, items: itens(true, true) },
      { id: 'f', title: 'Fechamento', kind: 'closing', recurring: true, run_date: HOJE, items: itens(true, false) },
    ];
    const r = checklistsPendingToday(lista, HOJE);
    expect(r.total).toBe(1);
    expect(r.pendentes.map((p) => p.id)).toEqual(['f']);
  });

  it('⭐ rotina cumprida ONTEM conta como pendente hoje', () => {
    const lista = [{ id: 'a', title: 'Abertura', recurring: true, run_date: ONTEM, items: itens(true, true) }];
    expect(checklistsPendingToday(lista, HOJE).total).toBe(2);
  });

  it('checklist sem itens não vira pendência fantasma', () => {
    expect(checklistsPendingToday([{ id: 'x', items: [] }], HOJE).total).toBe(0);
  });
});

describe('⭐ maintenanceBlockPayloads — a ordem que FECHA a quadra', () => {
  const base = {
    id: 'o1', arena_id: 'a1', court_id: 'q2', blocks_court: true,
    starts_on: HOJE, ends_on: HOJE, start_time: '08:00', end_time: '18:00',
    status: 'pending',
  };

  it('gera um bloqueio por dia, no formato de arena_unavailabilities', () => {
    const b = maintenanceBlockPayloads(base);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({
      arena_id: 'a1', court_id: 'q2', date: HOJE,
      start_time: '08:00', end_time: '18:00', source: 'maintenance', maintenance_id: 'o1',
    });
  });

  it('⭐ o motivo NÃO vai junto: o bloqueio é público', () => {
    const b = maintenanceBlockPayloads({ ...base, title: 'Trocar fechadura do vestiário', description: 'segredo' });
    expect(JSON.stringify(b)).not.toContain('fechadura');
    expect(JSON.stringify(b)).not.toContain('segredo');
    expect(b[0].notes).toBe('Manutenção programada');
  });

  it('intervalo de vários dias vira um bloqueio por dia', () => {
    const b = maintenanceBlockPayloads({ ...base, starts_on: '2026-09-13', ends_on: '2026-09-15' });
    expect(b.map((x) => x.date)).toEqual(['2026-09-13', '2026-09-14', '2026-09-15']);
  });

  it('⭐ ordem que NÃO tira da venda não bloqueia nada', () => {
    expect(maintenanceBlockPayloads({ ...base, blocks_court: false })).toEqual([]);
  });

  it('⭐ ordem CONCLUÍDA devolve a quadra — nenhum bloqueio', () => {
    expect(maintenanceBlockPayloads({ ...base, status: 'done' })).toEqual([]);
  });

  it('⭐ ordem CANCELADA também devolve a quadra', () => {
    expect(maintenanceBlockPayloads({ ...base, status: 'cancelled' })).toEqual([]);
  });

  it('sem quadra, fecha a arena inteira (court_id null)', () => {
    expect(maintenanceBlockPayloads({ ...base, court_id: null })[0].court_id).toBeNull();
  });

  it('janela invertida não vira bloqueio (seria fechar o dia inteiro por engano)', () => {
    expect(maintenanceBlockPayloads({ ...base, start_time: '18:00', end_time: '08:00' })).toEqual([]);
  });

  it('sem data de início não bloqueia nada', () => {
    expect(maintenanceBlockPayloads({ ...base, starts_on: null })).toEqual([]);
  });
});

describe('maintenanceDates', () => {
  it('sem fim, é um dia só', () => {
    expect(maintenanceDates({ starts_on: HOJE })).toEqual([HOJE]);
  });

  it('atravessa a virada do mês', () => {
    expect(maintenanceDates({ starts_on: '2026-09-29', ends_on: '2026-10-02' }))
      .toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('⭐ fim ANTES do início não inverte o intervalo', () => {
    // Inverter fecharia a quadra por dois meses sem ninguém pedir.
    expect(maintenanceDates({ starts_on: '2026-09-20', ends_on: '2026-09-10' })).toEqual(['2026-09-20']);
  });

  it(`corta em ${MAINTENANCE_MAX_DAYS} dias`, () => {
    expect(maintenanceDates({ starts_on: '2026-01-01', ends_on: '2026-12-31' }))
      .toHaveLength(MAINTENANCE_MAX_DAYS);
  });

  it('data malformada não vira intervalo', () => {
    expect(maintenanceDates({ starts_on: '13/09/2026' })).toEqual([]);
  });
});

describe('isMaintenanceOpen', () => {
  it('pendente e em andamento estão abertas', () => {
    expect(isMaintenanceOpen({ status: 'pending' })).toBe(true);
    expect(isMaintenanceOpen({ status: 'in_progress' })).toBe(true);
  });
  it('concluída e cancelada, não', () => {
    expect(isMaintenanceOpen({ status: 'done' })).toBe(false);
    expect(isMaintenanceOpen({ status: 'cancelled' })).toBe(false);
  });
  it('ordem antiga sem status conta como aberta', () => {
    expect(isMaintenanceOpen({})).toBe(true);
  });
});

describe('normalizeMaintenanceInput — a parte que fecha a quadra', () => {
  it('⭐ marcar "fechar" sem data é ERRO, não bloqueio de data nenhuma', () => {
    const r = normalizeMaintenanceInput({ title: 'Piso', blocks_court: true });
    expect(r.valid).toBe(false);
    expect(r.errors.starts_on).toBeTruthy();
  });

  it('ordem sem "fechar" segue sendo o bilhete de antes', () => {
    const r = normalizeMaintenanceInput({ title: 'Comprar lâmpadas' });
    expect(r.valid).toBe(true);
    expect(r.value.blocks_court).toBe(false);
    expect(r.value.starts_on).toBeNull();
  });

  it('recusa fim antes do início', () => {
    const r = normalizeMaintenanceInput({
      title: 'x', blocks_court: true, starts_on: '2026-09-20', ends_on: '2026-09-10',
    });
    expect(r.valid).toBe(false);
  });

  it('recusa janela de horário invertida', () => {
    const r = normalizeMaintenanceInput({
      title: 'x', blocks_court: true, starts_on: HOJE, start_time: '18:00', end_time: '08:00',
    });
    expect(r.valid).toBe(false);
  });

  it('sem "até", o fim é o próprio início', () => {
    const r = normalizeMaintenanceInput({ title: 'x', blocks_court: true, starts_on: HOJE });
    expect(r.value.ends_on).toBe(HOJE);
  });

  it('preserva o status ao editar (editar não pode ressuscitar ordem concluída)', () => {
    const r = normalizeMaintenanceInput({ title: 'x', status: 'done' });
    expect(r.value.status).toBe('done');
  });
});

describe('equipe', () => {
  it('⭐ não guarda telefone nem e-mail, mesmo se mandarem', () => {
    const { value } = normalizeStaffMember({
      name: 'João', email: 'joao@x.com', phone: '11999999999', cpf: '123',
    });
    expect(Object.keys(value)).not.toContain('email');
    expect(Object.keys(value)).not.toContain('phone');
    expect(Object.keys(value)).not.toContain('cpf');
    expect(JSON.stringify(value)).not.toContain('joao@x.com');
  });

  it('exige nome', () => {
    expect(normalizeStaffMember({ name: '  ' }).valid).toBe(false);
  });

  it('função e turno desconhecidos caem no padrão', () => {
    const { value } = normalizeStaffMember({ name: 'Ana', role: 'inventado', shift: 'sei-la' });
    expect(value.role).toBe(STAFF_ROLE.OTHER);
    expect(value.shift).toBe(STAFF_SHIFT.FULL);
  });

  it('⭐ staffOnDuty responde por HORA, que é a pergunta real', () => {
    const equipe = [
      { name: 'Manhã', shift: STAFF_SHIFT.MORNING, active: true },
      { name: 'Noite', shift: STAFF_SHIFT.NIGHT, active: true },
      { name: 'Sempre', shift: STAFF_SHIFT.FULL, active: true },
    ];
    expect(staffOnDuty(equipe, '08:00').map((m) => m.name)).toEqual(['Manhã', 'Sempre']);
    expect(staffOnDuty(equipe, '20:00').map((m) => m.name)).toEqual(['Noite', 'Sempre']);
  });

  it('quem saiu da arena (inativo) não está de plantão', () => {
    const equipe = [{ name: 'Ex', shift: STAFF_SHIFT.FULL, active: false }];
    expect(staffOnDuty(equipe, '10:00')).toEqual([]);
  });

  it('staffByRole não devolve grupo vazio', () => {
    const grupos = staffByRole([{ name: 'Ana', role: STAFF_ROLE.RECEPTION }]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].people.map((p) => p.name)).toEqual(['Ana']);
  });
});
