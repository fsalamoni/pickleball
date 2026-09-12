/**
 * ArenaGameDayDialog — a arena marca (ou corrige) um dia de jogo no calendário.
 *
 * ## O que esta tela tem de diferente da do atleta
 *
 * O atleta marca um rachão: nome, data, hora. A arena está RESERVANDO A SI
 * MESMA — escolhe quadras, fecha horários para reserva de terceiros e define
 * quantas pessoas cabem. São decisões com consequência no calendário, e por
 * isso o formulário mostra o efeito enquanto se preenche, em vez de só avisar
 * depois que deu errado.
 *
 * ## As três decisões, nesta ordem
 *
 *  1. **quando e onde** — data, quadras e horário. O horário pode ser um só
 *     para o dia todo (o caso comum, um clique) ou um por quadra (o caso do
 *     "quadra 1 das 18h, quadra 2 das 20h"). O padrão é o comum;
 *  2. **quantas pessoas** — inscrição no dia (uma lista só) ou por quadra (uma
 *     lista por quadra), com limite ou sem limite nenhum;
 *  3. **quem conduz** — só a equipe da arena, ou também os inscritos.
 *
 * A conferência de choque de horário (contra reservas e contra outros dias de
 * jogo) mora no serviço: é ele que tem a lista real na mão no instante de
 * gravar. Aqui se mostra o erro que ele devolve.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LayoutGrid, Clock, Users, ShieldCheck, Info } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS, DRAW_FORMATS,
} from '@/modules/clubs/domain/gameDayFormats';
import {
  GAME_DAY_MANAGE_MODE, gameDayManageMode,
} from '@/modules/games/domain/gameDayRoles';
import {
  ARENA_SIGNUP_MODE, ARENA_SIGNUP_MODE_LABELS, ARENA_SIGNUP_MODE_HINTS,
  normalizeArenaGameDayInput, arenaGameDaySlots, arenaGameDaySingleWindow,
} from '@/modules/games/domain/arenaGameDay';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import {
  useCreateArenaGameDay, useUpdateArenaGameDay,
} from '@/modules/games/hooks/useArenaGameDays';

const HORA_PADRAO = { start: '18:00', end: '22:00' };

/** Escolha em forma de cartão — some do caminho quando só há uma opção. */
function Escolha({ ativo, onClick, titulo, descricao, icone: Icone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
        ativo ? 'border-ink bg-ink/5' : 'border-gray-200 hover:border-ink/40',
      )}
    >
      {Icone && <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', ativo ? 'text-ink' : 'text-gray-400')} />}
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">{titulo}</span>
        {descricao && <span className="mt-0.5 block text-xs leading-5 text-gray-500">{descricao}</span>}
      </span>
    </button>
  );
}

function estadoInicial(gameDay, courts) {
  if (gameDay) {
    const slots = arenaGameDaySlots(gameDay);
    const mesmo = arenaGameDaySingleWindow(gameDay);
    return {
      title: gameDay.title || '',
      date: gameDay.date || '',
      notes: gameDay.notes || '',
      format: gameDay.format || GAME_DAY_FORMAT.AMERICANO,
      signup_mode: gameDay.signup_mode === ARENA_SIGNUP_MODE.COURT
        ? ARENA_SIGNUP_MODE.COURT : ARENA_SIGNUP_MODE.DAY,
      capacity: gameDay.capacity ?? '',
      manage_mode: gameDayManageMode(gameDay),
      horarioUnico: mesmo,
      janela: mesmo && slots[0]
        ? { start: slots[0].start_time, end: slots[0].end_time }
        : { ...HORA_PADRAO },
      selecionadas: slots.map((s) => ({
        court_id: s.court_id,
        start_time: s.start_time,
        end_time: s.end_time,
        capacity: s.capacity ?? '',
      })),
    };
  }
  return {
    title: '',
    date: '',
    notes: '',
    format: GAME_DAY_FORMAT.AMERICANO,
    signup_mode: ARENA_SIGNUP_MODE.DAY,
    capacity: '',
    manage_mode: GAME_DAY_MANAGE_MODE.OWNER_ONLY,
    horarioUnico: true,
    janela: { ...HORA_PADRAO },
    // A arena quase sempre quer todas as quadras: já vêm marcadas.
    selecionadas: (courts || []).map((c) => ({
      court_id: c.id, start_time: HORA_PADRAO.start, end_time: HORA_PADRAO.end, capacity: '',
    })),
  };
}

