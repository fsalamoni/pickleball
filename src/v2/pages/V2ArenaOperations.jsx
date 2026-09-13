/**
 * V2ArenaOperations — o dia a dia de quem toca a arena.
 *
 * Rota: `/arenas/:arenaId/gerir/operacoes`
 * Módulos: `operations` (+ `operations_checklist`, `operations_maintenance`,
 * `operations_inventory`, `operations_staff`).
 *
 * ## O que a versão anterior não fazia
 *
 * **O checklist não era uma rotina.** Era criado uma vez e marcado para
 * sempre: o fechamento cumprido na segunda continuava "concluído" na terça, e
 * a arena não tinha como responder a única pergunta que importa de manhã —
 * *hoje a abertura foi feita?*. Agora cada dia recomeça (a virada acontece ao
 * abrir a tela) e o dia anterior vai para um histórico de 30 dias, que é o que
 * transforma o checklist numa prova.
 *
 * **A manutenção não fechava a quadra**, embora o catálogo prometesse. A ordem
 * era um bilhete sem quadra e sem data: trocar o piso da quadra 2 na quinta
 * não impedia ninguém de reservar a quadra 2 na quinta. Agora ela fecha —
 * gravando `arena_unavailabilities`, que o calendário inteiro já respeita — e
 * concluir a ordem **devolve** a quadra à venda.
 *
 * **O estoque existia e o alerta não chegava a lugar nenhum.** Produto abaixo
 * do mínimo só aparecia dentro da aba Mercado, que ninguém abre de manhã. Aqui
 * ele é uma linha do resumo do dia, com o caminho para repor.
 *
 * **A equipe não existia.** O módulo era `READY` no catálogo e não tinha uma
 * linha de código.
 *
 * ## O desenho da tela
 *
 * O topo é **o dia**: o que está pendente agora, em uma olhada — pendências de
 * checklist, ordens abertas, produto acabando, quem está de plantão. Quem abre
 * esta tela está de pé, atrás do balcão, e não vai rolar até o fim para
 * descobrir que faltou trancar o vestiário ontem.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, Boxes, Check, ClipboardCheck, ClipboardList,
  Clock, Package, Pencil, Plus, Trash2, Users, Wrench, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas, useArenaCourts, useInventoryProducts, useInventoryEntries, useInventoryExits } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaChecklists, useCreateChecklist, useToggleChecklistItem,
  useUpdateChecklist, useDeleteChecklist, useRollChecklistDay,
  useArenaMaintenance, useCreateMaintenance, useUpdateMaintenanceStatus,
  useUpdateMaintenance, useDeleteMaintenance,
  useArenaStaff, useSaveArenaStaff,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  CHECKLIST_KIND, CHECKLIST_KIND_META, MAINTENANCE_PRIORITY,
  MAINTENANCE_PRIORITY_META, MAINTENANCE_STATUS, MAINTENANCE_STATUS_META,
  STAFF_ROLE, STAFF_ROLE_META, STAFF_SHIFT, STAFF_SHIFT_META, STAFF_MAX,
  checklistRunState, checklistsPendingToday, isMaintenanceOpen,
  maintenanceDates, normalizeStaffMember, staffByRole, staffOnDuty,
} from '@/modules/arenas/domain/operations';
import { calculateStock, expiryStatus, stockStatus } from '@/modules/arenas/domain/inventory';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface,
  V2Textarea,
} from '@/v2/ui/primitives';

/* ========================================================== 1. HOJE ====== */

/**
 * O resumo do dia. Só mostra o que está PENDENTE — um painel que diz "tudo
 * certo" em quatro cartões verdes ocupa a tela e não informa nada.
 */
