/**
 * O cartão GRUPOS do Play (flag `play_groups`).
 *
 * Fica acima de Participantes no organizador do Play e é montado pelo
 * `GameDayModule` nas três origens (atleta, arena, clube) — por isso a arena e o
 * clube recebem os grupos sem ninguém lembrar de montá-lo lá.
 *
 * Três estados:
 *  1. **Sem grupos** — um convite com três atalhos (por nível, por tipo de dupla,
 *     em branco). Quem só OPERA o dia (administrador nomeado) não vê nada: não há
 *     o que operar até alguém criar os grupos.
 *  2. **Com grupos** — a política entre eles, uma linha por grupo dizendo
 *     QUEM é, COMO joga e POR QUE joga ou não, a fila de quem está sem grupo e os
 *     avisos de configuração.
 *  3. **Editando / distribuindo** — inline, no próprio cartão. Sem modal.
 *
 * Quem pode o quê segue o resto do dia de jogo: configurar os grupos (criar,
 * editar, pausar, ordenar, remover) é de quem CONFIGURA o dia; mover gente entre
 * eles e distribuir por nível é de quem CONDUZ as partidas.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Info, LayoutGrid, Pencil, PauseCircle, PlayCircle,
  Plus, Trash2, UsersRound, Users, Wand2,
} from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { V2Button } from '@/v2/ui/primitives';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { cn } from '@/core/lib/utils';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import {
  GROUP_POLICY, GROUP_POLICY_HINTS, GROUP_POLICY_LABELS, PLAY_GROUP_COLORS, PLAY_GROUP_LIMITS,
  PLAY_GROUP_TEMPLATES, buildTemplateGroups, describeGroupRules, groupsConfigWarnings, newGroupId,
  normalizePlayGroup,
} from '@/modules/games/domain/playGroups';
import { explainGroups } from '@/modules/games/domain/playGroupsDraw';
import { useAssignPlayGroups, useSetPlayGroups } from '@/modules/games/hooks/usePlayGroupMutations';
import { PlayGroupBadge, NoGroupBadge } from './PlayGroupBadge';
import GroupEditor from './GroupEditor';
import DistributePanel from './DistributePanel';

const NOVO = '__novo__';

/** O ícone e a cor da frase de status de cada grupo. */
const STATUS = {
  ready: { Icone: CheckCircle2, classe: 'text-emerald-700' },
  short: { Icone: Users, classe: 'text-amber-700' },
  blocked: { Icone: AlertTriangle, classe: 'text-amber-700' },
  no_court: { Icone: LayoutGrid, classe: 'text-amber-700' },
  paused: { Icone: PauseCircle, classe: 'text-gray-500' },
  empty: { Icone: Info, classe: 'text-gray-500' },
  idle: { Icone: Info, classe: 'text-gray-500' },
};

const plural = (n, um, varios) => (n === 1 ? um : varios);

function contagem(ex) {
  const partes = [`${ex.total} ${plural(ex.total, 'pessoa', 'pessoas')}`];
  if (ex.waiting > 0) partes.push(`${ex.waiting} aguardando`);
  if (ex.inCourt > 0) partes.push(`${ex.inCourt} em quadra`);
  if (ex.pausados > 0) partes.push(`${ex.pausados} ${plural(ex.pausados, 'pausado', 'pausados')}`);
  return partes.join(' · ');
}

function BotaoIcone({ label, onClick, disabled, children, className }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors',
        'hover:bg-gray-100 hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40 disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

function StatusLinha({ ex }) {
  const st = STATUS[ex.status] || STATUS.idle;
  return (
    <p className={cn('mt-2 flex items-start gap-1.5 text-xs leading-5', st.classe)}>
      <st.Icone aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{ex.reason}</span>
    </p>
  );
}

function Chips({ group }) {
  const chips = describeGroupRules(group);
  if (chips.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li key={c.key} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          {c.label}
        </li>
      ))}
    </ul>
  );
}

