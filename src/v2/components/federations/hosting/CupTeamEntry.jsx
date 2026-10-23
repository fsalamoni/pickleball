/**
 * O ELENCO DA COPA na Central da ESTADUAL (`?aba=copa-inscricao`, Bloco 3b):
 * a equipe de competições vê as Copas abertas pela confederação da federação,
 * monta o elenco com os SEUS filiados em dia (por categoria, até o teto de
 * cada uma), manda e acompanha a decisão. Devolvido, ajusta e manda de novo.
 * Quem confere filiação, prazo e vínculo é o servidor.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Send, Trash2, Trophy } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MEMBER_STATUS } from '@/modules/federations/domain/constants';
import { isoDate, membershipState } from '@/modules/federations/domain/membership';
import { nationalBodyOf } from '@/modules/federations/domain/national';
import {
  CUP_STATUS_LABELS, CUP_TEAM_STATUS as TS, CUP_TEAM_STATUS_LABELS, cupAcceptsTeams, cupTeamTransition, normalizeCupCategories, validateCupTeam,
} from '@/modules/federations/domain/hosting';
import { useFederationMembers } from '@/modules/federations/hooks/useFederations';
import { useCups, useHostingAction, useMyFederationCupTeams } from '@/modules/federations/hooks/useHosting';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { TOM_COPA, TOM_ELENCO, br, periodo } from './hostingUi';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });

function CopaDaRede({ federation, cup, team, ativos }) {
  const cats = normalizeCupCategories(cup.categories);
  const [atletas, setAtletas] = useState(() => (team?.athletes || []).map((a) => ({ member_id: a.member_id, category_id: a.category_id })));
  const [acao, setAcao] = useState(null);
  const m = useHostingAction(federation.id);
  const aberta = cupAcceptsTeams(cup, isoDate());
  const editavel = aberta && !cupTeamTransition(team?.status || null, 'save').error;
  const nome = (id) => ativos.find((x) => x.id === id)?.user_name || team?.athletes?.find((a) => a.member_id === id)?.name || '—';
  const r = validateCupTeam(cup, { athletes: atletas });
  const mudou = JSON.stringify(atletas) !== JSON.stringify((team?.athletes || []).map((a) => ({ member_id: a.member_id, category_id: a.category_id })));
  const salvar = (depois) => m.mutate({ action: 'team_save', cupId: cup.id, athletes: atletas }, ok(t('Elenco salvo.'), depois));
  const executar = () => {
    if (acao === 'enviar') m.mutate({ action: 'team_submit', cupId: cup.id }, ok(t('Elenco enviado. A confederação foi avisada.'), () => setAcao(null)));
    if (acao === 'retirar') m.mutate({ action: 'team_withdraw', cupId: cup.id }, ok(t('Inscrição retirada.'), () => setAcao(null)));
  };
  return (
    <li>
      <V2Surface className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-ink">{cup.title}</p>
            <p className="text-xs text-gray-500">{[periodo(cup.starts_at, cup.ends_at), cup.location, t('inscrições até {data}', { data: br(cup.entries_until) })].filter(Boolean).join(' · ')}</p>
          </div>
          <span className="flex flex-wrap gap-2">
            <V2Badge tone={TOM_COPA[cup.status] || 'neutral'}>{t(CUP_STATUS_LABELS[cup.status] || cup.status)}</V2Badge>
            {team && <V2Badge tone={TOM_ELENCO[team.status] || 'neutral'}>{t(CUP_TEAM_STATUS_LABELS[team.status] || team.status)}</V2Badge>}
          </span>
        </div>
        {team?.decision?.reason && team.status === TS.RETURNED && <p className="text-sm text-red-600">{t('Motivo da devolução: {motivo}', { motivo: team.decision.reason })}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {cats.map((c) => {
            const daCat = atletas.filter((a) => a.category_id === c.id);
            const livres = ativos.filter((x) => !daCat.some((a) => a.member_id === x.id));
            return (
              <div key={c.id} className="space-y-2 rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-ink">{c.label} <span className="font-normal text-gray-500">· {t('{n} de {max}', { n: daCat.length, max: c.roster_max })}</span></p>
                <ul className="space-y-1">
                  {daCat.map((a) => (
                    <li key={a.member_id} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                      {nome(a.member_id)}
                      {editavel && <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Tirar {nome} de {cat}', { nome: nome(a.member_id), cat: c.label })} onClick={() => setAtletas((xs) => xs.filter((x) => !(x.member_id === a.member_id && x.category_id === c.id)))}><Trash2 className="h-4 w-4" /></button>}
                    </li>
                  ))}
                </ul>
                {editavel && daCat.length < c.roster_max && (
                  <V2Field label={t('Acrescentar atleta')} htmlFor={`cp-add-${cup.id}-${c.id}`}>
                    <V2Select
                      id={`cp-add-${cup.id}-${c.id}`}
                      value=""
                      onChange={(e) => { const id = e.target.value; if (id) setAtletas((xs) => [...xs, { member_id: id, category_id: c.id }]); }}
                      options={[{ value: '', label: livres.length ? t('Escolha um filiado em dia') : t('Nenhum filiado em dia disponível') }, ...livres.map((x) => ({ value: x.id, label: x.user_name || x.id }))]}
                    />
                  </V2Field>
                )}
              </div>
            );
          })}
        </div>
        {editavel && !r.ok && atletas.length > 0 && <p className="text-xs text-red-600">{r.errors.athletes}</p>}
        <div className="flex flex-wrap gap-2">
          {editavel && <V2Button type="button" size="sm" variant="secondary" disabled={!r.ok || !mudou || m.isPending} onClick={() => salvar()}>{t('Salvar elenco')}</V2Button>}
          {aberta && team?.status === TS.DRAFT && <V2Button type="button" size="sm" disabled={mudou || m.isPending} onClick={() => setAcao('enviar')}><Send className="h-4 w-4" />{t('Mandar para a confederação')}</V2Button>}
          {team && [TS.DRAFT, TS.SUBMITTED, TS.RETURNED, TS.APPROVED].includes(team.status) && cup.status !== 'cancelled' && <V2Button type="button" size="sm" variant="ghost" onClick={() => setAcao('retirar')}>{t('Retirar a inscrição')}</V2Button>}
        </div>
        {aberta && team?.status === TS.DRAFT && mudou && <p className="text-xs text-gray-500">{t('Salve o elenco antes de mandar.')}</p>}
        {!aberta && !team && <p className="text-sm text-gray-500">{t('As inscrições desta Copa estão fechadas.')}</p>}
        {acao && (
          <ConfirmDialog
            open
            destructive={acao === 'retirar'}
            onOpenChange={(o) => { if (!o) setAcao(null); }}
            loading={m.isPending}
            title={acao === 'enviar' ? t('Mandar o elenco para a confederação?') : t('Retirar a inscrição da federação?')}
            description={acao === 'enviar' ? t('Enviado, o elenco não muda até a confederação decidir. Ela aprova ou devolve com o motivo.') : t('O elenco sai da Copa (e da página, se estava aprovado). Com as inscrições abertas, dá para montar de novo.')}
            confirmLabel={acao === 'enviar' ? t('Mandar') : t('Retirar')}
            cancelLabel={t('Voltar')}
            onConfirm={executar}
          />
        )}
      </V2Surface>
    </li>
  );
}

export default function CupTeamEntry({ federation }) {
  const conf = nationalBodyOf(federation);
  const qc = useCups(conf?.id, { enabled: !!conf });
  const qt = useMyFederationCupTeams(federation.id, { enabled: !!conf });
  const qm = useFederationMembers(federation.id, { enabled: !!conf });
  const ativos = useMemo(() => (qm.data || [])
    .filter((x) => x.user_id && membershipState(x).status === MEMBER_STATUS.ACTIVE)
    .sort((a, b) => String(a.user_name).localeCompare(String(b.user_name), 'pt-BR')), [qm.data]);
  if (!conf) return <V2EmptyState icon={Trophy} title={t('A federação não está ligada a uma confederação')} description={t('A Copa das Federações é aberta pela confederação para as federações da rede dela.')} />;
  const erro = [qc, qt, qm].find((q) => q.isError);
  if (erro) return <V2ErrorState title={t('Não carregou a Copa das Federações')} onRetry={() => erro.refetch()} />;
  if (!qc.isSuccess || !qt.isSuccess || !qm.isSuccess) return <V2Skeleton lines={5} />;
  const copas = (qc.data || []).filter((k) => k.status !== 'cancelled' || (qt.data || []).some((x) => x.cup_id === k.id));
  return (
    <div className="space-y-3" data-dica="federacao-copa-elenco">
      <p className="text-sm text-gray-600">{t('As Copas abertas pela {conf}. Monte o elenco com os filiados em dia e mande para a confederação aprovar.', { conf: conf.acronym || conf.name || t('confederação') })}</p>
      {!copas.length && <V2EmptyState icon={Trophy} title={t('Nenhuma Copa aberta')} description={t('Quando a confederação abrir a próxima, a equipe de competições recebe um aviso.')} />}
      <ul className="space-y-3">
        {copas.map((k) => {
          const team = (qt.data || []).find((x) => x.cup_id === k.id) || null;
          return <CopaDaRede key={`${k.id}-${team?.updated_at_ms || 0}`} federation={federation} cup={k} team={team} ativos={ativos} />;
        })}
      </ul>
    </div>
  );
}
