/**
 * V2FederationJoin — "Filiar-se" (`/federacoes/:id/filiar`).
 *
 * Em três passos na mesma tela: quem você é (atleta, professor, árbitro),
 * o plano (os que cabem na sua idade, com o desconto já aplicado), as
 * escolhas (selo público, diretório, clube que representa) e os termos.
 * O pedido vai ao SERVIDOR (`federationMembership`), que decide: aprovação
 * automática ou pela secretaria; plano pago gera a cobrança Pix, que já
 * aparece aqui para pagar.
 */
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, IdCard, Landmark } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { calculateAge } from '@/core/lib/profileValidation';
import { useFederation, useFederationMutation, useFederationPlans, useMyFederationCharges, useMyMembership } from '@/modules/federations/hooks/useFederations';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { membershipAction } from '@/modules/federations/services/federationService';
import { canRequestMembership } from '@/modules/federations/domain/membership';
import { isFreePlan, planPeriodLabel, planPrice, plansFor } from '@/modules/federations/domain/plans';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { CHARGE_STATUS, FEDERATION_STATUS, PLAN_PERSON_TYPE, PLAN_PERSON_TYPE_LABELS, PLAN_TIER_LABELS } from '@/modules/federations/domain/constants';
import {
  V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Page, V2PageIntro, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import { FedLogo, FederationGate, fedPath } from '@/v2/components/federations/federationUi';
import PixChargeBlock from '@/v2/components/federations/PixChargeBlock';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

function Formulario({ federation, plans }) {
  const { user, userProfile } = useAuth();
  const idade = useMemo(() => calculateAge(userProfile?.birth_date), [userProfile?.birth_date]);
  const clubes = useMyClubs();
  const [tipo, setTipo] = useState(PLAN_PERSON_TYPE.ATHLETE);
  const [planId, setPlanId] = useState('');
  const [opcoes, setOpcoes] = useState({ publicBadge: true, showInDirectory: false, clubId: '', note: '', termos: false });
  const [erro, setErro] = useState('');
  const m = useFederationMutation((payload) => membershipAction(payload));

  const tipos = Object.values(PLAN_PERSON_TYPE).filter((pt) => (plans || []).some((p) => p.active !== false && (p.person_type || PLAN_PERSON_TYPE.ATHLETE) === pt));
  const candidatos = plansFor(plans || [], { personType: tipo, age: idade });
  const plano = candidatos.find((p) => p.id === planId) || null;
  const preco = plano ? planPrice(plano, { age: idade }) : null;

  const enviar = (e) => {
    e.preventDefault();
    if (!plano) { setErro(t('Escolha um plano.')); return; }
    if (!opcoes.termos) { setErro(t('Para se filiar é preciso aceitar os termos.')); return; }
    setErro('');
    m.mutate({
      federationId: federation.id, action: 'request', planId: plano.id,
      publicBadge: opcoes.publicBadge, showInDirectory: opcoes.showInDirectory, clubId: opcoes.clubId || null, note: opcoes.note,
    }, {
      onSuccess: () => { toast.success(t('Pedido de filiação enviado.')); window.scrollTo?.(0, 0); },
      onError: (er) => { setErro(er.message); toast.error(er.message); },
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-6" noValidate data-dica="federacao-filiar-formulario">
      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('1. Você se filia como')}</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Tipo de filiação')}>
          {(tipos.length ? tipos : [PLAN_PERSON_TYPE.ATHLETE]).map((pt) => (
            <V2FilterChip key={pt} type="button" role="radio" aria-checked={tipo === pt} active={tipo === pt} onClick={() => { setTipo(pt); setPlanId(''); }}>{t(PLAN_PERSON_TYPE_LABELS[pt])}</V2FilterChip>
          ))}
        </div>
        {idade == null && <p className="text-xs text-gray-500">{t('Sem a data de nascimento no seu perfil, os planos por faixa de idade não aparecem. Complete o perfil para vê-los.')}</p>}
      </V2Surface>

      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('2. O plano')}</h2>
        {candidatos.length === 0 ? (
          <p className="text-sm text-gray-600">{t('A federação não tem plano para este tipo de filiação na sua idade. Fale com a secretaria.')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('Planos')}>
            {candidatos.map((p) => {
              const pr = planPrice(p, { age: idade });
              const ativo = p.id === planId;
              return (
                <li key={p.id}>
                  <button type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => { setPlanId(p.id); setErro(''); }}
                    className={cn('flex h-full w-full flex-col rounded-3xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30', ativo ? 'border-ink bg-paper-pure' : 'border-gray-100 bg-paper-pure hover:border-gray-200')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-lg font-bold text-ink">{p.name}</p>
                        <p className="text-xs uppercase tracking-widest text-gray-500">{t(PLAN_TIER_LABELS[p.tier] || PLAN_TIER_LABELS.federated)}</p>
                      </div>
                      {ativo && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-acid"><Check className="h-4 w-4" aria-hidden="true" /></span>}
                    </div>
                    <p className="mt-2">
                      <span className="font-display text-xl font-bold text-ink">{isFreePlan(p) ? t('Grátis') : formatBrlCents(pr.total)}</span>
                      {!isFreePlan(p) && <span className="ml-1 text-xs text-gray-500">{planPeriodLabel(p)}</span>}
                      {pr.discounts.length > 0 && <span className="ml-2 text-xs font-semibold text-green-700">{pr.discounts[0].label} (−{pr.discounts[0].pct}%)</span>}
                    </p>
                    {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
                    {p.benefits && <ul className="mt-2 space-y-1 text-sm text-gray-700">{p.benefits.split('\n').filter(Boolean).map((b) => <li key={b} className="flex gap-2"><span aria-hidden="true">•</span>{b}</li>)}</ul>}
                    {p.auto_approve && <p className="mt-2 text-xs text-gray-500">{t('Aprovação automática')}</p>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </V2Surface>

      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('3. Suas escolhas')}</h2>
        <V2Toggle id="fj-selo" checked={opcoes.publicBadge} onChange={(v) => setOpcoes((o) => ({ ...o, publicBadge: v }))} label={t('Mostrar o selo de federado no meu perfil')} hint={t('Aparece no perfil público e nas inscrições em torneio.')} />
        <V2Toggle id="fj-dir" checked={opcoes.showInDirectory} onChange={(v) => setOpcoes((o) => ({ ...o, showInDirectory: v }))} label={t('Aparecer no diretório de filiados da federação')} hint={t('Nome e foto, para outros filiados.')} />
        {clubes.isSuccess && (clubes.data || []).length > 0 && (
          <V2Field label={t('Clube que você representa')} htmlFor="fj-clube" hint={t('Opcional. Vale para os torneios por equipes da federação.')}>
            <V2Select id="fj-clube" value={opcoes.clubId} onChange={(e) => setOpcoes((o) => ({ ...o, clubId: e.target.value }))}>
              <option value="">{t('Nenhum')}</option>
              {(clubes.data || []).map((c) => <option key={c.club_id || c.id} value={c.club_id || c.id}>{c.club_name || c.name}</option>)}
            </V2Select>
          </V2Field>
        )}
        <V2Field label={t('Observação para a secretaria')} htmlFor="fj-nota">
          <V2Textarea id="fj-nota" rows={2} maxLength={300} value={opcoes.note} onChange={(e) => setOpcoes((o) => ({ ...o, note: e.target.value }))} />
        </V2Field>
        <label htmlFor="fj-termos" className="flex items-start gap-3 text-sm text-gray-700">
          <input id="fj-termos" type="checkbox" className="mt-1 h-5 w-5 accent-ink" checked={opcoes.termos} onChange={(e) => setOpcoes((o) => ({ ...o, termos: e.target.checked }))} />
          <span>{t('Li e aceito os')} <Link to="/legal/termos-filiacao" className="font-bold text-ink underline">{t('Termos de Filiação')}</Link>{t(' e o estatuto da federação. A federação recebe o meu nome, foto, data de nascimento e cidade para emitir a carteirinha.')}</span>
        </label>
        {erro && <p className="text-sm font-medium text-red-500">{erro}</p>}
      </V2Surface>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-gray-100 bg-paper-pure/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <p className="text-sm text-gray-600">{plano ? (isFreePlan(plano) ? t('Plano gratuito') : t('Total: {valor} {periodo}', { valor: formatBrlCents(preco.total), periodo: planPeriodLabel(plano) })) : t('Escolha um plano')}</p>
        <V2Button type="submit" disabled={m.isPending || !plano} data-dica="federacao-filiar-enviar">{m.isPending ? t('Enviando…') : plano && !isFreePlan(plano) ? t('Pedir filiação e gerar o Pix') : t('Pedir filiação')}</V2Button>
      </div>
    </form>
  );
}

function Pagina() {
  const { federationId } = useParams();
  const fq = useFederation(federationId);
  const pq = useFederationPlans(federationId);
  const mq = useMyMembership(federationId);
  const cq = useMyFederationCharges();
  const f = fq.data;

  let corpo;
  if (fq.isError || pq.isError || mq.isError || cq.isError) corpo = <V2ErrorState onRetry={() => [fq, pq, mq, cq].filter((q) => q.isError).forEach((q) => q.refetch())} />;
  else if (fq.isLoading || pq.isLoading || mq.isLoading || cq.isLoading) corpo = <V2Skeleton className="h-96" />;
  else if (!f) corpo = <V2EmptyState icon={Landmark} title={t('Federação não encontrada')} action={<V2Button asChild variant="secondary"><Link to="/federacoes">{t('Ver as federações')}</Link></V2Button>} />;
  else if (f.status !== FEDERATION_STATUS.APPROVED) corpo = <V2Surface><p className="text-gray-600">{t('Esta federação não está recebendo filiações no momento.')}</p></V2Surface>;
  else if (!canRequestMembership(mq.data)) {
    const abertas = (cq.data || []).filter((c) => c.federation_id === f.id && [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status));
    corpo = (
      <V2Surface className="space-y-4">
        <div className="flex items-start gap-3">
          <IdCard className="h-6 w-6 shrink-0 text-ink" />
          <div>
            <h2 className="font-display text-xl font-bold text-ink">{abertas.length ? t('Falta só o pagamento') : mq.data.status === 'pending' ? t('Pedido enviado') : t('Você já tem uma filiação aqui')}</h2>
            <p className="mt-1 text-sm text-gray-600">{abertas.length ? t('Pague por Pix e informe. O financeiro da federação confirma e libera a carteirinha.') : mq.data.status === 'pending' ? t('A secretaria da federação analisa e avisa pelo sino.') : t('Acompanhe a situação, renove e abra a carteirinha na página da federação.')}</p>
          </div>
        </div>
        {abertas.map((c) => <PixChargeBlock key={c.id} charge={c} federation={f} />)}
        <V2Button asChild variant="secondary"><Link to={fedPath(f)}>{t('Voltar à federação')}</Link></V2Button>
      </V2Surface>
    );
  } else corpo = <Formulario federation={f} plans={pq.data} />;

  return (
    <V2Page className="space-y-6">
      <V2BackLink to={f ? fedPath(f) : '/federacoes'}>{f?.name || t('Federações')}</V2BackLink>
      <div className="flex items-start gap-4">
        {f && <FedLogo federation={f} size="lg" />}
        <V2PageIntro className="mb-0" title={t('Filiar-se')} subtitle={f ? t('à {nome}', { nome: f.name }) : ''} />
      </div>
      {corpo}
    </V2Page>
  );
}

export default function V2FederationJoin() {
  return <FederationGate><Pagina /></FederationGate>;
}
