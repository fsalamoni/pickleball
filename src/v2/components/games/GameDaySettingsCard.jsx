/**
 * GameDaySettingsCard — TUDO o que dá para configurar num dia de jogo, num
 * cartão só, igual em toda origem.
 *
 * ## Os dois defeitos que isto corrige
 *
 * **(1) A configuração estava espalhada por três telas diferentes.** O dia de
 * jogo nasce em três lugares (atleta, arena, clube) e, depois de criado, era
 * configurado em três lugares distintos — diálogo do atleta, diálogo da arena,
 * cartão à mão do clube. Nos formatos de GRADE (o padrão de uma data de clube)
 * o número de quadras não aparecia em configuração nenhuma: existia só como um
 * campo transitório dentro do diálogo de sorteio, redigitado a cada sorteio.
 *
 * **(2) E ela estava espalhada DENTRO da própria tela.** "Quem organiza as
 * partidas" vivia no cartão *Organização*; formato e quadras, noutro cartão;
 * nome, data e local, atrás de um botão que abria um modal. Três lugares para
 * responder uma pergunta só — *como este dia funciona?* — e, pior, o modo de
 * gestão chegou a existir em DOIS deles ao mesmo tempo.
 *
 * Agora é um cartão, com três seções, montado **dentro do `GameDayModule`** —
 * então chega ao atleta, à arena e ao clube **por construção**, não por alguém
 * lembrar. E é um cartão que ABRE, não um modal: configurar é parte de
 * organizar o dia, não um desvio para outra tela.
 *
 * ## O que cada origem manda
 *
 * As duas primeiras seções são iguais em toda origem. A terceira —
 * identificação — pertence a quem é dono dela, e por isso muda:
 *
 * | | atleta | arena | clube |
 * |---|---|---|---|
 * | formato, quadras, quem organiza | aqui | aqui | aqui |
 * | nome, data, local, visibilidade | **aqui** | no diálogo da arena (com as quadras reservadas) | na DATA do evento |
 *
 * ⚠️ As **quadras** na arena são de LEITURA: lá elas não são um número solto —
 * são as quadras e horários efetivamente reservados no calendário, que fecham
 * a grade para reserva. Campo livre aqui desencontraria a contagem do dia das
 * quadras realmente bloqueadas.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Settings2, Building2, UserPlus, X, Crown, ShieldCheck, Users, Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { V2Button, V2Badge } from '@/v2/ui/primitives';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { cn } from '@/core/lib/utils';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS, isCourtByCourtFormat,
} from '@/modules/clubs/domain/gameDayFormats';
import {
  GAME_DAY_MANAGE_MODE, GAME_DAY_MANAGE_MODE_LABELS, GAME_DAY_MANAGE_MODE_HINTS,
  gameDayManageMode, gameDayAdminList,
} from '@/modules/games/domain/gameDayRoles';
import {
  normalizePlayCourts, GAME_DAY_VISIBILITY, GAME_DAY_VISIBILITY_LABELS,
} from '@/modules/games/domain/gameDay';
import { isArenaGameDay } from '@/modules/games/domain/arenaGameDay';
import { arenaGameDayEditLink, isOpenMatchGameDay } from '@/modules/arenas/domain/openMatchGameDay';
import { isClubGameDay } from '@/modules/games/domain/clubGameDay';
import {
  useGameDayGames, useGameDayParticipants, useUpdateGameDay,
  useAddGameDayAdmin, useRemoveGameDayAdmin, useSetGameDayManageMode,
} from '@/modules/games/hooks/useGameDays';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { useGameDayFormatChoices } from '@/modules/games/hooks/useGameDayFormatChoices';

const CAMPOS_DE_IDENTIDADE = [
  'title', 'visibility', 'date', 'time', 'location', 'city', 'state', 'notes',
];

function identidadeDe(gameDay) {
  return {
    title: gameDay?.title || '',
    visibility: gameDay?.visibility || GAME_DAY_VISIBILITY.PRIVATE,
    date: gameDay?.date || '',
    time: gameDay?.time || '',
    location: gameDay?.location || '',
    city: gameDay?.city || '',
    state: gameDay?.state || '',
    notes: gameDay?.notes || '',
  };
}

/**
 * @param {{ gameDay: object }} props
 */
