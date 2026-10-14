/**
 * Aba EVOLUÇÃO: o ritmo de treino (minutos por semana), a variação da semana,
 * onde o tempo foi gasto (por área), a autoavaliação a cada 4 semanas e o
 * domínio dos itens.
 *
 * Tudo aqui DESCREVE o que a pessoa registrou — nada afirma causa ("você
 * melhorou porque…"): o diário não sabe disso. Semana sem registro é zero
 * minutos, que é fato; consulta que falhou é aviso, nunca zero.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { NotebookPen } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useMyTrainingSessions } from '@/modules/training/hooks/useTrainingSessions';
import { useMetaActions, useTrainingMeta } from '@/modules/training/hooks/useTrainingMeta';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import {
  ASSESSMENT_EVERY_DAYS, MASTERY, MASTERY_LABELS, assessmentDelta, assessmentDue, minutesByArea,
  monotonyHint, normalizeAssessment, weekMonotony, weeklySeries,
} from '@/modules/training/domain/evolution';
import { recentWeekKeys } from '@/modules/training/domain/session';
import { masteryGroups, weekRangeLabel } from '@/modules/training/domain/treinar';
import { SKILL_AREAS, SKILL_AREA_LABELS } from '@/modules/training/domain/taxonomy';
import { formatDayLabel, todayLocal } from '@/modules/training/domain/dates';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import {
  V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { t, tk, tn } from '@/core/i18n';

const SEMANAS = 8;
const NOTAS = [1, 2, 3, 4, 5];
const NOTA_LABEL = { 1: tk('começando'), 2: tk('em construção'), 3: tk('razoável'), 4: tk('bom'), 5: tk('muito bom') };
const curto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Ritmo({ serie }) {
  const max = Math.max(...serie.map((s) => s.minutes), 1);
  return (
    <ol className="flex h-44 items-end gap-2" aria-label={t('Minutos de treino nas últimas {n} semanas', { n: serie.length })} data-dica="treino-evolucao-carga">
      {serie.map((s, i) => {
        const atual = i === serie.length - 1;
        return (
          <li key={s.weekKey} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-2xs font-semibold tabular-nums text-gray-500" aria-hidden="true">{s.minutes || ''}</span>
            <span
              className={cn('w-full rounded-t-xl', atual ? 'bg-acid' : 'bg-ink/80', s.minutes ? '' : 'bg-gray-100')}
              style={{ height: `${Math.max(4, (s.minutes / max) * 100)}%` }}
              aria-hidden="true"
            />
            <span className="text-2xs text-gray-500" aria-hidden="true">{curto(s.weekKey)}</span>
            <span className="sr-only">
              {`${atual ? t('Esta semana') : t('Semana de {periodo}', { periodo: weekRangeLabel(s.weekKey) })}: ${tn(s.count, '{min} minutos em {n} treino', '{min} minutos em {n} treinos', { min: s.minutes })}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PorArea({ minutos }) {
  const linhas = Object.entries(minutos).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  if (!linhas.length) {
    return <p className="text-sm text-gray-500">{t('Os treinos destas semanas não têm itens nem habilidades ligados. Registre usando itens da biblioteca para ver onde o tempo vai.')}</p>;
  }
  const max = linhas[0][1];
  return (
    <ul className="space-y-2">
      {linhas.map(([area, m]) => (
        <li key={area} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-gray-600">{t(SKILL_AREA_LABELS[area])}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            <span className="block h-full rounded-full bg-ink" style={{ width: `${(m / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-gray-500">{m} min</span>
        </li>
      ))}
    </ul>
  );
}

/** As notas de 1 a 5 por área. Área sem nota fica de fora (não é zero). */
function Autoavaliacao({ uid, avaliacoes, onFeito, onCancelar }) {
  const salvar = useMetaActions(uid).save;
  const ultima = [...avaliacoes].sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
  const [notas, setNotas] = useState(() => ({ ...(ultima?.scores || {}) }));
  const algum = Object.keys(notas).length > 0;

  const enviar = (e) => {
    e.preventDefault();
    const nova = normalizeAssessment(notas);
    salvar.mutate({ assessments: [...avaliacoes.filter((a) => a.date !== nova.date), nova] }, {
      onSuccess: () => { toast.success(t('Autoavaliação salva.')); onFeito(); },
      onError: () => toast.error(t('Não foi possível salvar agora. Tente de novo.')),
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="text-sm text-gray-500">{t('De 1 (começando) a 5 (muito bom). É a sua percepção — pule o que não quiser avaliar.')}</p>
      <ul className="space-y-3">
        {SKILL_AREAS.map((a) => (
          <li key={a} className="flex flex-wrap items-center justify-between gap-2">
            <span id={`aval-${a}`} className="text-sm font-semibold text-ink">{t(SKILL_AREA_LABELS[a])}</span>
            <div role="radiogroup" aria-labelledby={`aval-${a}`} className="flex gap-1">
              {NOTAS.map((n) => {
                const marcado = notas[a] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={marcado}
                    aria-label={`${n}, ${t(NOTA_LABEL[n])}`}
                    onClick={() => setNotas((x) => {
                      const prox = { ...x };
                      if (marcado) delete prox[a]; else prox[a] = n;
                      return prox;
                    })}
                    className={cn(
                      'h-9 w-9 rounded-full text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                      marcado ? 'bg-ink text-paper-pure' : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancelar && <V2Button type="button" variant="ghost" onClick={onCancelar}>{t('Cancelar')}</V2Button>}
        <V2Button type="submit" disabled={!algum || salvar.isPending}>{salvar.isPending ? t('Salvando…') : t('Salvar autoavaliação')}</V2Button>
      </div>
    </form>
  );
}

function UltimaAvaliacao({ avaliacoes, hoje }) {
  const ultima = [...avaliacoes].sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
  const delta = assessmentDelta(avaliacoes);
  if (!ultima) return null;
  const areas = SKILL_AREAS.filter((a) => Number.isFinite(ultima.scores?.[a]));
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{t('Última: {data}', { data: formatDayLabel(ultima.date, hoje) })}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {areas.map((a) => {
          const d = delta[a];
          return (
            <li key={a} className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-600">{t(SKILL_AREA_LABELS[a])}</span>
              <span className="font-bold text-ink">
                {ultima.scores[a]}
                {d ? <span className="ml-1.5 text-xs font-semibold text-gray-500">{d > 0 ? `+${d}` : d}<span className="sr-only">{' '}{t('desde a anterior')}</span></span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function EvolutionTab({ identity, irPara }) {
  const hoje = todayLocal();
  const sessoes = useMyTrainingSessions(identity.uid);
  const meta = useTrainingMeta(identity.uid);
  const visiveis = useVisibleTrainingItems(identity);
  const [avaliando, setAvaliando] = useState(false);

  const chaves = useMemo(() => recentWeekKeys(SEMANAS, hoje).reverse(), [hoje]);
  const lista = sessoes.data || [];
  const serie = useMemo(() => weeklySeries(lista, chaves), [lista, chaves]);
  const semanaPassada = chaves[chaves.length - 2];
  const monotonia = semanaPassada ? weekMonotony(lista, semanaPassada) : null;
  const ultimas4 = useMemo(() => {
    const desde = chaves[chaves.length - 4] || chaves[0];
    return lista.filter((s) => s.date >= desde);
  }, [lista, chaves]);
  const porArea = useMemo(() => minutesByArea(ultimas4, visiveis.byId), [ultimas4, visiveis.byId]);
  const avaliacoes = meta.data?.assessments || [];
  const devida = assessmentDue(avaliacoes, hoje);
  const dominio = useMemo(() => masteryGroups(meta.data?.mastery || {}, visiveis.byId), [meta.data, visiveis.byId]);
  const temDominio = Object.values(dominio).some((l) => l.length);

  if (sessoes.isPending || meta.isPending) return <V2Skeleton className="h-72 rounded-4xl" />;

  const semRegistros = podeAfirmarVazio(sessoes) && lista.length === 0;

  return (
    <div className="space-y-6">
      {sessoes.isError ? (
        <V2Surface><V2ErrorState title={t('O seu diário não carregou')} description={t('Sem o diário não dá para mostrar o ritmo dos treinos.')} onRetry={() => sessoes.refetch()} /></V2Surface>
      ) : semRegistros ? (
        <V2Surface>
          <V2EmptyState
            icon={NotebookPen}
            title={t('A evolução começa no diário')}
            description={t('Registre os treinos (só minutos e esforço já bastam). Com duas ou três semanas, aqui aparecem o seu ritmo e onde o tempo está indo.')}
            action={<V2Button onClick={() => irPara('diario')}>{t('Abrir o diário')}</V2Button>}
          />
        </V2Surface>
      ) : (
        <>
          <V2Surface className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">{t('Seu ritmo')}</h2>
              <p className="text-sm text-gray-500">{t('Minutos de treino por semana, nas últimas {n}.', { n: SEMANAS })}</p>
            </div>
            <Ritmo serie={serie} />
            {semanaPassada && (
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-ink">{t('Semana passada:')}{' '}</span>
                {monotonia === null
                  ? t('para medir a variação entre dias leves e puxados, registre o esforço em pelo menos dois dias.')
                  : monotonyHint(monotonia)}
              </p>
            )}
          </V2Surface>

          <V2Surface className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">{t('Onde o tempo foi')}</h2>
              <p className="text-sm text-gray-500">{t('Últimas 4 semanas, pelas habilidades dos itens que você registrou.')}</p>
            </div>
            {visiveis.incompleto && <p className="text-xs text-amber-700">{t('Parte da biblioteca não carregou; algumas áreas podem estar faltando.')}</p>}
            <PorArea minutos={porArea} />
          </V2Surface>
        </>
      )}

      <V2Surface className="space-y-4" data-dica="treino-evolucao-avaliacao">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">{t('Autoavaliação')}</h2>
            <p className="text-sm text-gray-500">{t('A cada {n} semanas, uma nota sua para cada área — para comparar com você mesmo.', { n: ASSESSMENT_EVERY_DAYS / 7 })}</p>
          </div>
          {meta.isSuccess && !avaliando && !devida.due && (
            <V2Button size="sm" variant="ghost" onClick={() => setAvaliando(true)}>{t('Avaliar agora')}</V2Button>
          )}
        </div>
        {meta.isError ? (
          <V2ErrorState inline title={t('As suas autoavaliações não carregaram')} onRetry={() => meta.refetch()} />
        ) : (avaliando || devida.due) ? (
          <Autoavaliacao uid={identity.uid} avaliacoes={avaliacoes} onFeito={() => setAvaliando(false)} onCancelar={avaliando ? () => setAvaliando(false) : undefined} />
        ) : (
          <>
            <UltimaAvaliacao avaliacoes={avaliacoes} hoje={hoje} />
            <p className="text-xs text-gray-500">{t('Próxima sugerida: {data}.', { data: formatDayLabel(devida.next, hoje) })}</p>
          </>
        )}
      </V2Surface>

      {meta.isSuccess && (
        <V2Surface className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">{t('Domínio dos itens')}</h2>
            <p className="text-sm text-gray-500">{t('Você marca na ficha de cada item: aprendendo, consistente ou dominado.')}</p>
          </div>
          {temDominio ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[MASTERY.APRENDENDO, MASTERY.CONSISTENTE, MASTERY.DOMINADO].map((nivel) => (
                <section key={nivel} className="space-y-2" aria-label={t(MASTERY_LABELS[nivel])}>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{t(MASTERY_LABELS[nivel])} · {dominio[nivel].length}</h3>
                  <ul className="space-y-1.5">
                    {dominio[nivel].map((it) => (
                      <li key={it.id}>
                        {it.available ? (
                          <Link to={`/treino/item/${it.id}`} className="block rounded-2xl bg-gray-50 px-3 py-2 text-sm font-semibold text-ink hover:bg-gray-100">{it.title}</Link>
                        ) : (
                          <span className="block rounded-2xl bg-gray-50 px-3 py-2 text-sm text-gray-400">{visiveis.isLoading || visiveis.incompleto ? t('Item (não carregou)') : it.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('Nenhum item marcado ainda. Abra um drill da biblioteca e diga como ele está para você.')}</p>
          )}
        </V2Surface>
      )}
    </div>
  );
}
