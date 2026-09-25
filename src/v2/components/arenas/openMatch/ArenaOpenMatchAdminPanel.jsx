/**
 * O jogo aberto na CENTRAL da arena — a arena publica horários com vagas.
 *
 * Era a página `/arenas/:arenaId/gerir/open-match`, alcançada por um botão no
 * topo da Central; virou a aba **Jogo aberto** (`?aba=jogo-aberto`). A rota
 * antiga continua existindo e leva para cá (notificação antiga aponta para ela).
 *
 * O que a aba acrescentou à tela antiga:
 *  - **quem vem jogar**: a vaga dizia "3 de 4" e a arena não sabia QUEM eram
 *    os três — nome e foto saem do diretório de atletas;
 *  - **a fila de cada jogo**: quantos esperam e quem foi chamado, numa
 *    consulta só para a arena inteira.
 *
 * O que continua igual, e por quê:
 *  1. **A quadra é ESCOLHIDA, não digitada** — publicar OCUPA o horário.
 *  2. **O nível está na régua da plataforma (2.0–8.0).**
 *  3. **Conflito é dito na hora** — em cima de reserva, dia de jogo ou outra
 *     vaga, a publicação é recusada com o motivo.
 *
 * Onda CA — **o jogo aberto é um DIA DE JOGO**. Publicar cria os dois (o
 * formulário pergunta o formato e quem conduz), e cada cartão leva ao dia de
 * jogo, onde se sorteia, lança placar e abre o telão. O jogo aberto antigo,
 * sem dia de jogo, ganha o botão "Criar o dia de jogo" — por escolha da arena,
 * um de cada vez; nada é migrado em lote.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowRight, BellRing, CalendarDays, Info, Pencil, Plus, Swords, Trash2,
} from 'lucide-react';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  useArenaOpenSlots,
  useArenaWaitlist,
  useCancelOpenSlot,
  useDeleteOpenSlot,
} from '@/modules/arenas/hooks/useArenaV3';
import { useGameDay } from '@/modules/games/hooks/useGameDays';
import {
  computeSlotStatus,
  slotLevelRangeLabel,
} from '@/modules/arenas/domain/openMatch';
import { OPEN_SLOT_FORMAT_LABEL, waitlistBySlot } from '@/modules/arenas/domain/openMatchView';
import { isLinkedOpenSlot, openMatchFormatLabel } from '@/modules/arenas/domain/openMatchGameDay';
import { formatSlotLabel, todayISO } from '@/modules/arenas/domain/calendar';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import OpenMatchForm from './OpenMatchForm';

const FORMATO_LABEL = OPEN_SLOT_FORMAT_LABEL;

/**
 * Editar um jogo aberto ligado: o formulário precisa do DIA DE JOGO (formato,
 * nome, quem conduz), que mora no outro documento.
 */
function EditarJogo({ arenaId, courts, slot, onClose }) {
  const { data: gameDay, isLoading, isError, refetch } = useGameDay(slot.game_day_id);
  if (isLoading) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (isError) {
    return (
      <V2Surface>
        <V2ErrorState title="Não foi possível abrir o dia de jogo deste jogo aberto"
          description="Ele continua lá — tente de novo." onRetry={() => refetch()} />
      </V2Surface>
    );
  }
  return <OpenMatchForm arenaId={arenaId} courts={courts} mode="edit" slot={slot} gameDay={gameDay} onClose={onClose} />;
}

/* --------------------------------- cartão ---------------------------------- */

