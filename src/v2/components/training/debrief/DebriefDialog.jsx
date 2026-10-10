/**
 * O BALANÇO DO JOGO em duas telas: as perguntas (como foi, o que funcionou, o
 * que faltou, se evoluiu, corpo e cabeça) e, salvo o balanço, a SUGESTÃO da
 * semana — dias e drills escolhidos pela lógica pura (`suggestWeek`). A
 * pessoa escolhe quais dias entram nos treinos; nada entra sozinho.
 *
 * Os drills vêm da biblioteca que ela já vê (`useVisibleTrainingItems`), no
 * nível dela; sem drill para o foco, a tela diz isso em vez de inventar.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { useDebriefActions } from '@/modules/training/hooks/useDebriefs';
import { useMyTrainingPlans, usePlanActions } from '@/modules/training/hooks/useTrainingPlans';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { useTrainingMeta } from '@/modules/training/hooks/useTrainingMeta';
import {
  DEBRIEF_ENERGY_LABELS, DEBRIEF_LIMITS, DEBRIEF_RATING_LABELS, DEBRIEF_SOURCE, DEBRIEF_SOURCE_LABELS,
  EVOLUTION, EVOLUTION_LABELS, GAME_ASPECTS, answeredDebriefs, debriefPlanChange, debriefSourceKey,
  normalizeDebrief, suggestWeek,
} from '@/modules/training/domain/debrief';
import { formatDayLabel, todayLocal } from '@/modules/training/domain/dates';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  V2Button, V2Field, V2FilterChip, V2Input, V2Textarea,
} from '@/v2/ui/primitives';
import { mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';

const NOTAS = [1, 2, 3, 4, 5];

function Escala({ id, label, value, onChange, labels }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span id={id} className="text-sm font-semibold text-ink">{label}</span>
      <div role="radiogroup" aria-labelledby={id} className="flex gap-1">
        {NOTAS.map((n) => {
          const marcado = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={marcado}
              aria-label={`${n}, ${labels[n]}`}
              title={labels[n]}
              onClick={() => onChange(marcado ? null : n)}
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
    </div>
  );
}

function Aspectos({ legenda, dica, marcados, outros, onChange, dataDica }) {
  const cheio = marcados.length >= DEBRIEF_LIMITS.aspects;
  return (
    <fieldset className="space-y-2" data-dica={dataDica}>
      <legend className="text-sm font-semibold text-ink">{legenda}</legend>
      <p className="text-xs text-gray-500">{dica}</p>
      <div className="flex flex-wrap gap-1.5">
        {GAME_ASPECTS.map((a) => {
          const ativo = marcados.includes(a.id);
          return (
            <V2FilterChip
              key={a.id}
              active={ativo}
              aria-pressed={ativo}
              disabled={!ativo && cheio}
              onClick={() => onChange(ativo ? marcados.filter((x) => x !== a.id) : [...marcados, a.id], a.id)}
              className={cn('px-3 py-1.5 text-xs', outros.includes(a.id) && !ativo && 'opacity-60')}
            >
              {a.label}
            </V2FilterChip>
          );
        })}
      </div>
    </fieldset>
  );
}

const vazio = () => ({ rating: null, strengths: [], weaknesses: [], evolution: EVOLUTION.NAO_SEI, body: null, mind: null, note: '' });

/**
 * @param {{ open: boolean, onOpenChange: (o: boolean) => void, identity: object,
 *   source: object|null, history?: object[], initial?: object|null }} props
 *   `source` nulo = jogo avulso (a pessoa diz a data e o nome); `initial` = o
 *   balanço anterior, para refazer partindo do que já foi dito.
 */
