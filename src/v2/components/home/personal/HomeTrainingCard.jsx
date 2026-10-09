/**
 * Card "Treino" do início (flag `training_center`, escolhido pela pessoa):
 * o treino de HOJE — a mesma conta da aba Hoje (`useTodaySession`) —, o que
 * o professor mandou e ainda não foi visto, e a porta para o Centro de Treino.
 *
 * Falha ≠ vazio: sem os planos não dá para saber o dia do plano, e com a
 * biblioteca pela metade o card não afirma "monte o seu treino".
 */
import React from 'react';
import { Dumbbell, GraduationCap, Play } from 'lucide-react';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useTodaySession } from '@/modules/training/hooks/useTodaySession';
import { TODAY_SOURCE } from '@/modules/training/domain/today';
import { unreadCount } from '@/modules/training/domain/share';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import {
  HomeAction, HomeEmpty, HomeRow, HomeSection,
} from './HomeSection';

const ORIGEM = {
  [TODAY_SOURCE.PLANO]: 'Do seu plano',
  [TODAY_SOURCE.PROFESSOR]: 'Do seu professor',
  [TODAY_SOURCE.RECOMENDACAO]: 'Sugestão para você',
  [TODAY_SOURCE.DESCANSO]: 'Hoje',
  [TODAY_SOURCE.VAZIO]: 'Hoje',
};

const ACAO = { to: '/treino', label: 'Abrir o treino' };

export default function HomeTrainingCard() {
  const identity = useTrainingIdentity();
  const {
    sessao, items, minutos, routine, visiveis, planos, inbox, meta, isLoading,
  } = useTodaySession(identity);

  const moldura = (conteudo) => (
    <HomeSection id="treino" icon={Dumbbell} title="Treino" action={ACAO}>{conteudo}</HomeSection>
  );

  if (isLoading) return moldura(<V2Skeleton lines={3} />);
  if (planos.isError) {
    return moldura(
      <V2ErrorState
        inline
        title="Não deu para montar o treino de hoje"
        description="Os seus planos não carregaram, então ainda não dá para saber o que estava marcado para hoje."
        onRetry={() => planos.refetch()}
      />,
    );
  }

  const naoLidos = inbox.isSuccess ? unreadCount(inbox.data) : 0;
  const vazioIncerto = sessao.source === TODAY_SOURCE.VAZIO && visiveis.incompleto;
  const semRotina = meta.isSuccess && !routine;
  const faltou = [
    inbox.isError && 'o que o professor mandou',
    meta.isError && 'a sua rotina',
    visiveis.incompleto && 'uma parte da biblioteca',
  ].filter(Boolean);

  let rodape = null;
  if (semRotina && sessao.source !== TODAY_SOURCE.PLANO && sessao.source !== TODAY_SOURCE.PROFESSOR) {
    rodape = (
      <HomeEmpty icon={Dumbbell} actions={<HomeAction to="/treino" primary>Montar a minha rotina</HomeAction>}>
        Diga em que dias e por quanto tempo você treina, e o treino de hoje sai sob medida.
      </HomeEmpty>
    );
  } else if (items.length > 0) {
    rodape = (
      <HomeAction to="/treino?aba=hoje" primary>
        <Play className="h-3.5 w-3.5" aria-hidden="true" /> Começar o treino de hoje
      </HomeAction>
    );
  } else if (sessao.source === TODAY_SOURCE.VAZIO && !vazioIncerto) {
    rodape = <HomeAction to="/treino?aba=biblioteca">Ver a biblioteca</HomeAction>;
  }

  return moldura(
    <div className="space-y-4">
      {faltou.length > 0 && (
        <V2ErrorState
          inline
          title="Parte do seu treino não carregou"
          description={`Ficou de fora: ${faltou.join(', ')}.`}
          onRetry={() => { inbox.refetch(); meta.refetch(); visiveis.refetch(); }}
        />
      )}

      {!vazioIncerto && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{ORIGEM[sessao.source]}</p>
          <p className="mt-0.5 font-display text-lg font-bold leading-tight text-ink">{sessao.title}</p>
          <p className="mt-1 text-sm text-gray-500">
            {sessao.note}
            {minutos && items.length > 0 ? ` · cerca de ${minutos} min` : ''}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="-mx-3 space-y-1">
          {items.slice(0, 4).map((it) => (
            <li key={it.id}>
              <HomeRow
                to={`/treino/item/${it.id}`}
                icon={Dumbbell}
                title={it.title}
                subtitle={it.duration_min ? `${it.duration_min} min` : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {naoLidos > 0 && (
        <div className="-mx-3">
          <HomeRow
            to="/treino?aba=recebidos"
            icon={GraduationCap}
            title={naoLidos === 1 ? '1 item novo do seu professor' : `${naoLidos} itens novos do seu professor`}
            badge="Novo"
            badgeTone="acid"
            highlight
          />
        </div>
      )}

      {rodape}
    </div>,
  );
}