export default function ArenaGameDayDialog({
  open, onOpenChange, arena, gameDay = null, onSaved,
}) {
  const arenaId = arena?.id;
  const editando = !!gameDay;
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { data: bookings = [] } = useArenaBookings(arenaId);
  const criar = useCreateArenaGameDay(arenaId);
  const atualizar = useUpdateArenaGameDay(arenaId);
  const americanoLiveOn = useFeatureFlag(FEATURE_FLAG.GAMEDAY_AMERICANO_LIVE);

  const [form, setForm] = useState(() => estadoInicial(gameDay, courts));
  const [erros, setErros] = useState({});

  useEffect(() => {
    if (open) { setForm(estadoInicial(gameDay, courts)); setErros({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gameDay, courts.length]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const formatos = [
    ...DRAW_FORMATS,
    GAME_DAY_FORMAT.PLAY,
    ...(americanoLiveOn ? [GAME_DAY_FORMAT.AMERICANO_LIVE] : []),
  ];
  // O formato que o dia JÁ tem entra na lista mesmo com a flag desligada:
  // desligar uma flag tira a opção de CRIAR, nunca pode travar uma edição.
  if (editando && gameDay?.format && !formatos.includes(gameDay.format)) formatos.push(gameDay.format);

  const marcada = (courtId) => form.selecionadas.some((s) => s.court_id === courtId);
  const alternarQuadra = (courtId) => {
    setForm((f) => (f.selecionadas.some((s) => s.court_id === courtId)
      ? { ...f, selecionadas: f.selecionadas.filter((s) => s.court_id !== courtId) }
      : {
        ...f,
        selecionadas: [...f.selecionadas, {
          court_id: courtId,
          start_time: f.janela.start,
          end_time: f.janela.end,
          capacity: '',
        }],
      }));
  };
  const mudarQuadra = (courtId, patch) => setForm((f) => ({
    ...f,
    selecionadas: f.selecionadas.map((s) => (s.court_id === courtId ? { ...s, ...patch } : s)),
  }));

  // Horário único: mexer na janela mexe em todas as quadras marcadas de uma vez.
  const mudarJanela = (patch) => setForm((f) => {
    const janela = { ...f.janela, ...patch };
    return {
      ...f,
      janela,
      selecionadas: f.horarioUnico
        ? f.selecionadas.map((s) => ({ ...s, start_time: janela.start, end_time: janela.end }))
        : f.selecionadas,
    };
  });

  const usarHorarioUnico = (unico) => setForm((f) => ({
    ...f,
    horarioUnico: unico,
    selecionadas: unico
      ? f.selecionadas.map((s) => ({ ...s, start_time: f.janela.start, end_time: f.janela.end }))
      : f.selecionadas,
  }));

  /** O que vai para o domínio — a tela guarda estado de tela, não de banco. */
  const paraEntrada = () => ({
    title: form.title,
    date: form.date,
    notes: form.notes,
    format: form.format,
    signup_mode: form.signup_mode,
    capacity: form.capacity,
    manage_mode: form.manage_mode,
    arena_slots: form.selecionadas.map((s) => ({
      court_id: s.court_id,
      court_name: courts.find((c) => c.id === s.court_id)?.name || null,
      start_time: form.horarioUnico ? form.janela.start : s.start_time,
      end_time: form.horarioUnico ? form.janela.end : s.end_time,
      capacity: s.capacity,
    })),
  });

  const previa = useMemo(
    () => normalizeArenaGameDayInput(paraEntrada(), { courts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, courts],
  );

  const salvar = async () => {
    const entrada = paraEntrada();
    const { valid, errors } = normalizeArenaGameDayInput(entrada, { courts });
    setErros(errors);
    if (!valid) { toast.error(Object.values(errors)[0]); return; }
    try {
      if (editando) {
        await atualizar.mutateAsync({ gameDayId: gameDay.id, input: entrada, courts, bookings });
        toast.success('Dia de jogo atualizado.');
        onSaved?.(gameDay.id);
      } else {
        const { id } = await criar.mutateAsync({ input: entrada, arena, courts, bookings });
        toast.success('Dia de jogo criado. As quadras estão fechadas no calendário.');
        onSaved?.(id);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  const salvando = criar.isPending || atualizar.isPending;
  const porQuadra = form.signup_mode === ARENA_SIGNUP_MODE.COURT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar dia de jogo' : 'Novo dia de jogo da arena'}</DialogTitle>
          <DialogDescription>
            As quadras e os horários escolhidos ficam <strong>fechados para reserva</strong> no
            calendário da arena enquanto o dia de jogo existir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* 1 — identidade -------------------------------------------------- */}
          <div className="grid gap-3 sm:grid-cols-[1fr,170px]">
            <div>
              <Label htmlFor="agd-titulo">Nome do dia de jogo</Label>
              <Input
                id="agd-titulo"
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Sexta de Americano"
                className={cn('mt-1', erros.title && 'border-red-400')}
              />
            </div>
            <div>
              <Label htmlFor="agd-data">Data</Label>
              <Input
                id="agd-data"
                type="date"
                value={form.date}
                onChange={(e) => set({ date: e.target.value })}
                className={cn('mt-1', erros.date && 'border-red-400')}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="agd-formato">Formato</Label>
            <select
              id="agd-formato"
              value={form.format}
              onChange={(e) => set({ format: e.target.value })}
              className="mt-1 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 py-2.5 text-sm text-ink"
            >
              {formatos.map((f) => (
                <option key={f} value={f}>{GAME_DAY_FORMAT_LABELS[f] || f}</option>
              ))}
            </select>
          </div>

          {/* 2 — quadras e horários ------------------------------------------ */}
          <section className="rounded-3xl border border-gray-100 bg-paper p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <LayoutGrid className="h-4 w-4 text-gray-400" /> Quadras e horários
            </h3>

            {courts.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                Esta arena ainda não tem quadras cadastradas. Cadastre as quadras em
                {' '}<strong>Estrutura e preços → Quadras</strong> antes de marcar um dia de jogo.
              </p>
            ) : (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Escolha
                    ativo={form.horarioUnico}
                    onClick={() => usarHorarioUnico(true)}
                    icone={Clock}
                    titulo="Um horário para o dia todo"
                    descricao="Todas as quadras começam e terminam juntas."
                  />
                  <Escolha
                    ativo={!form.horarioUnico}
                    onClick={() => usarHorarioUnico(false)}
                    icone={Clock}
                    titulo="Um horário por quadra"
                    descricao="Cada quadra com o seu início e fim."
                  />
                </div>

                {form.horarioUnico && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <Label htmlFor="agd-ini">Início</Label>
                      <Input id="agd-ini" type="time" value={form.janela.start}
                        onChange={(e) => mudarJanela({ start: e.target.value })} className="mt-1 w-32" />
                    </div>
                    <div>
                      <Label htmlFor="agd-fim">Fim</Label>
                      <Input id="agd-fim" type="time" value={form.janela.end}
                        onChange={(e) => mudarJanela({ end: e.target.value })} className="mt-1 w-32" />
                    </div>
                  </div>
                )}

                <ul className="mt-3 space-y-2">
                  {courts.map((c) => {
                    const escolhida = form.selecionadas.find((s) => s.court_id === c.id);
                    return (
                      <li key={c.id} className={cn(
                        'rounded-2xl border p-3 transition-colors',
                        escolhida ? 'border-ink/20 bg-paper-pure' : 'border-gray-100',
                      )}
                      >
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={marcada(c.id)}
                            onChange={() => alternarQuadra(c.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-sm font-semibold text-ink">{c.name || 'Quadra'}</span>
                          {c.surface && <span className="text-xs text-gray-400">{c.surface}</span>}
                        </label>

                        {escolhida && !form.horarioUnico && (
                          <div className="mt-2 flex flex-wrap items-end gap-2 pl-7">
                            <div>
                              <Label htmlFor={`ini-${c.id}`} className="text-xs">Início</Label>
                              <Input id={`ini-${c.id}`} type="time" value={escolhida.start_time || ''}
                                onChange={(e) => mudarQuadra(c.id, { start_time: e.target.value })}
                                className="mt-1 w-28" />
                            </div>
                            <div>
                              <Label htmlFor={`fim-${c.id}`} className="text-xs">Fim</Label>
                              <Input id={`fim-${c.id}`} type="time" value={escolhida.end_time || ''}
                                onChange={(e) => mudarQuadra(c.id, { end_time: e.target.value })}
                                className="mt-1 w-28" />
                            </div>
                          </div>
                        )}

                        {escolhida && porQuadra && (
                          <div className="mt-2 pl-7">
                            <Label htmlFor={`cap-${c.id}`} className="text-xs">Limite de atletas nesta quadra</Label>
                            <Input
                              id={`cap-${c.id}`} type="number" min="1" inputMode="numeric"
                              value={escolhida.capacity ?? ''}
                              onChange={(e) => mudarQuadra(c.id, { capacity: e.target.value })}
                              placeholder="sem limite"
                              className="mt-1 w-36"
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {erros.arena_slots && <p className="mt-2 text-xs font-semibold text-red-500">{erros.arena_slots}</p>}
              </>
            )}
          </section>

          {/* 3 — inscrição ---------------------------------------------------- */}
          <section className="rounded-3xl border border-gray-100 bg-paper p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <Users className="h-4 w-4 text-gray-400" /> Como o atleta se inscreve
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.values(ARENA_SIGNUP_MODE).map((m) => (
                <Escolha
                  key={m}
                  ativo={form.signup_mode === m}
                  onClick={() => set({ signup_mode: m })}
                  titulo={ARENA_SIGNUP_MODE_LABELS[m]}
                  descricao={ARENA_SIGNUP_MODE_HINTS[m]}
                />
              ))}
            </div>
            {!porQuadra && (
              <div className="mt-3">
                <Label htmlFor="agd-cap">Limite de atletas no dia</Label>
                <Input
                  id="agd-cap" type="number" min="1" inputMode="numeric"
                  value={form.capacity} onChange={(e) => set({ capacity: e.target.value })}
                  placeholder="sem limite" className="mt-1 w-40"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Deixe em branco para não limitar. O limite vale para a lista do dia inteiro.
                </p>
              </div>
            )}
          </section>

          {/* 4 — quem conduz --------------------------------------------------- */}
          <section className="rounded-3xl border border-gray-100 bg-paper p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <ShieldCheck className="h-4 w-4 text-gray-400" /> Quem conduz o dia de jogo
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Escolha
                ativo={form.manage_mode === GAME_DAY_MANAGE_MODE.OWNER_ONLY}
                onClick={() => set({ manage_mode: GAME_DAY_MANAGE_MODE.OWNER_ONLY })}
                titulo="Só a equipe da arena"
                descricao="Sortear, criar e cancelar partidas, substituir atleta, lançar resultado e mexer na lista ficam com quem gerencia a arena."
              />
              <Escolha
                ativo={form.manage_mode === GAME_DAY_MANAGE_MODE.PARTICIPANTS}
                onClick={() => set({ manage_mode: GAME_DAY_MANAGE_MODE.PARTICIPANTS })}
                titulo="A equipe e os inscritos"
                descricao="Os atletas inscritos também conduzem as partidas, na conta deles. Bom para um Play em que a turma se organiza sozinha."
              />
            </div>
          </section>

          <div>
            <Label htmlFor="agd-obs">Observações (opcional)</Label>
            <textarea
              id="agd-obs" rows={2} value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Traga sua raquete. Bolas por conta da arena."
              className="mt-1 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 py-2.5 text-sm text-ink"
            />
          </div>

          {/* O efeito no calendário, dito antes de acontecer. */}
          {previa.valid && (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-800">
              <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {previa.value.arena_slots.length === 1 ? 'Uma quadra ficará fechada' : `${previa.value.arena_slots.length} quadras ficarão fechadas`}
                {' '}para reserva em {previa.value.date}
                {arenaGameDaySingleWindow({ arena_slots: previa.value.arena_slots })
                  ? `, das ${previa.value.arena_slots[0].start_time} às ${previa.value.arena_slots[0].end_time}.`
                  : ', cada uma no seu horário.'}
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          <V2Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</V2Button>
          <V2Button onClick={salvar} disabled={salvando || courts.length === 0}>
            {salvando ? 'Salvando…' : (editando ? 'Salvar' : 'Criar dia de jogo')}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