function VagaCard({ slot, onCancel, onDelete, onEdit, onLink, pessoas = [], fila = null }) {
  const situacao = computeSlotStatus(slot);
  const inscritos = (slot.participants || []).length;
  const total = slot.total_spots || 0;
  const pct = total > 0 ? Math.round((inscritos / total) * 100) : 0;
  const faixa = slotLevelRangeLabel(slot);
  const cancelada = slot.status === 'cancelled';

  const tom = cancelada ? 'red'
    : situacao === 'full' ? 'amber'
      : situacao === 'completed' ? 'neutral' : 'green';
  const rotulo = cancelada ? 'Cancelado'
    : situacao === 'full' ? 'Lotado'
      : situacao === 'completed' ? 'Encerrado'
        : `${inscritos} de ${total}`;

  const ligado = isLinkedOpenSlot(slot);
  const ativo = !cancelada && situacao !== 'completed';
  // Um jogo aberto ANTIGO (sem dia de jogo) com quadra e ainda por acontecer
  // pode ganhar o dia de jogo dele — por escolha da arena.
  const podeLigar = !ligado && ativo && Boolean(slot.court_id) && String(slot.date || '') >= todayISO();

  return (
    <div className={`rounded-2xl border p-4 ${cancelada ? 'border-gray-100 bg-paper opacity-70' : 'border-gray-100 bg-paper-pure'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">{formatSlotLabel(slot)}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {slot.court || 'Sem quadra definida'}
            {slot.format ? ` · ${FORMATO_LABEL[slot.format] || slot.format}` : ''}
          </p>
          {ligado && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink">
              <Swords className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              Dia de jogo{slot.game_format ? ` · ${openMatchFormatLabel(slot.game_format)}` : ''}
            </p>
          )}
        </div>
        <V2Badge tone={tom}>{rotulo}</V2Badge>
      </div>

      {!cancelada && total > 0 && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${pct >= 100 ? 'bg-amber-400' : 'bg-acid'}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {faixa && <V2Badge tone="blue">Nível {faixa}</V2Badge>}
        {Number.isFinite(slot.price) && slot.price > 0 && (
          <V2Badge tone="neutral">{formatPrice(Number(slot.price))} por atleta</V2Badge>
        )}
        {!slot.court_id && (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <AlertTriangle className="h-3 w-3" /> não ocupa a quadra
          </span>
        )}
      </div>

      {slot.notes && <p className="mt-2 text-xs leading-5 text-gray-500">{slot.notes}</p>}

      {/* QUEM vem jogar — a vaga dizia "3 de 4" e a arena não sabia quem
          eram os três. Quem não está no diretório aparece como "Atleta". */}
      {pessoas.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Quem vem</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pessoas.map((p) => (
              <span key={p.uid} className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-paper py-0.5 pl-0.5 pr-2.5 text-xs text-ink">
                <V2Avatar photoUrl={p.photo} name={p.name} size="xs" /> {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {fila && (fila.esperando > 0 || fila.chamado) && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-600">
          <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>
            {fila.esperando > 0 && (
              <>Fila de espera: <strong className="text-ink">{fila.esperando}</strong>
                {fila.nomes.length > 0 ? ` (${fila.nomes.slice(0, 3).join(', ')}${fila.nomes.length > 3 ? '…' : ''})` : ''}. </>
            )}
            {fila.chamado && (
              <>Chamado agora: <strong className="text-ink">{fila.chamado.athlete_name || 'Atleta'}</strong> — tem até o prazo para confirmar.</>
            )}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ligado && !cancelada && (
          <V2Button asChild size="sm">
            <Link to={`/dia-de-jogo/${slot.game_day_id}`}>
              Organizar o jogo <ArrowRight className="h-4 w-4" />
            </Link>
          </V2Button>
        )}
        {ligado && ativo && onEdit && (
          <V2Button variant="ghost" size="sm" onClick={() => onEdit(slot)}>
            <Pencil className="h-4 w-4" /> Editar
          </V2Button>
        )}
        {podeLigar && onLink && (
          <V2Button variant="secondary" size="sm" onClick={() => onLink(slot)}>
            <Swords className="h-4 w-4" /> Criar o dia de jogo
          </V2Button>
        )}
        {!cancelada && situacao !== 'completed' && (
          <ConfirmDialog
            title="Cancelar este jogo aberto?"
            description={
              `${inscritos > 0 ? `${inscritos} atleta(s) já estão inscritos e serão avisados. ` : ''}`
              + `${ligado ? 'O dia de jogo é encerrado junto, e as quadras voltam a ficar livres para reserva.' : 'A quadra volta a ficar livre para reserva.'}`
            }
            confirmLabel="Cancelar jogo"
            onConfirm={() => onCancel(slot.id)}
            trigger={<V2Button variant="ghost" size="sm">Cancelar jogo</V2Button>}
          />
        )}
        <ConfirmDialog
          title="Excluir definitivamente?"
          description={ligado
            ? 'O jogo aberto some do histórico e o dia de jogo é encerrado (o que já se jogou nele continua registrado). Para apenas tirar do ar, prefira cancelar.'
            : 'O registro some do histórico. Para apenas tirar do ar, prefira cancelar.'}
          confirmLabel="Excluir"
          destructive
          onConfirm={() => onDelete(slot.id)}
          trigger={(
            <V2Button variant="ghost" size="sm" className="text-red-600">
              <Trash2 className="h-4 w-4" /> Excluir
            </V2Button>
          )}
        />
      </div>
    </div>
  );
}

/* ---------------------------------- painel ---------------------------------- */

/**
 * @param {{ arena: object }} props
 */
export default function ArenaOpenMatchAdminPanel({ arena }) {
  const arenaId = arena.id;
  // ⚠️ Falha não é vazio: com a leitura das quadras falhando, dizer "esta
  // arena não tem quadras" mandaria a arena cadastrar de novo o que já existe.
  const {
    data: courts = [], isError: falhouQuadras, isLoading: carregandoQuadras, refetch: recarregarQuadras,
  } = useArenaCourts(arenaId);
  const {
    data: slots = [], isLoading: carregandoVagas, isError, refetch,
  } = useArenaOpenSlots(arenaId);
  const { data: filaDaArena = [] } = useArenaWaitlist(arenaId);
  const { data: atletas = [] } = useAthletes();
  const cancelar = useCancelOpenSlot();
  const excluir = useDeleteOpenSlot();
  // Um formulário por vez: publicar, editar um jogo ou ligar um antigo.
  const [formulario, setFormulario] = useState(null); // { mode, slot? }
  const criando = formulario?.mode === 'create';
  const fechar = () => setFormulario(null);

  const quadrasAtivas = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const hoje = todayISO();
  const { futuras, passadas } = useMemo(() => ({
    futuras: slots.filter((s) => String(s.date || '') >= hoje),
    passadas: slots.filter((s) => String(s.date || '') < hoje).reverse(),
  }), [slots, hoje]);
  const filaPorVaga = useMemo(() => waitlistBySlot(filaDaArena), [filaDaArena]);
  const porUid = useMemo(() => new Map(atletas.map((a) => [a.id || a.uid, a])), [atletas]);
  const pessoasDe = (slot) => (slot.participants || []).map((uid) => {
    const a = porUid.get(uid);
    return { uid, name: a?.platform_name || a?.full_name || 'Atleta', photo: a?.photo_url || '' };
  });
  const nomesDe = (slot) => Object.fromEntries(pessoasDe(slot).map((p) => [p.uid, p.name]));
  const abrirEdicao = (slot) => setFormulario({ mode: 'edit', slot });
  const abrirLigacao = (slot) => setFormulario({ mode: 'link', slot });

  const aoCancelar = (id) => cancelar.mutateAsync({ slotId: id })
    .then(() => toast.success('Jogo cancelado. A quadra voltou a ficar livre.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível cancelar.'));
  const aoExcluir = (id) => excluir.mutateAsync(id)
    .then(() => toast.success('Excluído.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível excluir.'));

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Jogo aberto</h2>
            <p className="mt-1 text-sm text-gray-500">
              Publique um horário com vagas e deixe os atletas do nível certo preencherem — sem
              ninguém precisar montar o grupo. O jogo aparece na página da arena e vira um dia de
              jogo: sorteio, placar, ranking do dia e telão.
            </p>
          </div>
          {!formulario && !falhouQuadras && (
            <V2Button onClick={() => setFormulario({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> Publicar jogo
            </V2Button>
          )}
        </div>

        {falhouQuadras && (
          <V2ErrorState inline className="mt-4" title="Não foi possível carregar as quadras"
            description="Sem elas não dá para publicar nem editar um jogo — tente de novo." onRetry={() => recarregarQuadras()} />
        )}

        {!falhouQuadras && !carregandoQuadras && quadrasAtivas.length === 0 && (
          <p className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Esta arena ainda não tem quadras ativas. O jogo aberto acontece em quadras — cadastre
              ao menos uma para publicar.{' '}
              <Link to={`/arenas/${arenaId}/gerir?aba=quadras`} className="font-bold underline">
                Cadastrar quadras
              </Link>
            </span>
          </p>
        )}

        {formulario && !falhouQuadras && (
          <div className="mt-4">
            {formulario.mode === 'edit' ? (
              <EditarJogo arenaId={arenaId} courts={quadrasAtivas} slot={formulario.slot} onClose={fechar} />
            ) : (
              <OpenMatchForm
                arenaId={arenaId} courts={quadrasAtivas} mode={formulario.mode}
                slot={formulario.slot || null} names={formulario.slot ? nomesDe(formulario.slot) : {}}
                onClose={fechar}
              />
            )}
          </div>
        )}
      </V2Surface>

      {isError ? (
        <V2Surface>
          <V2ErrorState title="Não foi possível carregar os jogos abertos"
            description="Os jogos publicados continuam lá — tente de novo." onRetry={() => refetch()} />
        </V2Surface>
      ) : carregandoVagas ? (
        <V2Skeleton className="h-48" />
      ) : slots.length === 0 ? (
        !criando && (
          <V2Surface>
            <V2EmptyState
              icon={CalendarDays}
              title="Nenhum jogo aberto ainda"
              description="Escolha um horário que costuma ficar vazio e publique. Quem estiver no nível certo entra sozinho."
              action={<V2Button onClick={() => setFormulario({ mode: 'create' })}><Plus className="h-4 w-4" /> Publicar o primeiro</V2Button>}
            />
          </V2Surface>
        )
      ) : (
        <>
          <V2Surface>
            <h3 className="mb-3 font-display text-base font-bold text-ink">
              Próximos <V2Badge tone="neutral">{futuras.length}</V2Badge>
            </h3>
            {futuras.length === 0 ? (
              <p className="text-sm text-gray-500">Nada marcado daqui para a frente.</p>
            ) : (
              <div className="space-y-2">
                {futuras.map((s) => (
                  <VagaCard key={s.id} slot={s} pessoas={pessoasDe(s)} fila={filaPorVaga.get(s.id) || null}
                    onCancel={aoCancelar} onDelete={aoExcluir} onEdit={abrirEdicao} onLink={abrirLigacao} />
                ))}
              </div>
            )}
          </V2Surface>

          {passadas.length > 0 && (
            <V2Surface>
              <h3 className="mb-3 font-display text-base font-bold text-gray-500">
                Já aconteceram <V2Badge tone="neutral">{passadas.length}</V2Badge>
              </h3>
              <div className="space-y-2">
                {passadas.slice(0, 10).map((s) => (
                  <VagaCard key={s.id} slot={s} pessoas={pessoasDe(s)}
                    onCancel={aoCancelar} onDelete={aoExcluir} />
                ))}
              </div>
            </V2Surface>
          )}
        </>
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        O jogo aberto ocupa as quadras no calendário, como uma reserva, e cada um é um dia de jogo —
        em &quot;Organizar o jogo&quot; você sorteia, lança os resultados e abre o telão. Quando alguém
        sai de um jogo lotado, o próximo da fila é chamado sozinho e tem um prazo para confirmar.
      </p>
    </div>
  );
}
