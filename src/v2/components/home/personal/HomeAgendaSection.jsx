/**
 * "Sua agenda" — todos os compromissos, numa linha do tempo (tela inicial).
 *
 * Recebe o resultado de `useHomeAgenda` (a página já o carrega para decidir as
 * frentes) e só desenha. Três estados que não se confundem:
 *
 *  - **carregando** → esqueleto no formato da lista;
 *  - **parte falhou** → mostra o que carregou E diz o que não carregou, com
 *    "Tentar de novo" (nunca "agenda livre" sem saber);
 *  - **tudo carregado e nada marcado** → diz isso e oferece o próximo passo da
 *    pessoa (procurar jogo, reservar, torneios…), não um vazio.
 */
import React, { useMemo } from 'react';
import {
  CalendarCheck, CalendarClock, CalendarDays, Dices, GraduationCap, Megaphone, Trophy, Users,
} from 'lucide-react';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import {
  AGENDA_KIND, AGENDA_KIND_LABEL, groupAgendaByDay,
} from '@/modules/home/domain/homeAgenda';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from './HomeSection';

const ICONE = {
  [AGENDA_KIND.JOGO_TORNEIO]: Trophy,
  [AGENDA_KIND.DIA_DE_JOGO]: Dices,
  [AGENDA_KIND.RESERVA]: CalendarCheck,
  [AGENDA_KIND.AULA]: GraduationCap,
  [AGENDA_KIND.AULA_PROFESSOR]: GraduationCap,
  [AGENDA_KIND.AULA_ARENA]: GraduationCap,
  [AGENDA_KIND.JOGO_ABERTO]: Megaphone,
  [AGENDA_KIND.EVENTO_CLUBE]: Users,
};

/** Quantos compromissos a tela inicial mostra (o resto está em cada tela). */
const LIMITE = 7;

export default function HomeAgendaSection({ agenda, hoje, sugestoes = [] }) {
  const { itens = [], carregando, completa, falhas = [], recarregar } = agenda || {};
  const grupos = useMemo(() => groupAgendaByDay(itens.slice(0, LIMITE), hoje), [itens, hoje]);
  const restantes = Math.max(0, itens.length - LIMITE);

  return (
    <HomeSection id="agenda" icon={CalendarDays} title="Sua agenda" reason="O que vem pela frente" wide>
      {carregando && itens.length === 0 ? (
        <V2Skeleton lines={4} />
      ) : (
        <div className="space-y-4">
          {falhas.length > 0 && (
            <V2ErrorState
              inline
              title={`Não carregou: ${falhas.join(', ')}`}
              description="A sua agenda pode estar incompleta."
              onRetry={recarregar}
            />
          )}
          {grupos.length > 0 ? (
            <ol className="space-y-4" aria-label="Próximos compromissos">
              {grupos.map((g) => (
                <li key={g.dia}>
                  <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <span className={g.label === 'Hoje' ? 'rounded-full bg-acid px-2 py-0.5 text-ink' : ''}>{g.label}</span>
                  </p>
                  <ul className="space-y-1">
                    {g.itens.map((i) => (
                      <li key={i.key}>
                        <HomeRow
                          to={i.link}
                          icon={ICONE[i.kind] || CalendarClock}
                          title={i.hora ? `${i.hora} · ${i.title}` : i.title}
                          subtitle={[AGENDA_KIND_LABEL[i.kind], i.subtitle].filter(Boolean).join(' · ')}
                          badge={i.status}
                          badgeTone={i.acao ? 'amber' : (i.status === 'Confirmada' || i.status === 'Você vai' ? 'green' : 'neutral')}
                          highlight={i.acao}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {restantes > 0 && (
                <li className="text-xs font-semibold text-gray-400">
                  E mais {restantes} {restantes === 1 ? 'compromisso' : 'compromissos'} nos próximos dias.
                </li>
              )}
            </ol>
          ) : completa ? (
            <HomeEmpty
              icon={CalendarClock}
              actions={sugestoes.slice(0, 2).map((s, idx) => (
                <HomeAction key={s.to} to={s.to} primary={idx === 0}>{s.label}</HomeAction>
              ))}
            >
              Nada marcado por enquanto — sua agenda está livre.
            </HomeEmpty>
          ) : null}
        </div>
      )}
    </HomeSection>
  );
}
