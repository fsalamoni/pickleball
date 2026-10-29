/**
 * Publicar / editar um JOGO ABERTO — que agora é também um DIA DE JOGO (Onda CA).
 *
 * *"Na configuração do jogo aberto, é preciso contemplar outros detalhes de
 * configuração do dia de jogo."* O formulário tem três perguntas, na ordem em
 * que a arena pensa:
 *
 *  1. **Quando e onde** — data, horário e as QUADRAS (mais de uma: um
 *     Americano com 8 atletas precisa de duas). As quadras ficam fechadas no
 *     calendário pelo dia de jogo;
 *  2. **Como se joga** — o formato do dia de jogo (com o que cada um muda:
 *     placar, ranking do dia) e quem conduz as partidas;
 *  3. **Quem pode entrar** — vagas, faixa de nível, valor e modalidade: o que
 *     sempre foi o jogo aberto.
 *
 * E um resumo do efeito ANTES de salvar ("vira um dia de jogo em Americano, em
 * 2 quadras, até 8 atletas") — o que a arena vai ver acontecer.
 *
 * Três modos: `create`, `edit` e `link` (um jogo aberto antigo, publicado
 * antes da Onda CA, ganhando o dia de jogo dele).
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Info, LayoutGrid, ShieldCheck, Swords, Users, X } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  useCreateOpenMatch, useUpdateOpenMatch, useLinkOpenSlotToGameDay,
} from '@/modules/arenas/hooks/useArenaV3';
import { formatLevel } from '@/modules/arenas/domain/openMatch';
import {
  normalizeOpenMatchInput, OPEN_MATCH_DEFAULT_TITLE, openMatchFormatLabel, suggestedCourtCount,
  openSlotCourtIds,
} from '@/modules/arenas/domain/openMatchGameDay';
import { formatDateShortBR, todayISO } from '@/modules/arenas/domain/calendar';
import { GAME_DAY_FORMAT, formatHasScores } from '@/modules/clubs/domain/gameDayFormats';
import { formatRhythm } from '@/modules/games/domain/gameDayRules';
import { GAME_DAY_MANAGE_MODE } from '@/modules/games/domain/gameDayRoles';
import { useGameDayFormatChoices } from '@/modules/games/hooks/useGameDayFormatChoices';
import { DUPR_MAX, DUPR_MIN } from '@/modules/rating/domain/duprScale';
import {
  V2Badge, V2Button, V2Field, V2Input, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
import { t, tn, tk } from '@/core/i18n';

const MODALIDADES = [
  { id: 'duplas', label: tk('Duplas') },
  { id: 'mistas', label: tk('Duplas mistas') },
  { id: 'simples', label: tk('Simples') },
  { id: 'open', label: tk('Livre') },
  { id: 'treino', label: tk('Treino') },
];

/** Os degraus da régua: 2.0, 2.5, … 8.0. */
const NIVEIS = Array.from(
  { length: Math.round((DUPR_MAX - DUPR_MIN) / 0.5) + 1 },
  (_, i) => DUPR_MIN + i * 0.5,
);

const SELECT = 'h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink';

function Secao({ icone: Icone, titulo, descricao, children }) {
  return (
    <V2Surface as="section" variant="plano">
      <h4 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
        <Icone className="h-4 w-4 text-gray-400" aria-hidden="true" /> {titulo}
      </h4>
      {descricao && <p className="mt-0.5 text-xs text-gray-500">{descricao}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </V2Surface>
  );
}

function Escolha({ ativo, onClick, titulo, descricao, selo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'flex w-full flex-col items-start gap-0.5 rounded-2xl border p-3 text-left transition-colors',
        ativo ? 'border-ink bg-ink/5' : 'border-gray-200 bg-paper-pure hover:border-ink/40',
      )}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-bold text-ink">{titulo}</span>
        {selo && <span className="shrink-0 whitespace-nowrap">{selo}</span>}
      </span>
      {descricao && <span className="text-xs leading-5 text-gray-500">{descricao}</span>}
    </button>
  );
}

function NivelSelect({ id, value, onChange, placeholder }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
      <option value="">{placeholder}</option>
      {NIVEIS.map((n) => <option key={n} value={n}>{formatLevel(n)}</option>)}
    </select>
  );
}

