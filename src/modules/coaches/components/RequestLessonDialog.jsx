import React, { Suspense, lazy, useMemo, useState } from 'react';
import { CalendarOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

import { generateWeekSlots } from '../domain/availability.js';
import { LESSON_FORMAT, LESSON_FORMAT_LABELS } from '../domain/lesson.js';
import { useCoachAvailability, useCoachBusySlots, useRequestLesson } from '../hooks/useLessons.js';
import { useLeaveCoachWaitlist, useMyCoachWaitlists } from '../hooks/useCoachWaitlist.js';
import CoachWaitlistJoin from './CoachWaitlistJoin.jsx';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { useCoachResidencies } from '../hooks/useCoaches.js';
import { useArenas } from '@/modules/arenas/hooks/useArenas';
import { t, tk } from '@/core/i18n';

const WEEKDAY_SHORT = [tk('Dom'), tk('Seg'), tk('Ter'), tk('Qua'), tk('Qui'), tk('Sex'), tk('Sáb')];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${t(WEEKDAY_SHORT[date.getDay()])} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

// "Tem um cupom do professor?" (Onda CG, flag `coach_marketing`) — sob
// demanda: quem não tem a flag ligada não baixa o marketing. Ver
// `LessonCouponField` (cupons para tocar, estimativa com desconto, "só alunos").
const LessonCouponField = lazy(() => import('@/v2/components/promo/LessonCouponField'));

/**
 * Diálogo do aluno para solicitar uma aula a um professor. Mostra SÓ os
 * horários livres derivados da disponibilidade do professor (descontando aulas
 * confirmadas) — não dá para pedir um dia ou horário que o professor não abriu.
 *
 * Sem horário livre (o professor ainda não publicou, ou as próximas duas
 * semanas estão tomadas), a tela diz isso e oferece as duas saídas: mandar
 * mensagem ao professor para combinar outro horário e entrar na LISTA DE
 * ESPERA (`CoachWaitlistJoin`), que avisa quando ele abrir horários. Com
 * horários, a lista de espera fica a um toque ("Nenhum horário serve?").
 *
 * 🐞 Antes havia "Propor horário" com data e hora livres, e com o professor sem
 * horários publicados o botão "Solicitar aula" ficava apagado com tudo
 * preenchido: o diálogo lia o horário da lista que não estava na tela.
 *
 * `initialCouponCode`: o código de um cupom do professor, quando o aluno veio
 * de "Usar ao pedir a aula" (perfil do professor ou vitrine).
 */
export default function RequestLessonDialog({ coach, open, onOpenChange, initialCouponCode = '' }) {
  const coachId = coach?.id;
  const { user } = useAuth();
  const dispQ = useCoachAvailability(coachId);
  const busyQ = useCoachBusySlots(coachId);
  const availability = dispQ.data;
  const { data: residencies = [] } = useCoachResidencies(coachId);
  const { data: allArenas = [] } = useArenas();
  const request = useRequestLesson();
  const minhasEsperas = useMyCoachWaitlists();
  const sairDaEspera = useLeaveCoachWaitlist();
  const cuponsOn = true;
  const [cupom, setCupom] = useState(null);

  const [selected, setSelected] = useState(null); // { date, start, end }
  const [format, setFormat] = useState(LESSON_FORMAT.PRIVATE);
  const [notes, setNotes] = useState('');
  const [verEspera, setVerEspera] = useState(false);
  // Arenas parceiras: o aluno escolhe em qual arena quer a aula (item 3.1).
  // Se o professor não tem residência ativa, fica em branco (o professor confirma local).
  const [arenaId, setArenaId] = useState('');
  const activeResidencies = useMemo(
    () => (residencies || []).filter((r) => r.status !== 'paused'),
    [residencies],
  );
  const arenaNameById = useMemo(() => {
    const m = new Map();
    for (const a of allArenas) m.set(a.id, a.name);
    return m;
  }, [allArenas]);

  const freeDays = useMemo(() => {
    if (!availability || !busyQ.isSuccess) return [];
    return generateWeekSlots(availability, todayISO(), { days: 14, busy: busyQ.data || [] });
  }, [availability, busyQ.isSuccess, busyQ.data]);

  // Sem saber as aulas já marcadas, a lista ofereceria horário ocupado: a
  // falha de qualquer das duas leituras é falha, nunca "sem horários".
  const carregando = dispQ.isLoading || busyQ.isLoading;
  const falhou = dispQ.isError || busyQ.isError;
  const hasAvailability = freeDays.length > 0;
  const publicou = (availability?.windows || []).length > 0;
  const podePedir = hasAvailability && !carregando && !falhou;
  const slot = selected;

  async function handleSubmit() {
    if (!user?.uid) { toast.error(t('Entre na plataforma para solicitar uma aula.')); return; }
    if (!slot) { toast.error(t('Escolha um dos horários livres.')); return; }
    try {
      await request.mutateAsync({
        coachId,
        input: {
          slots: [slot],
          format,
          notes,
          arena_id: arenaId || null,
          ...(cuponsOn && cupom ? { coupon: cupom } : {}),
          student_name: user.displayName || user.email || '',
          student_email: user.email || '',
        },
      });
      toast.success(t('Solicitação enviada! O professor vai responder em breve.'));
      // Conseguiu horário: sai da lista de espera deste professor (se estava).
      if ((minhasEsperas.data || []).some((e) => e.coach_id === coachId)) {
        sairDaEspera.mutate({ coachId });
      }
      onOpenChange(false);
      setSelected(null);
      setNotes('');
      setCupom(null);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível solicitar a aula.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Solicitar aula com {nome}', { nome: coach?.display_name })}</DialogTitle>
          <DialogDescription>{t('Escolha um dos horários livres do professor. Ele confirma a aula.')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Arena (item 3.1): o aluno escolhe a arena parceira (se houver) */}
          {podePedir && activeResidencies.length > 0 && (
            <div>
              <Label className="text-xs">{t('Onde quer a aula?')}</Label>
              <select
                value={arenaId}
                onChange={(e) => setArenaId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t('Combinar com o professor (sem arena definida)')}</option>
                {activeResidencies.map((r) => (
                  <option key={r.id} value={r.arena_id}>{arenaNameById.get(r.arena_id) || r.arena_id}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-500">
                {t('O professor oferece aulas em uma ou mais arenas parceiras. Escolha a que prefere.')}
              </p>
            </div>
          )}
          {/* Formato */}
          <div>
            <Label className="text-xs">{t('Formato da aula')}</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.values(LESSON_FORMAT).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    format === f ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:bg-paper',
                  )}
                >
                  {t(LESSON_FORMAT_LABELS[f])}
                </button>
              ))}
            </div>
          </div>

          {carregando ? (
            <div aria-busy="true"><V2Skeleton lines={3} /></div>
          ) : falhou ? (
            <V2ErrorState
              inline
              title={t('Não foi possível carregar os horários do professor')}
              description={t('Os horários dele continuam lá — só não conseguimos buscá-los agora.')}
              onRetry={() => { dispQ.refetch(); busyQ.refetch(); }}
            />
          ) : hasAvailability ? (
            <>
              <div>
                <Label className="text-xs">{t('Horários livres')}</Label>
                <div className="mt-1 max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-gray-100 bg-paper p-3">
                  {freeDays.map((day) => (
                    <div key={day.date}>
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{fmtDay(day.date)}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {day.slots.map((s) => {
                          const isSel = selected && selected.date === s.date && selected.start === s.start;
                          return (
                            <button
                              key={`${s.date}_${s.start}`}
                              type="button"
                              aria-pressed={Boolean(isSel)}
                              onClick={() => setSelected({ date: s.date, start: s.start, end: s.end })}
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                isSel ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-green-300',
                              )}
                            >
                              {s.start}–{s.end}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="aula-mensagem" className="text-xs">{t('Mensagem ao professor (opcional)')}</Label>
                <textarea
                  id="aula-mensagem"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder={t('Seu nível, objetivo da aula, preferências…')}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-ink" role="status">
                <CalendarOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                <div>
                  <p className="font-semibold">
                    {publicou
                      ? t('Nenhum horário livre nas próximas duas semanas.')
                      : t('Este professor ainda não tem horários disponíveis.')}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {t('Mande uma mensagem para combinar outro horário, ou entre na lista de espera: avisamos você assim que abrir horário ou vaga.')}
                  </p>
                </div>
              </div>
              <V2ChatLauncherButton
                athlete={{ id: coachId, platform_name: coach?.display_name, photo_url: coach?.photo_url }}
                variant="outline"
                label={t('Mandar mensagem ao professor')}
              />
              <CoachWaitlistJoin coach={coach} format={format} />
            </div>
          )}

          {cuponsOn && podePedir && (
            <Suspense fallback={null}>
              <LessonCouponField coachId={coachId} hourlyRate={coach?.hourly_rate ?? null} slot={slot}
                value={cupom} onChange={setCupom} initialCode={open ? initialCouponCode : ''} />
            </Suspense>
          )}

          {slot && (
            <div className="rounded-lg bg-acid/10 p-3 text-sm text-ink">
              {t('Aula {formato} em {dia}, {inicio}–{fim}', { formato: t(LESSON_FORMAT_LABELS[format]), dia: fmtDay(slot.date), inicio: slot.start, fim: slot.end })}
              {arenaId && (() => {
                const name = arenaNameById.get(arenaId);
                return name ? <> {t('em {arena}', { arena: name })}</> : null;
              })()}.
              {coach?.hourly_rate != null && (
                <span className="text-ink/70"> · {t('Valor de referência: R$ {valor}/h (o professor confirma).', { valor: Number(coach.hourly_rate).toFixed(2) })}</span>
              )}
            </div>
          )}

          {podePedir && (!verEspera ? (
            <button type="button" onClick={() => setVerEspera(true)} className="text-left text-xs font-semibold text-ink underline-offset-2 hover:underline">
              {t('Nenhum horário serve? Entre na lista de espera ou fale com o professor.')}
            </button>
          ) : (
            <div className="space-y-2">
              <CoachWaitlistJoin coach={coach} format={format} />
              <V2ChatLauncherButton
                athlete={{ id: coachId, platform_name: coach?.display_name, photo_url: coach?.photo_url }}
                variant="outline"
                label={t('Mandar mensagem ao professor')}
              />
            </div>
          ))}
        </div>

        {podePedir ? (
          <>
            {!slot && (
              <p role="status" className="text-right text-xs text-gray-500">{t('Escolha um dos horários livres.')}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancelar')}</Button>
              <Button onClick={handleSubmit} disabled={request.isPending || !slot}>
                {request.isPending ? t('Enviando…') : t('Solicitar aula')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Fechar')}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