export default function GameDaySettingsCard({ gameDay }) {
  const gdId = gameDay?.id || null;
  // Mesma chave de React Query que o organizador logo abaixo já usa: volta do
  // cache, sem consulta nova.
  const { data: participants = [] } = useGameDayParticipants(gdId);
  const { podeConfigurar } = useGameDayRoles(gameDay, participants);
  // ⚠️ FALHA não é "nenhum jogo": com a consulta caída a tela liberaria a troca
  // de formato num dia que JÁ TEM partidas — o que apaga rodada disputada.
  // Estado desconhecido não habilita comando.
  const { data: games = [], isError: falhouJogos } = useGameDayGames(gdId);
  const { data: athletes = [], isError: falhouAtletas } = useAthletes();

  const update = useUpdateGameDay();
  const setMode = useSetGameDayManageMode(gdId);
  const addAdmin = useAddGameDayAdmin(gdId);
  const removeAdmin = useRemoveGameDayAdmin(gdId);
  // Formatos que se pode escolher — fonte ÚNICA (`gameDayFormatChoices`):
  // cada formato opcional com a sua flag, e o formato que o dia JÁ TEM sempre
  // presente (flag desligada tira a opção de ESCOLHER, nunca a de manter o
  // que está gravado). Chamado antes do retorno antecipado: regra dos hooks.
  const opcoesDeFormato = useGameDayFormatChoices({
    current: gameDay?.format || GAME_DAY_FORMAT.AMERICANO,
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [identidade, setIdentidade] = useState(() => identidadeDe(gameDay));
  const [editandoIdentidade, setEditandoIdentidade] = useState(false);

  // Re-sincroniza quando o documento muda por fora (outra aba, outro
  // organizador) — mas NUNCA no meio de uma edição, que apagaria o que a
  // pessoa está digitando.
  useEffect(() => {
    if (!editandoIdentidade) setIdentidade(identidadeDe(gameDay));
  }, [gameDay, editandoIdentidade]);

  const perfilPorUid = useMemo(() => {
    const mapa = new Map();
    (athletes || []).forEach((a) => { if (a?.uid) mapa.set(a.uid, a); });
    (participants || []).forEach((p) => {
      if (p?.user_id && !mapa.has(p.user_id)) {
        mapa.set(p.user_id, { platform_name: p.name, photo_url: p.photo_url });
      }
    });
    if (gameDay?.created_by && !mapa.has(gameDay.created_by)) {
      mapa.set(gameDay.created_by, {
        platform_name: gameDay.creator_name, photo_url: gameDay.creator_photo,
      });
    }
    return mapa;
  }, [athletes, participants, gameDay?.created_by, gameDay?.creator_name, gameDay?.creator_photo]);

  const organizadores = useMemo(
    () => gameDayAdminList(gameDay, perfilPorUid),
    [gameDay, perfilPorUid],
  );
  const jaOrganizam = useMemo(() => new Set(organizadores.map((o) => o.uid)), [organizadores]);
  const candidatos = useMemo(
    () => (athletes || [])
      .filter((a) => a?.uid && !jaOrganizam.has(a.uid))
      .map((a) => ({ uid: a.uid, name: a.platform_name || 'Atleta', photo_url: a.photo_url || null })),
    [athletes, jaOrganizam],
  );

  if (!gdId || !podeConfigurar) return null;

  const daArena = isArenaGameDay(gameDay);
  const doClube = isClubGameDay(gameDay);
  // A identidade é editada aqui só quando ESTA origem manda nela. Na arena são
  // as quadras e horários reservados que definem o dia; no clube, a DATA do
  // evento. Dois lugares editando o mesmo campo divergem.
  const identidadeAqui = !daArena && !doClube;

  const format = gameDay.format || GAME_DAY_FORMAT.AMERICANO;
  const quadras = normalizePlayCourts(gameDay.play_courts);
  const modo = gameDayManageMode(gameDay);
  const temPartidas = games.length > 0;
  const formatoTravado = temPartidas || falhouJogos || update.isPending;
  const nomeados = organizadores.filter((o) => !o.criador).length;


  const gravar = async (patch, sucesso) => {
    try {
      await update.mutateAsync({ id: gdId, patch });
      if (sucesso) toast.success(sucesso);
      return true;
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
      return false;
    }
  };

  const trocarFormato = (novo) => {
    if (!novo || novo === format) return;
    // `play_courts` vai junto para o dia nunca ficar sem contagem de quadras ao
    // virar um formato que precisa dela.
    gravar({ format: novo, play_courts: quadras }, 'Formato alterado.');
  };

  const trocarQuadras = (valor) => {
    const n = normalizePlayCourts(valor);
    if (n === quadras) return;
    gravar({ play_courts: n }, n === 1 ? '1 quadra neste dia.' : `${n} quadras neste dia.`);
  };

  const trocarModo = async (novo) => {
    if (novo === modo) return;
    try {
      await setMode.mutateAsync(novo);
      toast.success(novo === GAME_DAY_MANAGE_MODE.PARTICIPANTS
        ? 'Agora qualquer participante pode organizar as partidas.'
        : 'Só você e os organizadores que nomear podem conduzir as partidas.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível mudar o modo.');
    }
  };

  const nomear = async (pessoa) => {
    try {
      await addAdmin.mutateAsync(pessoa.uid);
      toast.success(`${pessoa.name} agora organiza este dia de jogo.`);
      setPickerOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível nomear.');
    }
  };

  const remover = async (uid) => {
    try {
      await removeAdmin.mutateAsync(uid);
      toast.success('Organizador removido. Ele continua participando do dia de jogo.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível remover.');
    }
  };

  const salvarIdentidade = async () => {
    if (!identidade.title.trim()) { toast.error('Dê um nome ao dia de jogo.'); return; }
    const patch = {};
    CAMPOS_DE_IDENTIDADE.forEach((k) => { patch[k] = identidade[k]; });
    const ok = await gravar(patch, 'Dia de jogo atualizado.');
    if (ok) setEditandoIdentidade(false);
  };

  const setCampo = (k, v) => {
    setEditandoIdentidade(true);
    setIdentidade((s) => ({ ...s, [k]: v }));
  };

  const resumo = [
    GAME_DAY_FORMAT_LABELS[format] || format,
    quadras === 1 ? '1 quadra' : `${quadras} quadras`,
    modo === GAME_DAY_MANAGE_MODE.PARTICIPANTS
      ? 'Aberto a todos'
      : `Só você${nomeados > 0 ? ` e mais ${nomeados}` : ''}`,
  ].join(' · ');

  return (
    <V2CollapsibleCard
      icon={Settings2}
      title="Configurações do dia de jogo"
      summary={resumo}
      sectionId={GAME_DAY_SECTION.SETTINGS}
      defaultCollapsed
    >
      <div className="space-y-6">
        {/* ------------------------------------------------- 1. como se joga */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Como se joga</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`gds-fmt-${gdId}`}>Formato</Label>
              <select
                id={`gds-fmt-${gdId}`}
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-ink disabled:bg-paper disabled:text-gray-400"
                value={format}
                disabled={formatoTravado}
                onChange={(e) => trocarFormato(e.target.value)}
              >
                {opcoesDeFormato.map((v) => (
                  <option key={v} value={v}>{GAME_DAY_FORMAT_LABELS[v] || v}</option>
                ))}
              </select>
              {falhouJogos ? (
                <p className="text-xs text-amber-700">
                  A lista de partidas não carregou, então não dá para saber se este dia já tem jogos.
                  Trocar o formato agora poderia apagar rodada disputada.
                </p>
              ) : temPartidas ? (
                <p className="text-xs text-gray-500">
                  Este dia já tem partidas. Para trocar de formato, apague as partidas primeiro — cada
                  formato deriva as rodadas de um jeito, e a troca perderia o que já aconteceu.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`gds-qd-${gdId}`}>Quadras disponíveis</Label>
              {daArena ? (
                <>
                  <div className="flex h-10 w-full items-center rounded-md border border-dashed border-gray-200 bg-paper px-3 text-sm text-gray-600">
                    {quadras === 1 ? '1 quadra' : `${quadras} quadras`}
                  </div>
                  <p className="flex items-start gap-1.5 text-xs text-gray-500">
                    <Building2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Vem das quadras reservadas no calendário da arena. Para mudar, edite o dia de jogo
                    na gestão da arena.
                  </p>
                </>
              ) : (
                <>
                  <input
                    id={`gds-qd-${gdId}`}
                    type="number"
                    min={1}
                    max={12}
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-ink"
                    defaultValue={quadras}
                    disabled={update.isPending}
                    onBlur={(e) => trocarQuadras(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    {isCourtByCourtFormat(format)
                      ? 'Quantas quadras rodam ao mesmo tempo. Com mais de uma, dá para sortear a rodada inteira de uma vez.'
                      : 'Quantas quadras rodam ao mesmo tempo no sorteio. Deixe em 1 para automático — aí o sorteio usa todas as quadras que o número de atletas permitir.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* --------------------------------------------- 2. quem organiza */}
        <section className="space-y-3 border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-ink">Quem organiza as partidas</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(GAME_DAY_MANAGE_MODE).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                disabled={setMode.isPending}
                onClick={() => trocarModo(m)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60',
                  modo === m ? 'border-ink bg-ink text-white' : 'border-gray-200 hover:bg-paper',
                )}
              >
                <span className="block text-sm font-semibold">{GAME_DAY_MANAGE_MODE_LABELS[m]}</span>
                <span className={cn('mt-0.5 block text-[11px] leading-4', modo === m ? 'text-white/70' : 'text-gray-500')}>
                  {GAME_DAY_MANAGE_MODE_HINTS[m]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-sm font-semibold text-ink">Organizadores</p>
            <V2Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Nomear organizador
            </V2Button>
          </div>
          <div className="space-y-1.5">
            {organizadores.map((o) => (
              <div key={o.uid} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2">
                <UserAvatar name={o.nome || 'Atleta'} photoUrl={o.foto} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {o.nome || 'Atleta da plataforma'}
                </span>
                {o.criador ? (
                  <V2Badge tone="neutral"><Crown className="mr-1 h-3 w-3" /> Criador</V2Badge>
                ) : (
                  <V2Button
                    variant="ghost"
                    className="text-gray-400 hover:text-red-600"
                    title="Remover organizador"
                    aria-label={`Remover ${o.nome || 'organizador'}`}
                    onClick={() => setConfirmRemove(o)}
                  >
                    <X className="h-4 w-4" />
                  </V2Button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">
            O organizador conduz as partidas e a lista de participantes. Remover não tira ninguém do
            dia de jogo. Editar, arquivar e publicar no ranking continuam com quem configura o dia.
          </p>
        </section>

        {/* ------------------------------------------- 3. identificação */}
        <section className="space-y-3 border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-ink">Nome, data e local</h3>
          {identidadeAqui ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`gds-nome-${gdId}`}>Nome*</Label>
                <Input
                  id={`gds-nome-${gdId}`}
                  value={identidade.title}
                  maxLength={80}
                  onChange={(e) => setCampo('title', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Visibilidade</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.values(GAME_DAY_VISIBILITY).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={identidade.visibility === v}
                      onClick={() => setCampo('visibility', v)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                        identidade.visibility === v
                          ? 'border-ink bg-ink text-white'
                          : 'border-gray-200 text-gray-600 hover:bg-paper',
                      )}
                    >
                      {GAME_DAY_VISIBILITY_LABELS[v]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500">
                  Público publica um convite em &quot;Procura-se jogo&quot;; privado remove esse convite.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`gds-data-${gdId}`}>Data</Label>
                  <Input
                    id={`gds-data-${gdId}`}
                    type="date"
                    value={identidade.date}
                    onChange={(e) => setCampo('date', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`gds-hora-${gdId}`}>Horário</Label>
                  <Input
                    id={`gds-hora-${gdId}`}
                    type="time"
                    value={identidade.time}
                    onChange={(e) => setCampo('time', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`gds-local-${gdId}`}>Local</Label>
                <Input
                  id={`gds-local-${gdId}`}
                  value={identidade.location}
                  maxLength={160}
                  placeholder="Arena, quadra, endereço…"
                  onChange={(e) => setCampo('location', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`gds-cidade-${gdId}`}>Cidade</Label>
                  <Input
                    id={`gds-cidade-${gdId}`}
                    value={identidade.city}
                    maxLength={80}
                    onChange={(e) => setCampo('city', e.target.value)}
                  />
                </div>
                <div className="w-20 space-y-1.5">
                  <Label htmlFor={`gds-uf-${gdId}`}>UF</Label>
                  <Input
                    id={`gds-uf-${gdId}`}
                    value={identidade.state}
                    maxLength={2}
                    placeholder="SP"
                    onChange={(e) => setCampo('state', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`gds-obs-${gdId}`}>Observações (opcional)</Label>
                <textarea
                  id={`gds-obs-${gdId}`}
                  rows={2}
                  maxLength={1000}
                  value={identidade.notes}
                  placeholder="Nível, valor da quadra, o que levar…"
                  onChange={(e) => setCampo('notes', e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-ink"
                />
              </div>

              {/* O botão só aparece quando há algo para salvar — botão parado
                  na tela faz a pessoa clicar sem ter mudado nada e duvidar se
                  salvou. */}
              {editandoIdentidade && (
                <div className="flex flex-wrap justify-end gap-2">
                  <V2Button
                    variant="ghost"
                    size="sm"
                    disabled={update.isPending}
                    onClick={() => { setEditandoIdentidade(false); setIdentidade(identidadeDe(gameDay)); }}
                  >
                    Descartar
                  </V2Button>
                  <V2Button size="sm" disabled={update.isPending} onClick={salvarIdentidade}>
                    <Check className="mr-1.5 h-4 w-4" />
                    {update.isPending ? 'Salvando…' : 'Salvar alterações'}
                  </V2Button>
                </div>
              )}
            </>
          ) : (
            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              {daArena ? (
                <>
                  <Building2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {isOpenMatchGameDay(gameDay)
                      ? 'Nome, data, horário, quadras e vagas são do jogo aberto — mudam junto com a vitrine.'
                      : 'Nome, data, local e as quadras reservadas são da arena.'}{' '}
                    <Link
                      to={arenaGameDayEditLink({ ...gameDay, id: gdId })}
                      className="font-semibold text-ink underline"
                    >
                      {isOpenMatchGameDay(gameDay) ? 'Editar o jogo aberto' : 'Editar na gestão da arena'}
                    </Link>.
                  </span>
                </>
              ) : (
                <>
                  <Users aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Nome, data, horário e local vêm da DATA do evento do clube — é ela que manda neles.
                    {gameDay.club_event_id && (
                      <>
                        {' '}
                        <Link
                          to={`/clubes/${gameDay.club_id}/eventos/${gameDay.club_event_id}`}
                          className="font-semibold text-ink underline"
                        >
                          Editar no clube
                        </Link>.
                      </>
                    )}
                  </span>
                </>
              )}
            </p>
          )}
        </section>
      </div>

      <NomearDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        candidatos={candidatos}
        falhou={falhouAtletas}
        onEscolher={nomear}
      />
      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(v) => !v && setConfirmRemove(null)}
        title="Remover organizador?"
        description={confirmRemove
          ? `${confirmRemove.nome || 'O atleta'} deixa de conduzir as partidas. Ele continua participando do dia de jogo.`
          : ''}
        confirmLabel="Remover"
        onConfirm={() => { const o = confirmRemove; setConfirmRemove(null); if (o) remover(o.uid); }}
      />
    </V2CollapsibleCard>
  );
}

function NomearDialog({ open, onClose, candidatos, onEscolher, falhou = false }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const lista = candidatos.filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nomear organizador</DialogTitle>
          <DialogDescription>
            Quem você escolher passa a conduzir as partidas e a lista de participantes deste dia de jogo —
            e entra nele como membro, para poder acompanhar.
          </DialogDescription>
        </DialogHeader>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome…" />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {lista.length === 0 ? (
            falhou ? (
              <p className="py-6 text-center text-sm text-amber-700">
                A lista de atletas não carregou. Tente de novo.
              </p>
            ) : (
              <p className="py-6 text-center text-sm text-gray-400">Nenhum atleta encontrado.</p>
            )
          ) : lista.map((p) => (
            <div key={p.uid} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <span className="truncate text-sm font-medium text-ink">{p.name}</span>
              </div>
              <V2Button size="sm" variant="ghost" onClick={() => onEscolher(p)}>
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Nomear
              </V2Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Fechar</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
