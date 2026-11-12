/**
 * O PLANO do torneio na ficha (Carreira, docs/54 §4.9) e o "Mandar ao
 * meu professor":
 *  - planejado: prioridade, prazo de inscrição, "Já me inscrevi", a meta e o
 *    foco (sugerido pelo que mais aparece a melhorar nos balanços — um toque
 *    aceita), o "se → então" em "Mais" e o .ics;
 *  - planejado que passou: "Como foi?" (Joguei / Não fui) e, com foco, "o foco
 *    funcionou?". "Não fui" grava o status `cancelled`.
 * Os campos mudam o RASCUNHO da ficha (`onChange`); quem grava é o "Salvar".
 * O professor é ato à parte, gravado na hora (a regra confere o vínculo ativo).
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';
import { CAREER_LIMITS, CAREER_PRIORITY, CAREER_STATUS, FOCUS_RESULT } from '@/modules/career/domain/careerEvent.js';
import { PRIORITY_LABEL, careerEventIcs, countdownText, daysUntil, deadlineInfo, suggestedFocus } from '@/modules/career/domain/careerUpcoming.js';
import { GAME_ASPECTS, aspectLabel } from '@/modules/training/domain/debrief.js';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useStudentCoaches } from '@/modules/coaches/hooks/useStudents';
import { todayLocal } from '@/modules/training/domain/dates.js';
import { useShareCareerWithCoach } from '@/modules/career/hooks/useCareer';
import AddToCalendarButton from '@/modules/tournament/components/AddToCalendarButton';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Toggle } from '@/v2/ui/primitives';
import { ChoiceGroup, careerDateLabel } from './careerUi';
import { t, tk, tn } from '@/core/i18n';

const FOCUS_RESULT_LABEL = Object.freeze({ yes: tk('Funcionou'), partly: tk('Em parte'), no: tk('Não funcionou') });
const WENT_CHOICES = Object.freeze([{ value: 'sim', label: tk('Joguei') }, { value: 'nao', label: tk('Não fui') }]);

/** A faixa de datas que o registro aceita (a de `normalizeCareerEvent`): 1990 … ano atual + 5. */
export const careerDateBounds = (today = todayLocal()) => ({ min: '1990-01-01', max: `${Number(today.slice(0, 4)) + 5}-12-31` });