function LinhaDoGrupo({
  group, ex, indice, total, politica, podeConfigurar, salvando, onEditar, onPausar, onMover, onRemover,
}) {
  return (
    <li className={cn('rounded-lg border border-gray-100 bg-white p-3', group.paused && 'opacity-80')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {politica !== GROUP_POLICY.QUEUE && (
          <span
            className="w-5 text-xs font-bold tabular-nums text-gray-400"
            title={politica === GROUP_POLICY.PRIORITY ? 'Posição na prioridade' : 'Posição no revezamento'}
          >
            {indice + 1}º
          </span>
        )}
        <PlayGroupBadge name={group.name} color={group.color} />
        <span className="min-w-0 flex-1 text-xs tabular-nums text-gray-500">{ex ? contagem(ex) : ''}</span>
        {podeConfigurar && (
          <div className="flex items-center">
            {total > 1 && (
              <>
                <BotaoIcone label={`Subir ${group.name} na lista`} onClick={() => onMover(-1)} disabled={salvando || indice === 0}>
                  <ArrowUp aria-hidden="true" className="h-4 w-4" />
                </BotaoIcone>
                <BotaoIcone label={`Descer ${group.name} na lista`} onClick={() => onMover(1)} disabled={salvando || indice === total - 1}>
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </BotaoIcone>
              </>
            )}
            <BotaoIcone
              label={group.paused ? `Retomar o grupo ${group.name}` : `Pausar o grupo ${group.name}`}
              onClick={onPausar}
              disabled={salvando}
            >
              {group.paused
                ? <PlayCircle aria-hidden="true" className="h-4 w-4" />
                : <PauseCircle aria-hidden="true" className="h-4 w-4" />}
            </BotaoIcone>
            <BotaoIcone label={`Editar o grupo ${group.name}`} onClick={onEditar} disabled={salvando}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </BotaoIcone>
            <BotaoIcone label={`Remover o grupo ${group.name}`} onClick={onRemover} disabled={salvando} className="hover:text-red-600">
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </BotaoIcone>
          </div>
        )}
      </div>
      <Chips group={group} />
      {ex && <StatusLinha ex={ex} />}
    </li>
  );
}

function Convite({ podeConfigurar, salvando, onModelo, onZero }) {
  if (!podeConfigurar) return null;
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-base font-bold text-ink">Divida o Play em grupos</h4>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          Cada grupo tem a sua fila e joga entre si — por nível, por tipo de dupla ou só uma turma. As
          quadras, a ordem e as regras de cada um você ajusta depois.
        </p>
      </div>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
        {PLAY_GROUP_TEMPLATES.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-[12rem] flex-1">
              <p className="text-sm font-semibold text-ink">{t.label}</p>
              <p className="text-xs leading-5 text-gray-500">{t.description}</p>
            </div>
            <V2Button size="sm" variant="ghost" onClick={() => onModelo(t.id)} disabled={salvando}>
              Usar este
            </V2Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">
        Prefere montar do zero?{' '}
        <button type="button" onClick={onZero} className="font-semibold text-ink underline underline-offset-2">
          Criar um grupo
        </button>
        .
      </p>
    </div>
  );
}

function Politica({ valor, podeConfigurar, salvando, onChange }) {
  if (!podeConfigurar) {
    return (
      <p className="text-xs leading-5 text-gray-500">
        <strong className="font-semibold text-ink">{GROUP_POLICY_LABELS[valor]}.</strong> {GROUP_POLICY_HINTS[valor]}
      </p>
    );
  }
  return (
    <div role="radiogroup" aria-label="Quando mais de um grupo quer a quadra" className="space-y-2">
      <p className="text-sm font-bold text-ink">Quando mais de um grupo quer a quadra</p>
      {Object.values(GROUP_POLICY).map((p) => (
        <label key={p} className="flex cursor-pointer items-start gap-2.5">
          <input
            type="radio"
            name="politica-grupos"
            checked={valor === p}
            disabled={salvando}
            onChange={() => onChange(p)}
            className="mt-1 h-4 w-4 accent-[#0B0F19]"
          />
          <span>
            <span className="text-sm font-semibold text-ink">{GROUP_POLICY_LABELS[p]}</span>
            <span className="block text-xs leading-5 text-gray-500">{GROUP_POLICY_HINTS[p]}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   gameDay: object, participants: Array, view: object, grupos: object,
 *   podeConfigurar: boolean, canManage: boolean, courts: number,
 *   slots?: number, freeCourts?: number[],
 * }} props
 *   `grupos` é o que `usePlayGroupsContext` devolve; `participants` já vêm com
 *   o nível resolvido.
 */
export default function PlayGroupsCard({
  gameDay, participants, view, grupos, podeConfigurar, canManage, courts, slots = 4, freeCourts = null,
}) {
  const setGroups = useSetPlayGroups(gameDay.id);
  const assign = useAssignPlayGroups(gameDay.id);
  const [editando, setEditando] = useState(null); // id do grupo | NOVO
  const [distribuindo, setDistribuindo] = useState(false);
  const [removendo, setRemovendo] = useState(null); // grupo

  const { config } = grupos;
  const temGrupos = config.groups.length > 0;
  const salvando = setGroups.isPending;

  const explicacoes = useMemo(
    () => (temGrupos ? explainGroups({ view, config, slots, freeCourts }) : []),
    [temGrupos, view, config, slots, freeCourts],
  );
  const exDe = (id) => explicacoes.find((e) => e.id === id) || null;
  const avisos = useMemo(
    () => groupsConfigWarnings(config, { courts, participants }),
    [config, courts, participants],
  );

  if (!grupos.configuravel) return null;
  if (!podeConfigurar && !temGrupos) return null;

  const salvar = async (groups, politica = config.policy, sucesso = null) => {
    try {
      await setGroups.mutateAsync({ groups, policy: politica });
      if (sucesso) toast.success(sucesso);
      return true;
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar os grupos.');
      return false;
    }
  };

  const salvarGrupo = async (grupo) => {
    const lista = editando === NOVO
      ? [...config.groups, grupo]
      : config.groups.map((g) => (g.id === grupo.id ? grupo : g));
    const ok = await salvar(lista, config.policy, editando === NOVO ? 'Grupo criado.' : 'Grupo salvo.');
    if (ok) setEditando(null);
  };

  const mover = (indice, delta) => {
    const lista = config.groups.slice();
    const alvo = indice + delta;
    if (alvo < 0 || alvo >= lista.length) return;
    [lista[indice], lista[alvo]] = [lista[alvo], lista[indice]];
    salvar(lista);
  };

  const novoGrupo = () => normalizePlayGroup({
    id: newGroupId(),
    color: PLAY_GROUP_COLORS[config.groups.length % PLAY_GROUP_COLORS.length],
  }, config.groups.length);

  const aplicarDistribuicao = async (assignments) => {
    try {
      const r = await assign.mutateAsync(assignments);
      toast.success(`${r.updated} ${plural(r.updated, 'pessoa colocada', 'pessoas colocadas')} nos grupos.`);
      setDistribuindo(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível distribuir.');
    }
  };

  const confirmarRemocao = async () => {
    const g = removendo;
    setRemovendo(null);
    if (g) await salvar(config.groups.filter((x) => x.id !== g.id), config.policy, `Grupo ${g.name} removido.`);
  };

  const semGrupo = exDe(null);
  const prontos = explicacoes.filter((e) => e.id !== null && e.status === 'ready').length;
  const noMaximo = config.groups.length >= PLAY_GROUP_LIMITS.MAX_GROUPS;
  const resumo = temGrupos
    ? [
      `${config.groups.length} ${plural(config.groups.length, 'grupo', 'grupos')}`,
      `${prontos} ${plural(prontos, 'pronto', 'prontos')}`,
      semGrupo ? `${semGrupo.total} sem grupo` : null,
    ].filter(Boolean).join(' · ')
    : 'Nenhum grupo ainda';

  return (
    <V2CollapsibleCard
      icon={UsersRound}
      title="Grupos"
      count={temGrupos ? config.groups.length : null}
      dica="dia-de-jogo-grupos"
      sectionId={GAME_DAY_SECTION.PLAY_GROUPS}
      summary={resumo}
      actions={temGrupos && !editando && (
        <>
          {canManage && (
            <V2Button size="sm" variant="ghost" onClick={() => setDistribuindo((v) => !v)} data-dica="dia-de-jogo-grupos-distribuir">
              <Wand2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Distribuir por nível
            </V2Button>
          )}
          {podeConfigurar && (
            <V2Button size="sm" variant="ghost" onClick={() => setEditando(NOVO)} disabled={noMaximo} data-dica="dia-de-jogo-grupos-novo">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Novo grupo
            </V2Button>
          )}
        </>
      )}
    >
      <div className="space-y-4">
        {distribuindo && canManage && (
          <DistributePanel
            participants={participants}
            config={config}
            applying={assign.isPending}
            onApply={aplicarDistribuicao}
            onCancel={() => setDistribuindo(false)}
          />
        )}

        {!temGrupos && editando !== NOVO && (
          <Convite
            podeConfigurar={podeConfigurar}
            salvando={salvando}
            onModelo={(id) => salvar(buildTemplateGroups(id), config.policy, 'Grupos criados — ajuste o que precisar.')}
            onZero={() => setEditando(NOVO)}
          />
        )}

        {!temGrupos && editando === NOVO && (
          <GroupEditor
            isNew
            group={novoGrupo()}
            courts={courts}
            otherNames={[]}
            saving={salvando}
            onSave={salvarGrupo}
            onCancel={() => setEditando(null)}
          />
        )}

        {temGrupos && (
          <>
            {config.groups.length > 1 && (
              <Politica
                valor={config.policy}
                podeConfigurar={podeConfigurar}
                salvando={salvando}
                onChange={(p) => salvar(config.groups, p, 'Política atualizada.')}
              />
            )}

            <ul className="space-y-2">
              {config.groups.map((g, i) => (editando === g.id ? (
                <li key={g.id} className="rounded-lg border border-gray-200 bg-paper p-4">
                  <GroupEditor
                    group={g}
                    courts={courts}
                    otherNames={config.groups.filter((x) => x.id !== g.id).map((x) => x.name)}
                    saving={salvando}
                    onSave={salvarGrupo}
                    onCancel={() => setEditando(null)}
                  />
                </li>
              ) : (
                <LinhaDoGrupo
                  key={g.id}
                  group={g}
                  ex={exDe(g.id)}
                  indice={i}
                  total={config.groups.length}
                  politica={config.policy}
                  podeConfigurar={podeConfigurar && !editando}
                  salvando={salvando}
                  onEditar={() => setEditando(g.id)}
                  onPausar={() => salvar(
                    config.groups.map((x) => (x.id === g.id ? { ...x, paused: !x.paused } : x)),
                    config.policy,
                    g.paused ? `Grupo ${g.name} de volta ao sorteio.` : `Grupo ${g.name} em pausa.`,
                  )}
                  onMover={(d) => mover(i, d)}
                  onRemover={() => setRemovendo(g)}
                />
              )))}

              {editando === NOVO && (
                <li className="rounded-lg border border-gray-200 bg-paper p-4">
                  <GroupEditor
                    isNew
                    group={novoGrupo()}
                    courts={courts}
                    otherNames={config.groups.map((x) => x.name)}
                    saving={salvando}
                    onSave={salvarGrupo}
                    onCancel={() => setEditando(null)}
                  />
                </li>
              )}

              {semGrupo && (
                <li className="rounded-lg border border-dashed border-gray-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <NoGroupBadge />
                    <span className="min-w-0 flex-1 text-xs tabular-nums text-gray-500">{contagem(semGrupo)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    Jogam entre si, em qualquer quadra livre — e podem completar um grupo que tenha esse ajuste.
                    {canManage && ' Use “Distribuir por nível” para colocá-los nos grupos.'}
                  </p>
                </li>
              )}
            </ul>

            {avisos.length > 0 && (
              <ul className="space-y-1.5" aria-label="Avisos sobre os grupos">
                {avisos.map((a) => (
                  <li
                    key={a.key}
                    className={cn(
                      'flex items-start gap-1.5 text-xs leading-5',
                      a.tone === 'amber' ? 'text-amber-800' : 'text-gray-500',
                    )}
                  >
                    {a.tone === 'amber'
                      ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      : <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {!podeConfigurar && (
              <p className="text-[11px] leading-5 text-gray-400">
                Só quem criou o dia cria, edita e pausa os grupos. Você move as pessoas entre eles.
              </p>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!removendo}
        onOpenChange={(v) => !v && setRemovendo(null)}
        destructive
        title={`Remover o grupo ${removendo?.name ?? ''}?`}
        description="Quem está nele fica sem grupo e passa a jogar na fila de quem está sem grupo. Nenhuma partida é apagada."
        confirmLabel="Remover grupo"
        onConfirm={confirmarRemocao}
      />
    </V2CollapsibleCard>
  );
}
