/**
 * V2ArenaOpenMatch — os jogos abertos de uma arena, na visão do ATLETA.
 *
 * Rota: `/arenas/:arenaId/open-match`
 * Módulo: `matchmaking_open_match`.
 *
 * A pergunta que esta tela responde é uma só: **existe jogo aqui hoje que eu
 * possa entrar?** Por isso:
 *
 * - a data aparece em português (`Qui, 23/07 · 19:00–21:00`), não a ISO crua;
 * - o nível é dito nos DOIS lados — a faixa da vaga e o seu — porque "nível
 *   mínimo 4.0" sozinho não diz se você entra;
 * - quando lota, a fila é oferecida no mesmo lugar, sem trocar de tela;
 * - o que você já confirmou fica em cima e marcado, para não entrar duas vezes;
 * - falha de leitura NÃO vira "nenhum jogo aberto": vira erro com "tentar de
 *   novo". Lista vazia tem um significado próprio, e mentir aqui faz o atleta
 *   desistir da arena.
 */

import React, { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, BellRing, Check, Clock, Info, MapPin, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaOpenSlots,
  useJoinOpenSlot,
  useLeaveOpenSlot,
  useJoinWaitlist,
  useLeaveWaitlist,
  useAcceptWaitlist,
  useDeclineWaitlist,
  useUserWaitlist,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import {
  formatLevel,
  getAvailableSpots,
  getSlotFillPct,
  slotLevelFit,
  slotLevelRangeLabel,
  slotStartMs,
} from '@/modules/arenas/domain/openMatch';
import { formatSlotLabel, todayISO } from '@/modules/arenas/domain/calendar';
import { WAITLIST_STATUS } from '@/modules/arenas/domain/waitlist';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

const FORMATO_LABEL = {
  duplas: 'Duplas', simples: 'Simples', mistas: 'Duplas mistas',
  open: 'Livre', treino: 'Treino',
};

function VagaCard({ slot, meuNivel, jaEstou, naFila, onEntrar, onSair, onFila, ocupado }) {
  const vagas = getAvailableSpots(slot);
  const pct = getSlotFillPct(slot);
  const lotado = vagas <= 0;
  // LOTADO e ENCERRADO são coisas diferentes, e confundi-las escondia a fila:
  // `isSlotOpenForJoin` responde `false` para os dois, e o cartão dizia
  // "inscrições encerradas" num jogo que só estava cheio — que é exatamente a
  // hora de oferecer a fila de espera.
  const inicio = slotStartMs(slot);
  const jaComecou = Number.isFinite(inicio) && inicio < Date.now();
  const faixa = slotLevelRangeLabel(slot);
  const encaixe = slotLevelFit(slot, meuNivel);

  return (
    <V2Surface className={jaEstou ? 'border-acid/60 bg-acid/[0.05]' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-ink">{formatSlotLabel(slot)}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            {slot.court && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {slot.court}
              </span>
            )}
            {slot.format && <span>{FORMATO_LABEL[slot.format] || slot.format}</span>}
            {Number.isFinite(slot.price) && slot.price > 0 && (
              <span>R$ {Number(slot.price).toFixed(2)} por atleta</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {jaEstou && <V2Badge tone="green"><Check className="h-3 w-3" /> Você está dentro</V2Badge>}
          <V2Badge tone={lotado ? 'amber' : 'green'}>
            {lotado ? 'Lotado' : `${vagas} vaga${vagas === 1 ? '' : 's'}`}
          </V2Badge>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${lotado ? 'bg-amber-400' : 'bg-acid'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* O nível dos DOIS lados: só a faixa não diz se a pessoa entra. */}
      {faixa && (
        <p className={`mt-3 flex gap-1.5 rounded-2xl p-2.5 text-xs leading-5 ${
          encaixe.ok ? 'bg-paper text-gray-600' : 'bg-amber-50 text-amber-800'
        }`}
        >
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Nível <strong>{faixa}</strong>
            {Number.isFinite(meuNivel)
              ? ` · o seu é ${formatLevel(meuNivel)}`
              : ' · ainda não temos o seu nível, então você pode entrar'}
            {!encaixe.ok && ' — fora da faixa desta vaga.'}
          </span>
        </p>
      )}

      {slot.notes && <p className="mt-2 text-xs leading-5 text-gray-500">{slot.notes}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {jaEstou ? (
          <V2Button variant="ghost" size="sm" disabled={ocupado} onClick={() => onSair(slot)}>
            Sair deste jogo
          </V2Button>
        ) : jaComecou ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5" /> Inscrições encerradas
          </span>
        ) : lotado ? (
          naFila ? (
            <V2Badge tone="blue">Você está na fila de espera</V2Badge>
          ) : (
            <V2Button variant="secondary" size="sm" disabled={ocupado} onClick={() => onFila(slot)}>
              Entrar na fila de espera
            </V2Button>
          )
        ) : (
          <V2Button size="sm" disabled={ocupado || !encaixe.ok} onClick={() => onEntrar(slot)}>
            Quero jogar
          </V2Button>
        )}
      </div>
    </V2Surface>
  );
}

/**
 * "Vagou para você" — o outro lado da fila de espera.
 *
 * Sem isto a fila era meia funcionalidade: o atleta entrava na fila, recebia
 * uma notificação com prazo... e não tinha onde aceitar. (Pior: a notificação
 * apontava para `/minha-fila`, rota que nunca existiu.)
 */
function ChamadaDaFila({ entrada, slot, onAceitar, onRecusar, ocupado }) {
  return (
    <V2Surface className="border-acid bg-acid/10">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-ink">Vagou um lugar para você</p>
          <p className="mt-0.5 text-sm text-gray-700">
            {slot ? formatSlotLabel(slot) : 'Jogo aberto'}
            {slot?.court ? ` · ${slot.court}` : ''}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Confirme para garantir a vaga. Se não confirmar, ela passa para o próximo da fila.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <V2Button size="sm" disabled={ocupado} onClick={() => onAceitar(entrada)}>
              Confirmar minha vaga
            </V2Button>
            <V2Button variant="ghost" size="sm" disabled={ocupado} onClick={() => onRecusar(entrada)}>
              Não vou poder
            </V2Button>
          </div>
        </div>
      </div>
    </V2Surface>
  );
}

export default function V2ArenaOpenMatch() {
  const { arenaId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const {
    data: slots = [], isLoading: carregando, isError, refetch,
  } = useArenaOpenSlots(arenaId);
  const { isOn, isLoading: carregandoModulos } = useArenaModules(arenaId);
  const { level: meuNivel } = useMyUnifiedLevel();
  const { data: minhaFila = [] } = useUserWaitlist();
  const entrar = useJoinOpenSlot();
  const sair = useLeaveOpenSlot();
  const fila = useJoinWaitlist();
  const sairDaFila = useLeaveWaitlist();
  const aceitar = useAcceptWaitlist();
  const recusar = useDeclineWaitlist();

  const hoje = todayISO();
  const idsNaFila = useMemo(
    () => new Set(minhaFila.map((f) => f.slot_id).filter(Boolean)),
    [minhaFila],
  );
  // As chamadas em aberto NESTA arena: a fila só vale se houver onde aceitar.
  const chamadas = useMemo(() => {
    const porId = new Map(slots.map((s) => [s.id, s]));
    return minhaFila
      .filter((f) => f.status === WAITLIST_STATUS.NOTIFIED && porId.has(f.slot_id))
      .map((f) => ({ entrada: f, slot: porId.get(f.slot_id) }));
  }, [minhaFila, slots]);

  const { meus, disponiveis } = useMemo(() => {
    const futuros = slots
      .filter((s) => String(s.date || '') >= hoje && s.status !== 'cancelled');
    return {
      meus: futuros.filter((s) => (s.participants || []).includes(user?.uid)),
      disponiveis: futuros.filter((s) => !(s.participants || []).includes(user?.uid)),
    };
  }, [slots, hoje, user?.uid]);

  if (isLoading || carregandoModulos) {
    return <V2Skeleton className="mx-auto h-96 max-w-[820px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH)) {
    return <Navigate to={`/arenas/${arena.id}`} replace />;
  }

  const ocupado = entrar.isPending || sair.isPending || fila.isPending
    || aceitar.isPending || recusar.isPending || sairDaFila.isPending;

  const aoEntrar = (slot) => entrar.mutateAsync(slot.id)
    .then(() => toast.success('Pronto! Você está no jogo.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível entrar.'));
  const aoSair = (slot) => sair.mutateAsync(slot.id)
    .then(() => toast.success('Você saiu do jogo. A vaga voltou para a lista.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível sair.'));
  const aoEntrarNaFila = (slot) => fila.mutateAsync(slot.id)
    .then(() => toast.success('Você está na fila. Avisamos assim que vagar.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível entrar na fila.'));
  const aoAceitar = ({ slot_id: slotId }) => aceitar.mutateAsync(slotId)
    .then(() => toast.success('Vaga confirmada. Bom jogo!'))
    .catch((e) => toast.error(e?.message || 'Não foi possível confirmar.'));
  const aoRecusar = ({ slot_id: slotId }) => recusar.mutateAsync(slotId)
    .then(() => toast.success('Tudo bem — a vaga passou para o próximo.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível recusar.'));

  return (
    <div className="mx-auto max-w-[820px]">
      <Link
        to={`/arenas/${arena.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {arena.name}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Jogos abertos</h1>
      <p className="mt-1 text-sm text-gray-500">
        Horários que a arena abriu para quem quiser entrar. Não precisa levar dupla.
      </p>

      {!isAuthenticated && (
        <V2Surface className="mt-4">
          <p className="text-sm text-gray-600">
            <Link to="/entrar" className="font-bold text-ink underline">Entre na sua conta</Link>{' '}
            para se inscrever nos jogos.
          </p>
        </V2Surface>
      )}

      {chamadas.length > 0 && (
        <div className="mt-5 space-y-3">
          {chamadas.map(({ entrada, slot }) => (
            <ChamadaDaFila
              key={entrada.id}
              entrada={entrada}
              slot={slot}
              ocupado={ocupado}
              onAceitar={aoAceitar}
              onRecusar={aoRecusar}
            />
          ))}
        </div>
      )}

      <div className="mt-5 space-y-4">
        {isError ? (
          <V2Surface>
            <p className="text-sm text-red-700">
              Não foi possível carregar os jogos abertos.{' '}
              <button type="button" className="font-bold underline" onClick={() => refetch()}>
                Tentar de novo
              </button>
            </p>
          </V2Surface>
        ) : carregando ? (
          <V2Skeleton className="h-56" />
        ) : (
          <>
            {meus.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Você vai jogar
                </h2>
                {meus.map((s) => (
                  <VagaCard
                    key={s.id} slot={s} meuNivel={meuNivel} jaEstou
                    naFila={idsNaFila.has(s.id)} ocupado={ocupado}
                    onEntrar={aoEntrar} onSair={aoSair} onFila={aoEntrarNaFila}
                  />
                ))}
              </div>
            )}

            {disponiveis.length === 0 && meus.length === 0 ? (
              <V2Surface>
                <V2EmptyState
                  icon={Users}
                  title="Nenhum jogo aberto agora"
                  description={`A ${arena.name} ainda não publicou horários com vagas. Volte mais tarde ou reserve uma quadra.`}
                  action={(
                    <V2Button asChild variant="secondary">
                      <Link to={`/arenas/${arena.id}`}>Ver a arena</Link>
                    </V2Button>
                  )}
                />
              </V2Surface>
            ) : disponiveis.length > 0 && (
              <div className="space-y-3">
                {meus.length > 0 && (
                  <h2 className="pt-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                    Outros jogos
                  </h2>
                )}
                {disponiveis.map((s) => (
                  <VagaCard
                    key={s.id} slot={s} meuNivel={meuNivel} jaEstou={false}
                    naFila={idsNaFila.has(s.id)} ocupado={ocupado}
                    onEntrar={aoEntrar} onSair={aoSair} onFila={aoEntrarNaFila}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