export default function DebriefDialog({ open, onOpenChange, identity, source = null, history = [], initial = null }) {
  const hoje = todayLocal();
  const uid = identity.uid;
  const acoes = useDebriefActions(uid);
  const planos = useMyTrainingPlans(uid);
  const planAcoes = usePlanActions(identity, planos.data || []);
  const visiveis = useVisibleTrainingItems(identity);
  const meta = useTrainingMeta(uid);
  const { level } = useMyUnifiedLevel();

  const [avulso, setAvulso] = useState(() => ({ date: hoje, title: '', ref: `${hoje}_${Date.now()}` }));
  const [f, setF] = useState(() => (initial ? {
    ...vazio(),
    rating: initial.rating ?? null,
    strengths: initial.strengths || [],
    weaknesses: initial.weaknesses || [],
    evolution: initial.evolution || EVOLUTION.NAO_SEI,
    body: initial.body ?? null,
    mind: initial.mind ?? null,
    note: initial.note || '',
  } : vazio()));
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(null); // { id, sugestao }
  const [fora, setFora] = useState([]); // datas que a pessoa tirou da sugestão
  const set = (patch) => { setErro(''); setF((x) => ({ ...x, ...patch })); };

  const fonte = source || {
    type: DEBRIEF_SOURCE.AVULSO, ref_id: avulso.ref, date: avulso.date, title: avulso.title.trim() || DEBRIEF_SOURCE_LABELS.avulso,
  };
  const carregando = visiveis.isLoading || meta.isPending;

  const enviar = (e) => {
    e.preventDefault();
    const input = { ...f, source: fonte };
    const { valid, error, value } = normalizeDebrief(input);
    if (!valid) { setErro(error); return; }
    const chave = debriefSourceKey(value.source);
    const anteriores = answeredDebriefs(history).filter((d) => debriefSourceKey(d.source) !== chave);
    const sugestao = suggestWeek({
      debrief: value, history: anteriores, items: visiveis.items, level, routine: meta.data?.routine || null, today: hoje,
    });
    acoes.save.mutate({ input, suggestion: sugestao }, {
      onSuccess: (id) => { setSalvo({ id, sugestao }); setFora([]); },
      onError: (err) => setErro(mensagemDeErro(err, 'Não foi possível salvar o balanço agora.')),
    });
  };

  const dias = useMemo(
    () => (salvo ? salvo.sugestao.days.filter((d) => d.item_ids.length && !fora.includes(d.date)) : []),
    [salvo, fora],
  );
  const mudanca = useMemo(() => (salvo ? debriefPlanChange({
    days: dias,
    plans: planos.data || [],
    focus: salvo.sugestao.focus.map((x) => x.label.toLowerCase()),
    skills: salvo.sugestao.skills,
    today: hoje,
  }) : null), [salvo, dias, planos.data, hoje]);

  const ocupado = planAcoes.create.isPending || planAcoes.update.isPending || acoes.applied.isPending;

  const registrar = (planId, mode, extra = '') => acoes.applied.mutate(
    { id: salvo.id, planId, mode, dates: dias.map((d) => d.date) },
    {
      onSettled: () => {
        toast.success(`A semana entrou nos seus treinos.${extra}`);
        onOpenChange(false);
      },
    },
  );

  const adicionar = () => {
    if (!mudanca) return;
    const falhou = (err) => setErro(mensagemDeErro(err, 'Não foi possível adicionar aos treinos agora.'));
    if (mudanca.mode === 'plano') {
      const plano = (planos.data || []).find((p) => p.id === mudanca.planId);
      planAcoes.update.mutate({ plan: plano, input: mudanca.patch }, {
        onSuccess: () => registrar(mudanca.planId, 'plano', mudanca.full.length
          ? ` ${mudanca.full.length === 1 ? 'Um dia já estava cheio' : `${mudanca.full.length} dias já estavam cheios`} e ficou como estava.`
          : ''),
        onError: falhou,
      });
    } else {
      planAcoes.create.mutate(mudanca.input, { onSuccess: (id) => registrar(id, 'novo'), onError: falhou });
    }
  };

  const fechar = (o) => {
    if (!o) { setF(vazio()); setSalvo(null); setErro(''); }
    onOpenChange(o);
  };

  const resumo = fonte.games ? `${fonte.games} ${fonte.games === 1 ? 'jogo' : 'jogos'}${Number.isFinite(fonte.wins) ? `, ${fonte.wins} ${fonte.wins === 1 ? 'vitória' : 'vitórias'}` : ''}` : '';

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{salvo ? 'Sugestão para esta semana' : 'Balanço do jogo'}</DialogTitle>
          <DialogDescription>
            {salvo
              ? 'Escolha os dias que entram nos seus treinos. Você muda qualquer coisa depois, no plano.'
              : source
                ? `${source.title} · ${formatDayLabel(source.date, hoje)}${resumo ? ` · ${resumo}` : ''}`
                : 'Um jogo que a plataforma não registrou: diga quando foi.'}
          </DialogDescription>
        </DialogHeader>

        {!salvo ? (
          <form className="space-y-5" onSubmit={enviar} noValidate>
            {!source && (
              <div className="grid gap-3 sm:grid-cols-2">
                <V2Field label="Quando" htmlFor="balanco-data" required>
                  <V2Input id="balanco-data" type="date" max={hoje} value={avulso.date} onChange={(e) => setAvulso((x) => ({ ...x, date: e.target.value }))} />
                </V2Field>
                <V2Field label="Que jogo foi (opcional)" htmlFor="balanco-titulo">
                  <V2Input id="balanco-titulo" maxLength={DEBRIEF_LIMITS.title} value={avulso.title} onChange={(e) => setAvulso((x) => ({ ...x, title: e.target.value }))} placeholder="Ex.: Jogo com os amigos no clube" />
                </V2Field>
              </div>
            )}
            <div data-dica="treino-balanco-nota">
              <Escala id="balanco-nota" label="Como foi o seu jogo?" value={f.rating} onChange={(v) => set({ rating: v })} labels={DEBRIEF_RATING_LABELS} />
            </div>
            <Aspectos
              legenda="O que funcionou"
              dica={`Até ${DEBRIEF_LIMITS.aspects}. É o que a semana vai manter.`}
              marcados={f.strengths}
              outros={f.weaknesses}
              dataDica="treino-balanco-fortes"
              onChange={(lista, id) => set({ strengths: lista, weaknesses: f.weaknesses.filter((x) => x !== id) })}
            />
            <Aspectos
              legenda="O que faltou"
              dica={`Até ${DEBRIEF_LIMITS.aspects}. É daqui que sai o foco da semana.`}
              marcados={f.weaknesses}
              outros={f.strengths}
              dataDica="treino-balanco-fracos"
              onChange={(lista, id) => set({ weaknesses: lista, strengths: f.strengths.filter((x) => x !== id) })}
            />
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink">Comparando com os últimos jogos</legend>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(EVOLUTION).map((ev) => (
                  <V2FilterChip key={ev} active={f.evolution === ev} aria-pressed={f.evolution === ev} onClick={() => set({ evolution: ev })} className="px-3 py-1.5 text-xs">
                    {EVOLUTION_LABELS[ev]}
                  </V2FilterChip>
                ))}
              </div>
            </fieldset>
            <div className="space-y-3">
              <Escala id="balanco-corpo" label="Corpo (opcional)" value={f.body} onChange={(v) => set({ body: v })} labels={DEBRIEF_ENERGY_LABELS} />
              <Escala id="balanco-cabeca" label="Cabeça (opcional)" value={f.mind} onChange={(v) => set({ mind: v })} labels={DEBRIEF_ENERGY_LABELS} />
            </div>
            <V2Field label="Anotação (opcional)" htmlFor="balanco-nota-texto" hint="Só você lê.">
              <V2Textarea id="balanco-nota-texto" rows={2} maxLength={DEBRIEF_LIMITS.note} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Ex.: errei muitas devoluções na paralela" />
            </V2Field>
            {erro && <p className="text-sm font-medium text-red-500" role="alert">{erro}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <V2Button type="button" variant="ghost" onClick={() => fechar(false)}>Cancelar</V2Button>
              <V2Button type="submit" disabled={carregando || acoes.save.isPending}>
                {acoes.save.isPending ? 'Salvando…' : carregando ? 'Carregando a biblioteca…' : 'Salvar e ver a sugestão'}
              </V2Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4" data-dica="treino-balanco-sugestao">
            <p className="text-sm text-gray-600">{salvo.sugestao.message}</p>
            {salvo.sugestao.maintain && (
              <p className="text-xs text-gray-500">Para manter: {salvo.sugestao.maintain.label.toLowerCase()}.</p>
            )}
            {visiveis.incompleto && (
              <p className="text-xs text-amber-700">Parte da biblioteca não carregou; a sugestão usou o que veio.</p>
            )}
            {salvo.sugestao.empty ? (
              <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                A biblioteca ainda não tem drills para esse foco no seu nível. O balanço ficou salvo; procure na{' '}
                <Link className="font-semibold text-ink underline" to="/treino?aba=biblioteca" onClick={() => fechar(false)}>biblioteca</Link>
                {' '}ou peça ao seu professor.
              </p>
            ) : (
              <ul className="space-y-2">
                {salvo.sugestao.days.filter((d) => d.item_ids.length).map((d) => {
                  const dentro = !fora.includes(d.date);
                  return (
                    <li key={d.date} className={cn('rounded-2xl border p-3', dentro ? 'border-ink/20 bg-paper-pure' : 'border-gray-100 bg-gray-50 opacity-70')}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-ink"
                          checked={dentro}
                          onChange={() => setFora((x) => (dentro ? [...x, d.date] : x.filter((y) => y !== d.date)))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">{d.label} · {d.minutes} min</span>
                          <span className="block text-xs text-gray-500">
                            {d.item_ids.map((id) => visiveis.byId[id]?.title || 'Drill').join(' · ')}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {mudanca && (
              <p className="text-xs text-gray-500">
                {mudanca.mode === 'plano'
                  ? `Os dias entram no seu plano ativo, “${mudanca.planTitle}”.`
                  : mudanca.pauses
                    ? `Vira um plano curto, “Semana do balanço”. O plano “${mudanca.pauses.title}” fica pausado — dá para reativar quando quiser.`
                    : 'Vira um plano curto, “Semana do balanço”, que aparece no Hoje e no Diário.'}
              </p>
            )}
            {planos.isError && <p className="text-xs text-amber-700">Seus planos não carregaram; tente de novo antes de adicionar.</p>}
            {erro && <p className="text-sm font-medium text-red-500" role="alert">{erro}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <V2Button type="button" variant="ghost" onClick={() => fechar(false)}>Agora não</V2Button>
              {!salvo.sugestao.empty && (
                <V2Button type="button" onClick={adicionar} disabled={!mudanca || ocupado || !planos.isSuccess}>
                  {ocupado ? 'Adicionando…' : 'Adicionar aos meus treinos'}
                </V2Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