const vazioSe = (v) => (v == null ? '' : String(v));

function estadoInicial(slot, gameDay) {
  if (!slot) {
    return {
      date: '', start: '19:00', end: '21:00', court_ids: [], total_spots: 8, format: 'duplas',
      price: '', min_level: '', max_level: '', notes: '', title: '',
      game_format: GAME_DAY_FORMAT.AMERICANO, manage_mode: GAME_DAY_MANAGE_MODE.OWNER_ONLY,
    };
  }
  return {
    date: slot.date || '',
    start: slot.start || '',
    end: slot.end || '',
    court_ids: openSlotCourtIds(slot),
    total_spots: slot.total_spots || 4,
    format: slot.format || 'duplas',
    price: vazioSe(slot.price),
    min_level: vazioSe(slot.min_level),
    max_level: vazioSe(slot.max_level),
    notes: slot.notes || '',
    title: gameDay?.title && gameDay.title !== OPEN_MATCH_DEFAULT_TITLE ? gameDay.title : '',
    game_format: gameDay?.format || slot.game_format || GAME_DAY_FORMAT.AMERICANO,
    manage_mode: gameDay?.manage_mode === GAME_DAY_MANAGE_MODE.PARTICIPANTS
      ? GAME_DAY_MANAGE_MODE.PARTICIPANTS
      : GAME_DAY_MANAGE_MODE.OWNER_ONLY,
  };
}

/**
 * @param {{
 *   arenaId: string, courts: Array<{id,name}>, onClose: Function,
 *   mode?: 'create'|'edit'|'link', slot?: object|null, gameDay?: object|null,
 *   names?: Record<string,string>,
 * }} props
 */
