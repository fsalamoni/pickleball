/**
 * GameDaySettingsCard — as configurações DO DIA DE JOGO, iguais em toda origem.
 *
 * ## O defeito que isto corrige
 *
 * O dia de jogo nasce em três lugares e, depois de criado, era configurado em
 * três lugares DIFERENTES:
 *
 * · **atleta** — diálogo completo (`CreateGameDayDialog`): formato, quadras,
 *   quem organiza, e mais a identidade do dia (nome, data, local, visibilidade);
 * · **arena**  — diálogo próprio, com as quadras e horários reservados;
 * · **clube**  — um cartão escrito à mão na aba de jogos, com **formato** e,
 *   só nos formatos quadra a quadra, **quadras**.
 *
 * Resultado: quem organizava pelo clube não tinha como dizer **quem pode
 * conduzir as partidas** — o dia nasce aberto a qualquer inscrito e não havia
 * como fechar —, e num Americano (o formato PADRÃO de uma data de clube) não
 * encontrava o número de quadras em lugar nenhum da configuração. É a mesma
 * doença da Onda AS: cada tela montando o próprio miolo, e as três divergindo
 * em silêncio, porque isoladamente todas funcionam.
 *
 * Aqui as três configurações que **não dependem da origem** moram num lugar só,
 * e o cartão é montado dentro do `GameDayModule` — então chega ao atleta, à
 * arena e ao clube **por construção**, não por alguém lembrar.
 *
 * ## O que NÃO entra aqui
 *
 * O que é da ORIGEM, porque cada uma manda num campo diferente:
 *
 * | campo | quem manda |
 * |---|---|
 * | nome, data, horário, local | atleta: o diálogo · arena: o diálogo · clube: a DATA do evento |
 * | visibilidade | só o atleta (no clube, público significaria legível e auto-inscrevível por qualquer conta) |
 * | observações | segue o mesmo dono do nome/data (no clube, a observação da data) |
 * | quadras e horários reservados | a arena, e só ela |
 *
 * Dois lugares editando o MESMO campo divergem — por isso o diálogo do atleta e
 * o da arena deixaram de oferecer formato/quadras/quem organiza **na edição**
 * (na criação continuam, que é quando a escolha é feita).
 */

import React from 'react';
import { toast } from 'sonner';
import { Settings2, Building2 } from 'lucide-react';

import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { Label } from '@/components/ui/label';
import { cn } from '@/core/lib/utils';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS, DRAW_FORMATS, isCourtByCourtFormat,
} from '@/modules/clubs/domain/gameDayFormats';
import {
  GAME_DAY_MANAGE_MODE, GAME_DAY_MANAGE_MODE_LABELS, GAME_DAY_MANAGE_MODE_HINTS,
  gameDayManageMode,
} from '@/modules/games/domain/gameDayRoles';
import { normalizePlayCourts } from '@/modules/games/domain/gameDay';
import { isArenaGameDay } from '@/modules/games/domain/arenaGameDay';
import { useGameDayGames, useUpdateGameDay } from '@/modules/games/hooks/useGameDays';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

/**
 * @param {{ gameDay: object, participants?: Array<object>|null }} props
 */
export default function GameDaySettingsCard({ gameDay, participants = null }) {
  const { podeConfigurar } = useGameDayRoles(gameDay, participants);
  // ⚠️ FALHA não é "nenhum jogo": com a consulta caída, `games` viria vazio e a
  // tela liberaria a troca de formato num dia que JÁ TEM partidas — o que
  // apaga rodada disputada. Estado desconhecido não habilita comando.
  const { data: games = [], isError: falhouJogos } = useGameDayGames(gameDay?.id);
  const update = useUpdateGameDay();
  const americanoLiveOn = useFeatureFlag(FEATURE_FLAG.GAMEDAY_AMERICANO_LIVE);

  if (!gameDay?.id || !podeConfigurar) return null;

  const daArena = isArenaGameDay(gameDay);
  const format = gameDay.format || GAME_DAY_FORMAT.AMERICANO;
  const quadraAQuadra = isCourtByCourtFormat(format);
  const modo = gameDayManageMode(gameDay);
  const quadras = normalizePlayCourts(gameDay.play_courts);
  const temPartidas = games.length > 0;
  const salvando = update.isPending;

  const opcoesDeFormato = (() => {
    const lista = [
      ...DRAW_FORMATS,
      GAME_DAY_FORMAT.PLAY,
      ...(americanoLiveOn ? [GAME_DAY_FORMAT.AMERICANO_LIVE] : []),
    ];
    // O formato que o dia JÁ TEM entra mesmo com a flag desligada: uma flag
    // desligada tira a opção de ESCOLHER, nunca pode deixar o seletor sem a
    // opção correspondente ao que está gravado.
    return lista.includes(format) ? lista : [format, ...lista];
  })();

  const gravar = async (patch, sucesso) => {
    try {
      await update.mutateAsync({ id: gameDay.id, patch });
      if (sucesso) toast.success(sucesso);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
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
    gravar({ play_courts: n });
  };

  const trocarModo = (novo) => {
    if (novo === modo) return;
    gravar({ manage_mode: novo }, 'Quem organiza as partidas foi atualizado.');
  };

  return (
    <V2CollapsibleCard
      icon={Settings2}
      title="Configurações do dia de jogo"
      summary={`${GAME_DAY_FORMAT_LABELS[format] || format} · ${GAME_DAY_MANAGE_MODE_LABELS[modo]}`}
      sectionId={GAME_DAY_SECTION.SETTINGS}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* ------------------------------------------------------- formato */}
          <div className="space-y-1.5">
            <Label htmlFor={`gds-fmt-${gameDay.id}`}>Formato</Label>
            <select
              id={`gds-fmt-${gameDay.id}`}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-ink disabled:bg-paper disabled:text-gray-400"
              value={format}
              disabled={temPartidas || falhouJogos || salvando}
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

          {/* ------------------------------------------------------- quadras */}
          <div className="space-y-1.5">
            <Label htmlFor={`gds-qd-${gameDay.id}`}>Quadras disponíveis</Label>
            {daArena ? (
              /* Na arena as quadras NÃO são um número solto: elas são as quadras
                 e os horários efetivamente reservados no calendário, que fecham
                 a grade para reserva. Um campo livre aqui desencontraria a
                 contagem do dia das quadras realmente bloqueadas. */
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
                  id={`gds-qd-${gameDay.id}`}
                  type="number"
                  min={1}
                  max={12}
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-ink"
                  defaultValue={quadras}
                  disabled={salvando}
                  onBlur={(e) => trocarQuadras(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  {quadraAQuadra
                    ? 'Quantas quadras rodam ao mesmo tempo. Com mais de uma, dá para sortear a rodada inteira de uma vez.'
                    : 'Quantas quadras rodam ao mesmo tempo no sorteio. Deixe em 1 para automático — aí o sorteio usa todas as quadras que o número de atletas permitir.'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* -------------------------------------------- quem organiza o dia */}
        <div className="space-y-1.5">
          <Label>Quem pode organizar as partidas</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(GAME_DAY_MANAGE_MODE).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                disabled={salvando}
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
          <p className="text-[11px] text-gray-500">
            Editar, arquivar, publicar no ranking e nomear organizadores continuam com quem
            configura o dia.
          </p>
        </div>
      </div>
    </V2CollapsibleCard>
  );
}