function ResumoDoDia({ pendencias, ordens, estoqueAlerta, plantao, temChecklist, temManutencao, temEstoque, temEquipe }) {
  const abertas = ordens.filter(isMaintenanceOpen);
  const urgentes = abertas.filter((o) => o.priority === MAINTENANCE_PRIORITY.URGENT);
  const nada = (!temChecklist || pendencias.total === 0)
    && (!temManutencao || abertas.length === 0)
    && (!temEstoque || estoqueAlerta.length === 0);

  return (
    <V2Surface className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Hoje</h2>
        {temEquipe && plantao.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users className="h-3.5 w-3.5" />
            De plantão agora: <strong className="text-ink">{plantao.map((p) => p.name).join(', ')}</strong>
          </p>
        )}
      </div>

      {nada ? (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <Check className="h-4 w-4" /> Nada pendente. A rotina do dia está em dia.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {temChecklist && pendencias.total > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                <ClipboardList className="h-3.5 w-3.5" /> Rotina
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{pendencias.total}</p>
              <p className="text-xs text-gray-600">
                {pendencias.total === 1 ? 'item pendente' : 'itens pendentes'} em{' '}
                {pendencias.pendentes.map((p) => p.title).join(', ')}
              </p>
            </div>
          )}
          {temManutencao && abertas.length > 0 && (
            <div className={`rounded-2xl border p-3 ${urgentes.length > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-paper'}`}>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                <Wrench className="h-3.5 w-3.5" /> Manutenção
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{abertas.length}</p>
              <p className="text-xs text-gray-600">
                {abertas.length === 1 ? 'ordem aberta' : 'ordens abertas'}
                {urgentes.length > 0 && <strong className="text-red-700"> · {urgentes.length} urgente(s)</strong>}
              </p>
            </div>
          )}
          {temEstoque && estoqueAlerta.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                <Boxes className="h-3.5 w-3.5" /> Estoque
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{estoqueAlerta.length}</p>
              <p className="text-xs text-gray-600">
                {estoqueAlerta.slice(0, 3).map((p) => p.name).join(', ')}
                {estoqueAlerta.length > 3 ? ` e mais ${estoqueAlerta.length - 3}` : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </V2Surface>
  );
}

/* ===================================================== 2. CHECKLIST ====== */

function ChecklistForm({ arenaId, checklist, onClose }) {
  const [form, setForm] = useState(() => ({
    title: checklist?.title || '',
    kind: checklist?.kind || CHECKLIST_KIND.OPENING,
    recurring: checklist?.recurring !== false,
    texto: (checklist?.items || []).map((i) => i.title).join('\n'),
  }));
  const criar = useCreateChecklist();
  const editar = useUpdateChecklist();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const itens = form.texto.split('\n').map((t) => t.trim()).filter(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    if (itens.length === 0) { toast.error('Escreva pelo menos um item.'); return; }
    const input = {
      title: form.title,
      kind: form.kind,
      recurring: form.recurring,
      items: itens.map((t, i) => ({ title: t, order: i })),
    };
    try {
      if (checklist) await editar.mutateAsync({ checklistId: checklist.id, input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(checklist ? 'Rotina atualizada.' : 'Rotina criada.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {checklist ? 'Editar rotina' : 'Nova rotina'}
        </h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Nome" htmlFor="cl-nome">
          <V2Input id="cl-nome" required maxLength={120} placeholder="Ex.: Abertura da manhã"
            value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </V2Field>
        <V2Field label="Tipo" htmlFor="cl-tipo" hint={CHECKLIST_KIND_META[form.kind]?.hint}>
          <select id="cl-tipo" value={form.kind} onChange={(e) => set({ kind: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            {Object.entries(CHECKLIST_KIND_META).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
        </V2Field>
      </div>
      <V2Field
        label="Itens" htmlFor="cl-itens" className="mt-3"
        hint={`Um por linha. ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}.`}
      >
        <V2Textarea id="cl-itens" rows={6}
          placeholder={'Ligar as luzes\nConferir as redes\nAbrir os vestiários'}
          value={form.texto} onChange={(e) => set({ texto: e.target.value })} />
      </V2Field>
      <label className="mt-3 flex items-start gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={form.recurring} className="mt-0.5 h-4 w-4 rounded border-gray-300"
          onChange={(e) => set({ recurring: e.target.checked })} />
        <span>
          <strong className="text-ink">Recomeça todo dia.</strong> Desmarcado, vira uma lista
          de tarefas comum — o que for marcado fica marcado.
        </span>
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={criar.isPending || editar.isPending}>
          {checklist ? 'Salvar' : 'Criar rotina'}
        </V2Button>
      </div>
    </form>
  );
}

function ChecklistCard({ checklist, hoje, onEditar }) {
  const toggle = useToggleChecklistItem();
  const apagar = useDeleteChecklist();
  const estado = checklistRunState(checklist, hoje);
  const meta = CHECKLIST_KIND_META[checklist.kind] || CHECKLIST_KIND_META[CHECKLIST_KIND.OPENING];
  const historico = (checklist.history || []).slice(-7).reverse();

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">{checklist.title || 'Rotina'}</p>
          <p className="text-xs text-gray-500">
            {meta.label}
            {estado.recurring ? ' · recomeça todo dia' : ' · lista fixa'}
            {estado.recurring && ` · ${formatDateShortBR(hoje)}`}
          </p>
        </div>
        <V2Badge tone={estado.complete ? 'green' : estado.done > 0 ? 'amber' : 'neutral'}>
          {estado.done}/{estado.total}
        </V2Badge>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${estado.complete ? 'bg-green-500' : 'bg-acid'}`}
          style={{ width: `${estado.progress}%` }} />
      </div>

      <ul className="mt-3 space-y-1">
        {estado.items.map((item, idx) => (
          <li key={`${item.title}-${idx}`}>
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={() => toggle.mutateAsync({ checklistId: checklist.id, itemIdx: idx })
                .catch((e) => toast.error(e?.message || 'Não foi possível marcar.'))}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-paper-pure"
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${item.completed ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-paper-pure'}`}>
                {item.completed && <Check className="h-3 w-3" />}
              </span>
              <span className={item.completed ? 'text-gray-400 line-through' : 'text-ink'}>
                {item.title}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {historico.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Últimos dias
          </p>
          <div className="flex flex-wrap gap-1.5">
            {historico.map((h) => (
              <span key={h.date}
                title={`${formatDateShortBR(h.date)} — ${h.done} de ${h.total}`}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${h.progress === 100 ? 'bg-green-100 text-green-800' : h.progress > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                {formatDateShortBR(h.date)} · {h.progress}%
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-1.5">
        <V2Button size="sm" variant="ghost" onClick={() => onEditar(checklist)}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
        </V2Button>
        <ConfirmDialog
          title={`Apagar "${checklist.title || 'esta rotina'}"?`}
          description="O histórico dos últimos dias vai junto. Se a rotina só está fora de uso, edite e deixe sem itens em vez de apagar."
          confirmLabel="Apagar"
          destructive
          onConfirm={() => apagar.mutateAsync({ checklistId: checklist.id })
            .then(() => toast.success('Rotina apagada.'))
            .catch((e) => toast.error(e?.message || 'Não foi possível apagar.'))}
          trigger={(
            <V2Button size="sm" variant="ghost" className="text-red-600">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
            </V2Button>
          )}
        />
      </div>
    </div>
  );
}

function ChecklistSecao({ arenaId, checklists, hoje, isLoading }) {
  const [form, setForm] = useState(null);   // null | 'novo' | checklist
  const virar = useRollChecklistDay();
  const jaVirou = useRef(false);

  // A virada do dia acontece ao ABRIR a tela: é o momento em que alguém da
  // arena está na frente do sistema. Uma função agendada faria a mesma coisa
  // e custaria uma Cloud Function para um problema que a tela resolve.
  // `useRef` porque o efeito reroda a cada mudança da lista, e virar duas
  // vezes seria gravação à toa (o serviço é idempotente, mas a escrita não).
  useEffect(() => {
    if (isLoading || jaVirou.current) return;
    const precisam = checklists.filter((c) => c.recurring !== false && c.run_date !== hoje);
    if (precisam.length === 0) return;
    jaVirou.current = true;
    virar.mutate({ arenaId, checklists: precisam, todayISO: hoje });
  }, [isLoading, checklists, hoje, arenaId, virar]);

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Rotinas do dia</h2>
        </div>
        {!form && (
          <V2Button size="sm" onClick={() => setForm('novo')}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova rotina
          </V2Button>
        )}
      </div>

      {form && (
        <ChecklistForm arenaId={arenaId} checklist={form === 'novo' ? null : form} onClose={() => setForm(null)} />
      )}

      {isLoading && <V2Skeleton className="h-32 rounded-2xl" />}

      {!isLoading && checklists.length === 0 && !form && (
        <V2EmptyState
          icon={ClipboardCheck}
          title="Nenhuma rotina ainda"
          description="Abertura e fechamento escritos uma vez, cumpridos todo dia, com registro de quem cumpriu. É o que tira a rotina do grupo de WhatsApp."
          action={<V2Button size="sm" onClick={() => setForm('novo')}>Criar a primeira</V2Button>}
        />
      )}

      {checklists.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {checklists.map((c) => (
            <ChecklistCard key={c.id} checklist={c} hoje={hoje} onEditar={setForm} />
          ))}
        </div>
      )}
    </V2Surface>
  );
}

/* ==================================================== 3. MANUTENÇÃO ====== */

function ManutencaoForm({ arenaId, courts, ordem, onClose }) {
  const [form, setForm] = useState(() => ({
    title: ordem?.title || '',
    description: ordem?.description || '',
    priority: ordem?.priority || MAINTENANCE_PRIORITY.MEDIUM,
    court_id: ordem?.court_id || '',
    blocks_court: Boolean(ordem?.blocks_court),
    starts_on: ordem?.starts_on || todayISO(),
    ends_on: ordem?.ends_on || '',
    start_time: ordem?.start_time || '08:00',
    end_time: ordem?.end_time || '18:00',
  }));
  const criar = useCreateMaintenance();
  const editar = useUpdateMaintenance();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const dias = form.blocks_court
    ? maintenanceDates({ starts_on: form.starts_on, ends_on: form.ends_on || form.starts_on })
    : [];
  const quadra = courts.find((c) => c.id === form.court_id);

  const submit = async (e) => {
    e.preventDefault();
    const input = { ...form, court_id: form.court_id || null, ends_on: form.ends_on || form.starts_on };
    try {
      if (ordem) await editar.mutateAsync({ arenaId, orderId: ordem.id, input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(ordem ? 'Ordem atualizada.' : 'Ordem criada.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar a ordem.');
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {ordem ? 'Editar ordem' : 'Nova ordem de manutenção'}
        </h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <V2Field label="O que precisa ser feito" htmlFor="mn-titulo">
        <V2Input id="mn-titulo" required maxLength={200} placeholder="Ex.: Trocar a rede da quadra 2"
          value={form.title} onChange={(e) => set({ title: e.target.value })} />
      </V2Field>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <V2Field label="Prioridade" htmlFor="mn-prio">
          <select id="mn-prio" value={form.priority} onChange={(e) => set({ priority: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            {Object.entries(MAINTENANCE_PRIORITY_META).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
        </V2Field>
        <V2Field label="Quadra" htmlFor="mn-quadra" hint="Vazio = a arena inteira.">
          <select id="mn-quadra" value={form.court_id} onChange={(e) => set({ court_id: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            <option value="">A arena inteira</option>
            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </V2Field>
      </div>

      <V2Field label="Detalhes" htmlFor="mn-desc" className="mt-3">
        <V2Textarea id="mn-desc" rows={2} maxLength={1000}
          placeholder="O que foi combinado, com quem, o que precisa comprar…"
          value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </V2Field>

      <label className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <input type="checkbox" checked={form.blocks_court} className="mt-0.5 h-4 w-4 rounded border-amber-300"
          onChange={(e) => set({ blocks_court: e.target.checked })} />
        <span>
          <strong>Tirar da venda enquanto durar.</strong> O horário sai do calendário e
          ninguém consegue reservar. Concluir a ordem devolve a quadra automaticamente.
        </span>
      </label>

      {form.blocks_court && (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <V2Field label="A partir de" htmlFor="mn-de">
              <V2Input id="mn-de" type="date" required value={form.starts_on}
                onChange={(e) => set({ starts_on: e.target.value })} />
            </V2Field>
            <V2Field label="Até" htmlFor="mn-ate" hint="Vazio = um dia só.">
              <V2Input id="mn-ate" type="date" value={form.ends_on}
                onChange={(e) => set({ ends_on: e.target.value })} />
            </V2Field>
            <V2Field label="Das" htmlFor="mn-h1">
              <V2Input id="mn-h1" type="time" value={form.start_time}
                onChange={(e) => set({ start_time: e.target.value })} />
            </V2Field>
            <V2Field label="Às" htmlFor="mn-h2">
              <V2Input id="mn-h2" type="time" value={form.end_time}
                onChange={(e) => set({ end_time: e.target.value })} />
            </V2Field>
          </div>
          {dias.length > 0 && (
            <p className="mt-2 rounded-2xl bg-paper-pure p-3 text-xs text-gray-600">
              Vai fechar <strong className="text-ink">{quadra ? quadra.name : 'todas as quadras'}</strong>{' '}
              em <strong className="text-ink">{dias.length}</strong> {dias.length === 1 ? 'dia' : 'dias'}
              {' '}({formatDateShortBR(dias[0])}
              {dias.length > 1 ? ` a ${formatDateShortBR(dias[dias.length - 1])}` : ''}),
              das {form.start_time} às {form.end_time}.
            </p>
          )}
        </>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={criar.isPending || editar.isPending}>
          {ordem ? 'Salvar' : 'Criar ordem'}
        </V2Button>
      </div>
    </form>
  );
}

function ManutencaoSecao({ arenaId, courts, ordens, isLoading }) {
  const mudarStatus = useUpdateMaintenanceStatus();
  const apagar = useDeleteMaintenance();
  const [form, setForm] = useState(null);
  const [verFechadas, setVerFechadas] = useState(false);

  const nomeQuadra = useMemo(
    () => new Map(courts.map((c) => [c.id, c.name])),
    [courts],
  );

  const abertas = ordens.filter(isMaintenanceOpen);
  const fechadas = ordens.filter((o) => !isMaintenanceOpen(o));
  const lista = verFechadas ? fechadas : abertas;

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Manutenção</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <V2Button size="sm" variant="ghost" onClick={() => setVerFechadas((v) => !v)}>
            {verFechadas ? `Abertas (${abertas.length})` : `Encerradas (${fechadas.length})`}
          </V2Button>
          {!form && (
            <V2Button size="sm" onClick={() => setForm('nova')}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova ordem
            </V2Button>
          )}
        </div>
      </div>

      {form && (
        <ManutencaoForm arenaId={arenaId} courts={courts}
          ordem={form === 'nova' ? null : form} onClose={() => setForm(null)} />
      )}

      {isLoading && <V2Skeleton className="h-24 rounded-2xl" />}

      {!isLoading && lista.length === 0 && !form && (
        <V2EmptyState
          icon={Wrench}
          title={verFechadas ? 'Nenhuma ordem encerrada' : 'Nenhuma ordem aberta'}
          description={verFechadas
            ? 'As ordens concluídas e canceladas ficam guardadas aqui.'
            : 'Conserto que vira ordem tem prazo, dono e — quando precisa — fecha a quadra no calendário.'}
        />
      )}

      <div className="space-y-2">
        {lista.map((o) => {
          const meta = MAINTENANCE_STATUS_META[o.status] || MAINTENANCE_STATUS_META[MAINTENANCE_STATUS.PENDING];
          const prio = MAINTENANCE_PRIORITY_META[o.priority] || MAINTENANCE_PRIORITY_META[MAINTENANCE_PRIORITY.MEDIUM];
          const dias = o.blocks_court ? maintenanceDates(o) : [];
          return (
            <div key={o.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{o.title}</p>
                  {o.description && <p className="mt-0.5 text-xs text-gray-500">{o.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <V2Badge tone={prio.tone}>{prio.label}</V2Badge>
                  <V2Badge tone={meta.tone}>{meta.label}</V2Badge>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                <span>{o.court_id ? (nomeQuadra.get(o.court_id) || 'Quadra removida') : 'Arena inteira'}</span>
                {o.blocks_court && dias.length > 0 && (
                  <span className="font-bold text-amber-700">
                    Fecha {formatDateShortBR(dias[0])}
                    {dias.length > 1 ? ` a ${formatDateShortBR(dias[dias.length - 1])}` : ''}
                    {' '}· {o.start_time}–{o.end_time}
                  </span>
                )}
                {!o.blocks_court && isMaintenanceOpen(o) && <span>Não tira nada da venda</span>}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {isMaintenanceOpen(o) && (
                  <>
                    {o.status === MAINTENANCE_STATUS.PENDING && (
                      <V2Button size="sm" variant="ghost" disabled={mudarStatus.isPending}
                        onClick={() => mudarStatus.mutateAsync({ arenaId, orderId: o.id, status: MAINTENANCE_STATUS.IN_PROGRESS })
                          .then(() => toast.success('Em andamento.'))
                          .catch((e) => toast.error(e?.message || 'Não foi possível.'))}>
                        Começar
                      </V2Button>
                    )}
                    <V2Button size="sm" disabled={mudarStatus.isPending}
                      onClick={() => mudarStatus.mutateAsync({ arenaId, orderId: o.id, status: MAINTENANCE_STATUS.DONE })
                        .then(() => toast.success(o.blocks_court ? 'Concluída — a quadra voltou à venda.' : 'Concluída.'))
                        .catch((e) => toast.error(e?.message || 'Não foi possível.'))}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Concluir
                    </V2Button>
                    <V2Button size="sm" variant="ghost" onClick={() => setForm(o)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </V2Button>
                    <ConfirmDialog
                      title="Cancelar esta ordem?"
                      description={o.blocks_court
                        ? 'A ordem fica registrada como cancelada e a quadra volta à venda.'
                        : 'A ordem fica registrada como cancelada.'}
                      confirmLabel="Cancelar a ordem"
                      destructive
                      onConfirm={() => mudarStatus.mutateAsync({ arenaId, orderId: o.id, status: MAINTENANCE_STATUS.CANCELLED })
                        .then(() => toast.success('Ordem cancelada.'))
                        .catch((e) => toast.error(e?.message || 'Não foi possível.'))}
                      trigger={<V2Button size="sm" variant="ghost" className="text-red-600">Cancelar</V2Button>}
                    />
                  </>
                )}
                {!isMaintenanceOpen(o) && (
                  <ConfirmDialog
                    title="Apagar do histórico?"
                    description="A ordem some de vez. O registro em auditoria permanece."
                    confirmLabel="Apagar"
                    destructive
                    onConfirm={() => apagar.mutateAsync({ arenaId, orderId: o.id })
                      .then(() => toast.success('Ordem apagada.'))
                      .catch((e) => toast.error(e?.message || 'Não foi possível apagar.'))}
                    trigger={(
                      <V2Button size="sm" variant="ghost" className="text-red-600">
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
                      </V2Button>
                    )}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </V2Surface>
  );
}

/* ======================================================= 4. ESTOQUE ====== */

function EstoqueSecao({ arenaId, alertas }) {
  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Estoque</h2>
        </div>
        <V2Button asChild size="sm" variant="ghost">
          <Link to={`/arenas/${arenaId}/gerir?secao=operacao&aba=mercado`}>Abrir o mercado</Link>
        </V2Button>
      </div>

      {alertas.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <Check className="h-4 w-4" /> Nenhum produto abaixo do mínimo nem perto de vencer.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            O que precisa de atenção. O estoque completo fica no mercado da arena — aqui
            está só o que não pode esperar.
          </p>
          {alertas.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{p.name}</p>
                <p className="text-xs text-gray-500">
                  {p.quantity} {p.unit || 'un'} em estoque
                  {p.min_stock ? ` · mínimo ${p.min_stock}` : ''}
                  {p.expiry_date ? ` · vence em ${formatDateShortBR(p.expiry_date)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {p.estoque === 'out' && <V2Badge tone="red">Esgotado</V2Badge>}
                {p.estoque === 'low' && <V2Badge tone="amber">Acabando</V2Badge>}
                {p.validade === 'expired' && <V2Badge tone="red">Vencido</V2Badge>}
                {p.validade === 'soon' && <V2Badge tone="amber">Vence em breve</V2Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </V2Surface>
  );
}

/* ======================================================== 5. EQUIPE ====== */

const STAFF_NOVO = { name: '', role: STAFF_ROLE.RECEPTION, shift: STAFF_SHIFT.FULL, active: true };

function EquipeSecao({ arenaId, staff, isLoading }) {
  const salvar = useSaveArenaStaff();
  const [rascunho, setRascunho] = useState(null);   // null = não está editando

  const lista = rascunho ?? staff;
  const plantao = useMemo(() => staffOnDuty(staff), [staff]);
  const grupos = useMemo(() => staffByRole(staff), [staff]);

  const editar = (i, patch) => setRascunho((r) => (r || staff).map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const remover = (i) => setRascunho((r) => (r || staff).filter((_, k) => k !== i));
  const incluir = () => setRascunho((r) => [...(r || staff), { ...STAFF_NOVO }]);

  const gravar = async () => {
    const invalido = lista.find((m) => !normalizeStaffMember(m).valid);
    if (invalido) { toast.error('Toda pessoa precisa de um nome.'); return; }
    try {
      await salvar.mutateAsync({ arenaId, staff: lista });
      toast.success('Equipe salva.');
      setRascunho(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Equipe</h2>
        </div>
        {rascunho === null ? (
          <V2Button size="sm" variant="ghost" onClick={() => setRascunho(staff.length > 0 ? [...staff] : [{ ...STAFF_NOVO }])}>
            <Pencil className="mr-1.5 h-4 w-4" /> Editar
          </V2Button>
        ) : (
          <div className="flex gap-1.5">
            <V2Button size="sm" variant="ghost" onClick={() => setRascunho(null)}>Cancelar</V2Button>
            <V2Button size="sm" disabled={salvar.isPending} onClick={gravar}>
              {salvar.isPending ? 'Salvando…' : 'Salvar equipe'}
            </V2Button>
          </div>
        )}
      </div>

      {isLoading && <V2Skeleton className="h-20 rounded-2xl" />}

      {rascunho === null ? (
        <>
          {staff.length === 0 ? (
            <V2EmptyState
              icon={Users}
              title="Ninguém cadastrado"
              description="Nome, função e turno. Serve para responder quem estava aqui quando alguma coisa aconteceu — e por isso não pede telefone nem documento."
              action={<V2Button size="sm" onClick={() => setRascunho([{ ...STAFF_NOVO }])}>Cadastrar a equipe</V2Button>}
            />
          ) : (
            <>
              {plantao.length > 0 && (
                <p className="mb-3 flex items-center gap-1.5 rounded-2xl bg-paper p-3 text-sm text-gray-600">
                  <Clock className="h-4 w-4 shrink-0 text-ink" />
                  De plantão agora: <strong className="text-ink">{plantao.map((p) => p.name).join(', ')}</strong>
                </p>
              )}
              <div className="space-y-3">
                {grupos.map((g) => (
                  <div key={g.role}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.people.map((m) => (
                        <span key={m.id || m.name}
                          className={`rounded-2xl border px-3 py-1.5 text-sm ${m.active === false ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-200 bg-paper text-ink'}`}>
                          {m.name}
                          <span className="ml-1.5 text-xs text-gray-500">
                            {(STAFF_SHIFT_META[m.shift] || STAFF_SHIFT_META[STAFF_SHIFT.FULL]).label}
                          </span>
                          {m.active === false && <span className="ml-1.5 text-xs">· inativo</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {lista.map((m, i) => (
            <div key={m.id || `novo-${i}`} className="grid gap-2 rounded-2xl border border-gray-100 bg-paper p-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <V2Input value={m.name} maxLength={80} placeholder="Nome"
                onChange={(e) => editar(i, { name: e.target.value })} />
              <select value={m.role} onChange={(e) => editar(i, { role: e.target.value })}
                className="h-11 rounded-2xl border border-gray-200 bg-paper-pure px-3 text-sm">
                {Object.entries(STAFF_ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={m.shift} onChange={(e) => editar(i, { shift: e.target.value })}
                className="h-11 rounded-2xl border border-gray-200 bg-paper-pure px-3 text-sm">
                {Object.entries(STAFF_SHIFT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button type="button" onClick={() => remover(i)} aria-label={`Remover ${m.name || 'pessoa'}`}
                className="justify-self-end rounded-full border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {lista.length < STAFF_MAX && (
            <V2Button variant="ghost" size="sm" onClick={incluir}>
              <Plus className="mr-1.5 h-4 w-4" /> Incluir pessoa
            </V2Button>
          )}
          <p className="pt-1 text-xs text-gray-500">
            Só nome, função e turno. Telefone e e-mail não entram aqui — quem trabalha na
            arena e tem conta na plataforma já tem esses dados no próprio perfil.
          </p>
        </div>
      )}
    </V2Surface>
  );
}

/* ======================================================== A PÁGINA ====== */

export default function V2ArenaOperations() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { data: checklists = [], isLoading: clCarregando } = useArenaChecklists(arenaId, { onlyActive: false });
  const { data: ordens = [], isLoading: mnCarregando } = useArenaMaintenance(arenaId);
  const { data: staff = [], isLoading: eqCarregando } = useArenaStaff(arenaId);
  const { data: produtos = [] } = useInventoryProducts(arenaId);
  const { data: entradas = [] } = useInventoryEntries(arenaId);
  const { data: saidas = [] } = useInventoryExits(arenaId);

  const hoje = todayISO();

  const pendencias = useMemo(
    () => checklistsPendingToday(checklists, hoje),
    [checklists, hoje],
  );

  // O alerta de estoque é o que a arena precisa ver de manhã. A quantidade
  // sai de entradas − saídas (não há campo `quantity` no produto), e só entra
  // na lista o que está acabando, esgotado, vencido ou perto de vencer.
  const estoqueAlerta = useMemo(() => produtos
    .filter((p) => p.active !== false)
    .map((p) => {
      const { quantity } = calculateStock(p.id, entradas, saidas);
      return {
        ...p,
        quantity,
        estoque: stockStatus(quantity, p.min_stock),
        validade: expiryStatus(p.expiry_date, { today: hoje }),
      };
    })
    .filter((p) => p.estoque !== 'ok' || p.validade === 'expired' || p.validade === 'soon')
    .sort((a, b) => a.quantity - b.quantity),
  [produtos, entradas, saidas, hoje]);

  const plantao = useMemo(() => staffOnDuty(staff), [staff]);

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[1100px] rounded-4xl" />;
  }

  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            title="Arena não encontrada"
            action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar ao diretório</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const podeGerir = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;

  if (!podeGerir || !isOn(ARENA_MODULE_ID.OPERATIONS)) {
    return <Navigate to={`/arenas/${arenaId}`} replace />;
  }

  const temChecklist = isOn(ARENA_MODULE_ID.OPERATIONS_CHECKLIST);
  const temManutencao = isOn(ARENA_MODULE_ID.OPERATIONS_MAINTENANCE);
  const temEstoque = isOn(ARENA_MODULE_ID.OPERATIONS_INVENTORY);
  const temEquipe = isOn(ARENA_MODULE_ID.OPERATIONS_STAFF);
  const nenhum = !temChecklist && !temManutencao && !temEstoque && !temEquipe;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a gestão
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Operação</h1>
        <p className="mt-2 font-medium text-gray-500">
          {arena.name} · rotina, conserto, estoque e equipe.
        </p>
      </div>

      {nenhum ? (
        <V2Surface>
          <V2EmptyState
            icon={Package}
            title="Nenhuma ferramenta de operação ativa"
            description="Ative o que quiser usar em Gestão → Configurações → Módulos. Cada ferramenta liga separadamente."
            action={(
              <Link to={`/arenas/${arena.id}/gerir?secao=configuracoes&aba=modulos`} className="text-sm font-bold text-ink underline">
                Abrir os módulos
              </Link>
            )}
          />
        </V2Surface>
      ) : (
        <>
          <ResumoDoDia
            pendencias={pendencias}
            ordens={ordens}
            estoqueAlerta={estoqueAlerta}
            plantao={plantao}
            temChecklist={temChecklist}
            temManutencao={temManutencao}
            temEstoque={temEstoque}
            temEquipe={temEquipe}
          />

          <div className="space-y-6">
            {temChecklist && (
              <ChecklistSecao arenaId={arena.id} checklists={checklists} hoje={hoje} isLoading={clCarregando} />
            )}
            {temManutencao && (
              <ManutencaoSecao arenaId={arena.id} courts={courts} ordens={ordens} isLoading={mnCarregando} />
            )}
            {temEstoque && <EstoqueSecao arenaId={arena.id} alertas={estoqueAlerta} />}
            {temEquipe && <EquipeSecao arenaId={arena.id} staff={staff} isLoading={eqCarregando} />}
          </div>
        </>
      )}

      {temManutencao && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Ordem que <strong className="text-ink">tira a quadra da venda</strong> aparece no
          calendário como &ldquo;Manutenção programada&rdquo;, sem o motivo — quem vai jogar
          não precisa saber que a fechadura do vestiário quebrou. Concluir ou cancelar a
          ordem devolve o horário à venda na hora.
        </p>
      )}
    </div>
  );
}