export default function OpenMatchForm({
  arenaId, courts = [], onClose, mode = 'create', slot = null, gameDay = null, names = {},
}) {
  const [form, setForm] = useState(() => estadoInicial(slot, gameDay));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const { data: bookings } = useArenaBookings(arenaId);
  // Com o ranking da casa ligado, "com placar" também quer dizer "soma pontos".
  const { isOn: moduloLigado } = useArenaModules(arenaId);
  const comRanking = moduloLigado(ARENA_MODULE_ID.LEAGUES);
  const criar = useCreateOpenMatch();
  const editar = useUpdateOpenMatch();
  const ligar = useLinkOpenSlotToGameDay();
  const salvando = criar.isPending || editar.isPending || ligar.isPending;

  // Formatos que se pode escolher — a MESMA fonte da criação do dia de jogo
  // (`gameDayFormatChoices`): Americano aprimorado, Mexicano e Rei da Quadra
  // cada um com a própria flag. Desligar uma flag tira a opção de CRIAR, nunca
  // trava uma edição: o formato que o dia já tem entra sempre.
  // O gravado vem do dia de jogo OU, numa vaga antiga ainda sem dia de jogo
  // ("Criar o dia de jogo"), do formato que a própria vaga guardou.
  const formatos = useGameDayFormatChoices({ current: gameDay?.format || slot?.game_format || null });

  const numeroOuNulo = (v) => (v === '' || v == null ? null : Number(v));
  const entrada = () => ({
    ...form,
    total_spots: Number(form.total_spots) || 0,
    price: numeroOuNulo(form.price),
    min_level: numeroOuNulo(form.min_level),
    max_level: numeroOuNulo(form.max_level),
  });
  const previa = normalizeOpenMatchInput(entrada(), { courts, formats: formatos });

  const alternarQuadra = (id) => set({
    court_ids: form.court_ids.includes(id)
      ? form.court_ids.filter((c) => c !== id)
      : [...form.court_ids, id],
  });

  const sugeridas = suggestedCourtCount(form.total_spots);
  const poucasQuadras = form.court_ids.length > 0 && form.court_ids.length < sugeridas
    && form.format !== 'simples';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!previa.valid) {
      toast.error(Object.values(previa.errors)[0]);
      return;
    }
    const ctx = { courts, formats: formatos, bookings: Array.isArray(bookings) ? bookings : null };
    try {
      if (mode === 'edit') {
        await editar.mutateAsync({ slotId: slot.id, input: entrada(), ctx });
        toast.success(t('Jogo aberto atualizado. O dia de jogo foi junto.'));
      } else if (mode === 'link') {
        await ligar.mutateAsync({ slotId: slot.id, input: entrada(), ctx: { ...ctx, names } });
        toast.success(t('Pronto: este jogo aberto agora tem o dia de jogo dele.'));
      } else {
        await criar.mutateAsync({ arenaId, input: entrada(), ctx });
        toast.success(t('Jogo aberto publicado. O dia de jogo foi criado e as quadras já constam ocupadas.'));
      }
      onClose();
    } catch (err) {
      toast.error(err?.message || t('Não foi possível salvar.'));
    }
  };

  const titulo = mode === 'edit' ? t('Editar jogo aberto')
    : mode === 'link' ? t('Criar o dia de jogo deste jogo aberto')
      : t('Publicar jogo aberto');

  return (
    <V2Surface>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">{titulo}</h3>
          <p className="text-xs text-gray-500">
            {mode === 'link'
              ? t('Quem já está inscrito entra no dia de jogo. Daí em diante, sorteio, placar e ranking do dia rodam como em qualquer dia de jogo.')
              : t('Os atletas veem o jogo na página da arena e entram sozinhos. Por trás, ele é um dia de jogo: sorteio, placar, ranking do dia e telão.')}
          </p>
        </div>
        <button
          type="button" onClick={onClose} aria-label={t('Fechar')}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Secao icone={CalendarDays} titulo={t('Quando e onde')}>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Data')} htmlFor="om-data">
              <V2Input id="om-data" type="date" required min={mode === 'create' ? todayISO() : undefined}
                value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </V2Field>
            <V2Field label={t('Início')} htmlFor="om-inicio">
              <V2Input id="om-inicio" type="time" required value={form.start} onChange={(e) => set({ start: e.target.value })} />
            </V2Field>
            <V2Field label={t('Fim')} htmlFor="om-fim">
              <V2Input id="om-fim" type="time" required value={form.end} onChange={(e) => set({ end: e.target.value })} />
            </V2Field>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{t('Quadras')}</p>
            <p className="text-xs text-gray-500">{t('Ficam fechadas no calendário neste horário — ninguém consegue reservar a mesma hora.')}</p>
            {courts.length === 0 ? (
              <p className="mt-2 text-xs text-amber-800">{t('Cadastre as quadras da arena para publicar um jogo aberto.')}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('Quadras do jogo')}>
                {courts.map((c) => {
                  const ativa = form.court_ids.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => alternarQuadra(c.id)} aria-pressed={ativa}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors',
                        ativa ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-ink hover:border-ink/40',
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {poucasQuadras && (
              <p className="mt-2 flex gap-1.5 text-xs text-amber-800">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                {t('{n} atletas em duplas costumam precisar de {q} quadras — com menos, parte da turma espera a vez.', { n: form.total_spots, q: sugeridas })}
              </p>
            )}
          </div>
        </Secao>

        <Secao
          icone={Swords}
          titulo={t('Como se joga')}
          descricao={comRanking
            ? t('É o formato do dia de jogo — decide como as partidas saem e se há placar. Com placar, o resultado soma no ranking da casa.')
            : t('É o formato do dia de jogo — decide como as partidas saem e se há placar.')}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {formatos.map((f) => (
              <Escolha
                key={f}
                ativo={form.game_format === f}
                onClick={() => set({ game_format: f })}
                titulo={t(openMatchFormatLabel(f))}
                descricao={t(formatRhythm(f) || '')}
                selo={formatHasScores(f)
                  ? <V2Badge tone="green">{t('Com placar')}</V2Badge>
                  : <V2Badge tone="neutral">{t('Sem placar')}</V2Badge>}
              />
            ))}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-gray-400" aria-hidden="true" /> {t('Quem conduz as partidas')}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Escolha
                ativo={form.manage_mode === GAME_DAY_MANAGE_MODE.OWNER_ONLY}
                onClick={() => set({ manage_mode: GAME_DAY_MANAGE_MODE.OWNER_ONLY })}
                titulo={t('Só a equipe da arena')}
                descricao={t('Sortear, criar partidas, substituir e lançar resultado ficam com quem gerencia a arena.')}
              />
              <Escolha
                ativo={form.manage_mode === GAME_DAY_MANAGE_MODE.PARTICIPANTS}
                onClick={() => set({ manage_mode: GAME_DAY_MANAGE_MODE.PARTICIPANTS })}
                titulo={t('A equipe e os inscritos')}
                descricao={t('Quem entrou no jogo também conduz, na conta dele. Bom para a turma que se organiza sozinha.')}
              />
            </div>
          </div>
          <V2Field label={t('Nome do jogo (opcional)')} htmlFor="om-titulo" hint={t('Em branco, aparece como "{titulo}".', { titulo: OPEN_MATCH_DEFAULT_TITLE })}>
            <V2Input id="om-titulo" maxLength={80} placeholder={t('Ex.: Terça do Americano')}
              value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </V2Field>
        </Secao>

        <Secao icone={Users} titulo={t('Quem pode entrar')}>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Vagas')} htmlFor="om-vagas">
              <V2NumberInput id="om-vagas" min={2} max={20} required rotulo={t('Vagas')}
                value={form.total_spots} onChange={(e) => set({ total_spots: e.target.value })} />
            </V2Field>
            <V2Field label={t('Modalidade')} htmlFor="om-modalidade">
              <select id="om-modalidade" value={form.format} onChange={(e) => set({ format: e.target.value })} className={SELECT}>
                {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
              </select>
            </V2Field>
            <V2Field label={t('Valor por atleta (R$)')} htmlFor="om-preco">
              <V2Input id="om-preco" type="number" min="0" step="0.01" placeholder={t('Vazio = combinar')}
                value={form.price} onChange={(e) => set({ price: e.target.value })} />
            </V2Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Nível mínimo')} htmlFor="om-min" hint={t('Régua 2.0–8.0')}>
              <NivelSelect id="om-min" value={form.min_level} onChange={(v) => set({ min_level: v })} placeholder={t('Qualquer')} />
            </V2Field>
            <V2Field label={t('Nível máximo')} htmlFor="om-max" hint={t('Régua 2.0–8.0')}>
              <NivelSelect id="om-max" value={form.max_level} onChange={(v) => set({ max_level: v })} placeholder={t('Qualquer')} />
            </V2Field>
          </div>
          <p className="text-xs text-gray-500">
            {t('Atletas sem nível na plataforma também podem entrar — ela nunca inventa um nível.')}
          </p>
        </Secao>

        <V2Field label={t('Observações')} htmlFor="om-obs">
          <V2Textarea id="om-obs" rows={2} placeholder={t('Ex.: traga raquete própria; bolas por conta da arena.')}
            value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </V2Field>

        {/* O efeito, dito ANTES de acontecer. */}
        {previa.valid && (
          <p className="flex items-start gap-2 rounded-2xl bg-acid/15 px-3.5 py-2.5 text-xs leading-5 text-ink">
            <LayoutGrid aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {mode === 'edit' ? t('Fica um dia de jogo em') : t('Vira um dia de jogo em')} <strong>{t(openMatchFormatLabel(previa.gameDay.format))}</strong>,{' '}
              {tn(previa.gameDay.arena_slots.length, 'em {n} quadra', 'em {n} quadras')},
              {' '}{t('para até')} <strong>{t('{n} atletas', { n: previa.slot.total_spots })}</strong>{t(', em {data} das {inicio} às {fim}.', { data: formatDateShortBR(previa.slot.date), inicio: previa.slot.start, fim: previa.slot.end })}
              {!formatHasScores(previa.gameDay.format) && ` ${t('No Play não há placar, então este jogo não alimenta ranking.')}`}
            </span>
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="submit" disabled={salvando || courts.length === 0}>
            {salvando ? t('Salvando…') : mode === 'edit' ? t('Salvar') : mode === 'link' ? t('Criar o dia de jogo') : t('Publicar')}
          </V2Button>
        </div>
      </form>
    </V2Surface>
  );
}
