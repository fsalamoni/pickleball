/**
 * GameDayLinkSection — "Clube ou arena": vincular o dia de jogo, sem sair dele.
 *
 * Montada dentro do `GameDaySettingsCard`. Só o dia do ATLETA aceita vínculo
 * (`canLinkGameDay`); o dia que já é da arena/do clube já tem as estatísticas lá.
 *
 * O vínculo é ATRIBUIÇÃO (ver `domain/gameDayLink.js`): as partidas passam a
 * contar para o clube/arena, quem é de fora vira convidado (só rótulo — mantém
 * todas as estatísticas) e o dia fica público, nunca exclusivo de membros.
 *
 * ⚠️ Falha não é vazio: se a lista de clubes/arenas não carregou, a tela diz isso
 * em vez de afirmar "você não administra nenhum".
 */
import React, { useState } from 'react';
import { Link2, Unlink, Building2, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { V2Button, V2Badge, V2Select, V2ErrorState } from '@/v2/ui/primitives';
import { buildLinkPatch, canLinkGameDay, gameDayLinks } from '@/modules/games/domain/gameDayLink';
import { useGameDayLinkOptions } from '@/modules/games/hooks/useGameDayLink';
import { t } from '@/core/i18n';

/**
 * @param {{ gameDay: object, gravar: (patch: object, ok?: string) => Promise<boolean>, pending?: boolean }} props
 */
export default function GameDayLinkSection({ gameDay, gravar, pending = false }) {
  const gdId = gameDay?.id;
  const { club, arena } = gameDayLinks(gameDay);
  const { options, isLoading, isError, retry } = useGameDayLinkOptions();
  const [clubeId, setClubeId] = useState('');
  const [arenaId, setArenaId] = useState('');
  const [confirmar, setConfirmar] = useState(null);

  // Dia que já pertence a uma arena/clube (ou nasceu de um jogo aberto): não é
  // aqui. Se por algum motivo já tem vínculo gravado, a faixa abaixo o mostra.
  if (!canLinkGameDay(gameDay) && !club && !arena) return null;

  const nomeDe = (lista, id) => lista.find((x) => x.id === id)?.name || '';
  const escolha = {
    club: clubeId ? { id: clubeId, name: nomeDe(options.clubs, clubeId) } : null,
    arena: arenaId ? { id: arenaId, name: nomeDe(options.arenas, arenaId) } : null,
  };
  const disponiveis = {
    clubs: options.clubs.filter((c) => c.id !== club?.id),
    arenas: options.arenas.filter((a) => a.id !== arena?.id),
  };
  const nadaParaVincular = !isLoading && !isError && disponiveis.clubs.length === 0 && disponiveis.arenas.length === 0;

  const aplicar = async (proximo, mensagem) => {
    const ok = await gravar(buildLinkPatch(proximo), mensagem);
    if (ok) { setClubeId(''); setArenaId(''); }
    return ok;
  };

  const desvincular = (lado) => aplicar(
    { club: lado === 'club' ? null : club, arena: lado === 'arena' ? null : arena },
    t('Vínculo desfeito. As partidas deste dia saem das estatísticas dele.'),
  );

  const vincular = () => {
    const proximo = { club: escolha.club || club, arena: escolha.arena || arena };
    setConfirmar(proximo);
  };

  return (
    <section className="space-y-3 border-t border-gray-100 pt-5" data-dica="dia-de-jogo-vinculo">
      <h3 className="text-sm font-semibold text-ink">{t('Clube ou arena')}</h3>
      <p className="text-xs text-gray-500">
        {t('Vincule este dia a um clube que você administra ou a uma arena que você gere, sem sair daqui. As partidas passam a contar nas estatísticas dele; quem não é do clube ou da arena entra como convidado e mantém todas as suas estatísticas.')}
      </p>

      {(club || arena) && (
        <div className="flex flex-wrap gap-2">
          {club && (
            <V2Badge tone="neutral">
              <Users className="mr-1 h-3 w-3" /> {club.name}
              <button type="button"
                className="ml-2 inline-flex items-center text-gray-500 hover:text-red-600"
                title={t('Desvincular do clube')}
                aria-label={t('Desvincular do clube')}
                disabled={pending}
                onClick={() => desvincular('club')}
              >
                <Unlink className="h-3 w-3" />
              </button>
            </V2Badge>
          )}
          {arena && (
            <V2Badge tone="neutral">
              <Building2 className="mr-1 h-3 w-3" /> {arena.name}
              <button type="button"
                className="ml-2 inline-flex items-center text-gray-500 hover:text-red-600"
                title={t('Desvincular da arena')}
                aria-label={t('Desvincular da arena')}
                disabled={pending}
                onClick={() => desvincular('arena')}
              >
                <Unlink className="h-3 w-3" />
              </button>
            </V2Badge>
          )}
        </div>
      )}

      {isError ? (
        <V2ErrorState inline onRetry={retry} title={t('Não deu para carregar seus clubes e arenas.')} />
      ) : isLoading ? (
        <p className="text-xs text-gray-500">{t('Carregando seus clubes e arenas…')}</p>
      ) : nadaParaVincular ? (
        <p className="text-xs text-gray-500">
          {club || arena
            ? t('Você não administra outro clube nem gere outra arena para vincular a este dia.')
            : t('Você não administra nenhum clube nem gere nenhuma arena. Só quem administra o clube ou gere a arena pode vincular um dia a ele.')}
        </p>
      ) : canLinkGameDay(gameDay) && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {disponiveis.clubs.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor={`gds-vc-${gdId}`}>{club ? t('Trocar de clube') : t('Clube')}</Label>
                <V2Select
                  id={`gds-vc-${gdId}`}
                  className="h-10 bg-white px-3"
                  value={clubeId}
                  disabled={pending}
                  onChange={(e) => setClubeId(e.target.value)}
                >
                  <option value="">{t('— escolher —')}</option>
                  {disponiveis.clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </V2Select>
              </div>
            )}
            {disponiveis.arenas.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor={`gds-va-${gdId}`}>{arena ? t('Trocar de arena') : t('Arena')}</Label>
                <V2Select
                  id={`gds-va-${gdId}`}
                  className="h-10 bg-white px-3"
                  value={arenaId}
                  disabled={pending}
                  onChange={(e) => setArenaId(e.target.value)}
                >
                  <option value="">{t('— escolher —')}</option>
                  {disponiveis.arenas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </V2Select>
              </div>
            )}
          </div>
          {(clubeId || arenaId) && (
            <div className="flex justify-end">
              <V2Button size="sm" disabled={pending} onClick={vincular}>
                <Link2 className="mr-1.5 h-4 w-4" /> {t('Vincular')}
              </V2Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmar}
        onOpenChange={(v) => !v && setConfirmar(null)}
        title={t('Vincular este dia de jogo?')}
        description={confirmar
          ? t('As partidas deste dia passam a contar para {destino}. Quem não é do clube ou da arena fica como convidado e mantém todas as estatísticas. O dia fica público — nunca exclusivo de membros — enquanto durar o vínculo.', {
            destino: [confirmar.club?.name, confirmar.arena?.name].filter(Boolean).join(' · '),
          })
          : ''}
        confirmLabel={t('Vincular')}
        onConfirm={() => {
          const proximo = confirmar;
          setConfirmar(null);
          if (proximo) aplicar(proximo, t('Dia vinculado.'));
        }}
      />
    </section>
  );
}