/** Planejado: prioridade, prazo, meta e foco. `formId`: o formulário da ficha (Enter salva). */
export function CareerPlanFields({ value: f, onChange, debriefs, formId }) {
  const [mais, setMais] = useState(Boolean(f.if_then));
  const set = (k, v) => onChange({ ...f, [k]: v });
  const prazo = deadlineInfo(f);
  const faltam = daysUntil(f.start_date);
  const sugerido = f.focus_aspect ? null : suggestedFocus(debriefs);
  const ics = careerEventIcs(f);
  return (
    <div className="space-y-3" data-dica="carreira-plano">
      {Number.isFinite(faltam) && faltam >= 0 && <p className="text-sm font-semibold text-ink">{countdownText(faltam)}</p>}
      <p className="text-sm font-semibold text-ink">{t('Prioridade')}</p>
      <ChoiceGroup
        label={t('Prioridade')}
        options={CAREER_PRIORITY.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
        value={f.priority || 'casual'}
        onChange={(v) => set('priority', v || 'casual')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field
          label={t('Prazo de inscrição (opcional)')}
          htmlFor="ficha-prazo"
          hint={prazo && !f.registered ? (prazo.closed ? t('O prazo já passou.') : (prazo.days === 0 ? t('Inscrição fecha hoje') : tn(prazo.days, 'Falta {n} dia para fechar. Avisamos 3 dias antes.', 'Faltam {n} dias para fechar. Avisamos 3 dias antes.'))) : null}
        >
          <V2Input id="ficha-prazo" type="date" form={formId} value={f.registration_deadline || ''} min={careerDateBounds().min} max={f.start_date || careerDateBounds().max} onChange={(e) => set('registration_deadline', e.target.value || null)} />
        </V2Field>
        <div className="flex items-end">
          <V2Toggle id="ficha-inscrito" checked={f.registered === true} onChange={(v) => set('registered', v)} label={t('Já me inscrevi')} />
        </div>
      </div>
      <V2Field label={t('Minha meta neste torneio (opcional)')} htmlFor="ficha-meta" hint={t('Ex.: passar da fase de grupos.')}>
        <V2Input id="ficha-meta" form={formId} value={f.aim || ''} maxLength={CAREER_LIMITS.aim} onChange={(e) => set('aim', e.target.value)} />
      </V2Field>
      <V2Field label={t('O foco do treino até lá')} htmlFor="ficha-foco">
        <V2Select id="ficha-foco" value={f.focus_aspect || ''} onChange={(e) => set('focus_aspect', e.target.value || null)}>
          <option value="">{t('— Sem foco —')}</option>
          {GAME_ASPECTS.map((a) => <option key={a.id} value={a.id}>{t(a.label)}</option>)}
        </V2Select>
      </V2Field>
      {sugerido && (
        <p className="text-sm text-gray-600">
          {t('Nos seus balanços, o que mais aparece a melhorar é {aspecto}.', { aspecto: aspectLabel(sugerido).toLowerCase() })}{' '}
          <button type="button" className="font-semibold text-ink underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink" onClick={() => set('focus_aspect', sugerido)}>
            {t('Usar como foco')}
          </button>
        </p>
      )}
      <V2Button type="button" size="sm" variant="ghost" aria-expanded={mais} onClick={() => setMais((v) => !v)}>{mais ? t('Menos') : t('Mais')}</V2Button>
      {mais && (
        <V2Field label={t('Se acontecer…, então eu…')} htmlFor="ficha-se-entao" hint={t('Um plano para o momento difícil. Ex.: se eu errar dois saques seguidos, então respiro e jogo no meio.')}>
          <V2Input id="ficha-se-entao" form={formId} value={f.if_then || ''} maxLength={CAREER_LIMITS.ifThen} onChange={(e) => set('if_then', e.target.value)} />
        </V2Field>
      )}
      {ics && <AddToCalendarButton event={ics} />}
    </div>
  );
}

/** A resposta do "Como foi?" lida do rascunho (`foi`: a pessoa tocou em "Joguei"). */
export function howItWentAnswer(f, foi = false) {
  if (f?.status === CAREER_STATUS.CANCELLED) return 'nao';
  return foi || (f?.entries || []).some((e) => Boolean(e?.placement)) ? 'sim' : null;
}

/**
 * "Como foi?" — o planejado que passou (ou o que a pessoa marcou "Não fui").
 * `answer`: 'sim' | 'nao' | null. "Não fui" vira o status `cancelled` (sai das
 * contagens de torneio jogado); sem resposta a ficha não salva — o plano não
 * vira "jogado" calado.
 */
export function CareerHowItWent({ value: f, onChange, answer, onAnswer }) {
  const fui = answer === 'sim';
  return (
    <div className="space-y-3 rounded-2xl border border-acid/40 bg-acid/10 p-4" data-dica="carreira-como-foi">
      <p className="text-sm font-semibold text-ink">{t('Como foi?')}</p>
      <p className="text-sm text-gray-600">
        {t('O torneio de {data} passou. Você jogou?', { data: careerDateLabel(f.start_date, f.date_precision) })}
      </p>
      <ChoiceGroup label={t('Você jogou este torneio?')} options={WENT_CHOICES} value={answer || null} onChange={onAnswer} />
      {fui && <p className="text-xs text-gray-600">{t('Conte a colocação em Resultado. Se preferir não dizer, é só salvar.')}</p>}
      {answer === 'nao' && <p className="text-xs text-gray-600">{t('Ao salvar, ele fica guardado como "não fui" e sai das contagens de torneios jogados.')}</p>}
      {fui && f.focus_aspect && <p className="text-sm font-semibold text-ink">{t('O foco ({aspecto}) funcionou?', { aspecto: aspectLabel(f.focus_aspect).toLowerCase() })}</p>}
      {fui && f.focus_aspect && (
        <ChoiceGroup
          label={t('O foco ({aspecto}) funcionou?', { aspecto: aspectLabel(f.focus_aspect).toLowerCase() })}
          options={FOCUS_RESULT.map((v) => ({ value: v, label: FOCUS_RESULT_LABEL[v] }))}
          value={f.focus_result || null}
          onChange={(v) => onChange({ ...f, focus_result: v || null })}
          allowNone
        />
      )}
    </div>
  );
}

/**
 * "Mandar ao meu professor": só a professor com vínculo ATIVO. Mostra também o
 * balanço do torneio. Só em ficha já gravada (o documento precisa existir).
 */
export function CareerCoachShare({ event, saved, onShared }) {
  const identity = useTrainingIdentity();
  const share = useShareCareerWithCoach();
  // A MESMA consulta da identidade (mesmo cache): só para saber se já respondeu.
  const vinculos = useStudentCoaches(identity.uid);
  const links = identity.coachLinks || [];
  if (!saved || !event?.id) return null;
  if (identity.coachLinksError || (vinculos.isError && !vinculos.data)) {
    return <V2ErrorState inline title={t('Não carregaram os seus professores agora.')} onRetry={() => vinculos.refetch()} />;
  }
  // Sem a resposta, não se afirma "o vínculo terminou" nem "você não tem professor".
  if (!vinculos.isSuccess) return event.shared_coach_id ? <V2Skeleton lines={1} /> : null;
  const atual = event.shared_coach_id || null;
  const atualAtivo = atual && links.some((l) => l.coach_id === atual);
  if (!links.length && !atual) return null;
  const mandar = (coachId) => share.mutate({ event, coachId }, {
    onSuccess: () => { onShared?.(coachId); toast.success(coachId ? t('Seu professor já vê este torneio.') : t('O professor deixou de ver este torneio.')); },
    onError: () => toast.error(t('Não foi possível agora. Tente de novo.')),
  });
  const nome = (id) => links.find((l) => l.coach_id === id)?.coach_name || t('Seu professor');
  return (
    <div className="space-y-2 rounded-2xl bg-paper p-3" data-dica="carreira-professor">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink"><GraduationCap className="h-4 w-4" aria-hidden="true" /> {t('Professor')}</p>
      {atual ? (
        <>
          <p className="text-sm text-gray-600">
            {atualAtivo ? t('{nome} vê este torneio e o balanço dele.', { nome: nome(atual) }) : t('O vínculo com o professor terminou: ele não vê mais este torneio.')}
          </p>
          {atualAtivo && <p className="text-xs text-gray-500">{t('O registro inteiro fica ao alcance dele: anotações, link e fotos também.')}</p>}
          <V2Button type="button" size="sm" variant="ghost" disabled={share.isPending} onClick={() => mandar(null)}>{t('Deixar de mostrar')}</V2Button>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500">{t('Só você vê a ficha. Mandar mostra o torneio e o balanço ao professor, enquanto ele for seu professor. Anotações, link e fotos vão junto.')}</p>
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <V2Button key={l.coach_id} type="button" size="sm" variant="secondary" disabled={share.isPending} onClick={() => mandar(l.coach_id)}>
                {links.length > 1 ? t('Mandar a {nome}', { nome: nome(l.coach_id) }) : t('Mandar ao meu professor')}
              </V2Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

