/**
 * Entrar e sair da liga, do lado do ATLETA: as minhas inscrições (com
 * "Sair da liga") e, com as inscrições abertas, o formulário — divisão,
 * dupla ou companheiros de equipe (pelo seletor de pessoas da plataforma) e
 * nome opcional. A prévia de
 * "cabe na divisão" usa o que está nos perfis; quem decide é o servidor.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, LogOut, UserPlus } from 'lucide-react';
import { t } from '@/core/i18n';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Button, V2Field, V2Input, V2SectionHeader, V2Select, V2Surface } from '@/v2/ui/primitives';
import PersonPicker from '@/v2/components/people/PersonPicker';
import { useLeagueAction } from '@/modules/leagues/hooks/useLeagues';
import { formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { ELIGIBILITY_REASON_LABELS, divisionEligibility, teamCompositionError } from '@/modules/leagues/domain/leagueDivisions';
import { divisionSummary, personUid } from './leagueUi';

const perfilParaJogador = (p) => ({
  dupr: Number(p?.dupr_rating) || null,
  gender: p?.competition_gender || p?.gender || null,
});

export default function LeagueRegister({ league, divisions, entries }) {
  const { user, profile } = useAuth();
  const acao = useLeagueAction();
  const meta = formatMeta(league.format);
  const equipe = meta?.entry === 'team';
  const duplas = !equipe && meta?.players === 2;
  const faltam = equipe ? meta.players - 1 : duplas ? 1 : 0;
  const divs = divisions.data || [];
  const ativos = useMemo(() => (entries.data || []).filter((e) => e.status === 'active'), [entries.data]);
  const minhas = ativos.filter((e) => (e.player_uids || []).includes(user?.uid));
  const [divisionId, setDivisionId] = useState('');
  const [parceiro, setParceiro] = useState([]);
  const [nome, setNome] = useState('');
  const [sair, setSair] = useState(null);

  const div = divs.find((d) => d.id === (divisionId || divs[0]?.id));
  const ocupados = useMemo(() => {
    const m = new Map();
    ativos.filter((e) => e.division_id === div?.id).forEach((e) => (e.player_uids || []).forEach((u) => m.set(u, t('Já está nesta divisão'))));
    return m;
  }, [ativos, div]);
  const jogadores = [perfilParaJogador(profile), ...parceiro.slice(0, faltam).map(perfilParaJogador)];
  const completo = parceiro.length === faltam;
  const elig = div && completo ? divisionEligibility(div, jogadores) : null;
  const montagem = completo ? teamCompositionError(league.format, jogadores) : null;
  const previa = elig && !elig.ok ? elig : (montagem ? { ok: false, reason: montagem } : elig);
  const cheia = div && div.max_entries > 0 && ativos.filter((e) => e.division_id === div.id).length >= div.max_entries;
  const jaNaDivisao = div && minhas.some((e) => e.division_id === div.id);

  async function inscrever() {
    try {
      await acao.mutateAsync({
        action: 'register', leagueId: league.id, divisionId: div.id, name: nome.trim(),
        ...(duplas ? { partnerUid: personUid(parceiro[0]) } : {}),
        ...(equipe ? { teammateUids: parceiro.map(personUid) } : {}),
      });
      toast.success(t('Inscrição feita. Boa temporada!'));
      setParceiro([]); setNome('');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function confirmarSaida(entry) {
    try {
      const r = await acao.mutateAsync({ action: 'withdraw', leagueId: league.id, entryId: entry.id });
      toast.success(r?.kept ? t('Você saiu da liga. Os placares já lançados continuam valendo.') : t('Você saiu da liga.'));
      setSair(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  const nomeDaDivisao = (id) => divs.find((d) => d.id === id)?.name || '';
  const podeSair = !['finished', 'cancelled'].includes(league.status);

  return (
    <div className="space-y-4">
      {minhas.map((e) => (
        <V2Surface key={e.id} variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{t('Você está na divisão {divisao}', { divisao: nomeDaDivisao(e.division_id) })}</p>
            <p className="text-sm text-gray-500">{(e.players || []).map((p) => p.name).join(' · ')}</p>
          </div>
          {podeSair && (sair === e.id ? (
            <div className="flex gap-2">
              <V2Button type="button" size="sm" variant="ghost" onClick={() => setSair(null)}>{t('Ficar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => confirmarSaida(e)} disabled={acao.isPending}>{t('Confirmar saída')}</V2Button>
            </div>
          ) : (
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setSair(e.id)}>
              <LogOut className="h-4 w-4" aria-hidden="true" /> {t('Sair da liga')}
            </V2Button>
          ))}
        </V2Surface>
      ))}

      {league.status === 'open' && league.self_registration !== false && divs.length > 0 && (
        <V2Surface className="space-y-4">
          <V2SectionHeader
            eyebrow={t('Inscrições abertas')}
            title={minhas.length ? t('Entrar em outra divisão') : t('Entrar na liga')}
            description={equipe
              ? t('Escolha a divisão e os {n} companheiros de equipe. Cada um recebe um aviso.', { n: faltam })
              : duplas ? t('Escolha a divisão e a sua dupla. A dupla recebe um aviso.') : t('Escolha a divisão do seu nível.')}
          />
          <V2Field label={t('Divisão')} htmlFor="liga-insc-div">
            <V2Select
              id="liga-insc-div"
              value={div?.id || ''}
              onChange={(e) => setDivisionId(e.target.value)}
              options={divs.map((d) => ({ value: d.id, label: `${d.name} · ${divisionSummary(d)}` }))}
            />
          </V2Field>
          {duplas && (
            <PersonPicker
              id="liga-insc-dupla"
              rotulo={t('Sua dupla')}
              selecionados={parceiro}
              onChange={setParceiro}
              ocultar={[user?.uid]}
              excluir={ocupados}
            />
          )}
          {equipe && (
            <PersonPicker
              id="liga-insc-equipe"
              multiple
              max={faltam}
              rotulo={t('Seus companheiros de equipe')}
              selecionados={parceiro}
              onChange={setParceiro}
              ocultar={[user?.uid]}
              excluir={ocupados}
            />
          )}
          {equipe && meta.composition !== 'any' && (
            <p className="text-xs leading-5 text-gray-500">
              {meta.composition === 'two_two' ? t('A equipe é de 2 homens e 2 mulheres (pela categoria do perfil).') : t('Todos da equipe jogam na mesma categoria (pela categoria do perfil).')}
            </p>
          )}
          <V2Field label={equipe ? t('Nome da equipe') : t('Nome da inscrição')} htmlFor="liga-insc-nome" hint={t('Opcional. Em branco, usamos os primeiros nomes.')}>
            <V2Input id="liga-insc-nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} />
          </V2Field>
          {previa && !previa.ok && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {t(ELIGIBILITY_REASON_LABELS[previa.reason] || '')} {t('Pelo que está nos perfis. A organização pode inscrever por exceção.')}
            </p>
          )}
          {cheia && <p className="text-sm font-semibold text-red-600">{t('Esta divisão está completa.')}</p>}
          {jaNaDivisao && <p className="text-sm text-gray-500">{t('Você já está nesta divisão.')}</p>}
          <V2Button
            type="button"
            onClick={inscrever}
            disabled={acao.isPending || cheia || jaNaDivisao || !completo || (previa && !previa.ok)}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" /> {acao.isPending ? t('Inscrevendo…') : t('Inscrever')}
          </V2Button>
        </V2Surface>
      )}

      {league.status === 'open' && league.self_registration === false && !minhas.length && (
        <p className="rounded-2xl bg-paper p-4 text-sm text-gray-500">{t('Nesta liga quem inscreve é a organização. Fale com ela para entrar.')}</p>
      )}
    </div>
  );
}
