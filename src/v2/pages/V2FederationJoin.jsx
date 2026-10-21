/**
 * V2FederationJoin — "Filiar-se" (`/federacoes/:id/filiar`).
 *
 * Em três passos na mesma tela: quem você é (atleta, professor, árbitro),
 * o plano (os que cabem na sua idade, com o desconto já aplicado), as
 * escolhas (selo público, diretório, clube que representa) e os termos.
 * O pedido vai ao SERVIDOR (`federationMembership`), que decide: aprovação
 * automática ou pela secretaria; plano pago gera a cobrança Pix, que já
 * aparece aqui para pagar.
 *
 * PR 3: CPF quando a federação pede (`rules.ask_cpf`, vai para `private/data`);
 * de 12 a 17 anos, o responsável declarado + consentimento da foto do menor;
 * menor de 12 só entra como DEPENDENTE (`?dependente=1`: o responsável filia
 * pela própria conta, com nome e nascimento da criança — a filiação é dela,
 * a cobrança e os avisos são do responsável). O plano que exige documentos
 * avisa aqui; o envio é na página da federação, depois do pedido.
 */
import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, IdCard, Landmark, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { calculateAge } from '@/core/lib/profileValidation';
import { useFederation, useFederationMutation, useFederationPlans, useMyFederationCharges, useMyMembership } from '@/modules/federations/hooks/useFederations';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { membershipAction } from '@/modules/federations/services/federationService';
import { canRequestMembership } from '@/modules/federations/domain/membership';
import { isFreePlan, planPeriodLabel, planPrice, plansFor, planBenefitLines } from '@/modules/federations/domain/plans';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { ageGroup, ageOn, federationAsksCpf, requiredDocKinds, validateDependentInput, validatePrivateInput } from '@/modules/federations/domain/privateData';
import { isoDate } from '@/modules/federations/domain/membership';
import { CHARGE_STATUS, DOC_KIND_LABELS, FEDERATION_STATUS, GUARDIAN_ONLY_AGE, MEMBER_STATUS, PLAN_PERSON_TYPE, PLAN_PERSON_TYPE_LABELS, PLAN_TIER_LABELS } from '@/modules/federations/domain/constants';
import {
  V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Page, V2PageIntro, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import { FedLogo, FederationGate, fedPath } from '@/v2/components/federations/federationUi';
import PixChargeBlock from '@/v2/components/federations/PixChargeBlock';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

function Formulario({ federation, plans, dependente = false, onEnviado }) {
  const { userProfile } = useAuth();
  const idadeConta = useMemo(() => calculateAge(userProfile?.birth_date), [userProfile?.birth_date]);
  const clubes = useMyClubs();
  const [tipo, setTipo] = useState(PLAN_PERSON_TYPE.ATHLETE);
  const [planId, setPlanId] = useState('');
  const [opcoes, setOpcoes] = useState({ publicBadge: true, showInDirectory: false, clubId: '', note: '', termos: false });
  const [dep, setDep] = useState({ name: '', birth_date: '' });
  const [privado, setPrivado] = useState({ cpf: '', guardian_name: '', guardian_contact: '', guardian_consent: false, minor_photo_consent: false });
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState('');
  const m = useFederationMutation((payload) => membershipAction(payload));

  const hoje = isoDate();
  const idadeDep = dependente ? ageOn(dep.birth_date, hoje) : null;
  const idade = dependente ? idadeDep : idadeConta;
  const faixa = ageGroup(idade);
  const pedeCpf = federationAsksCpf(federation) && !dependente;
  const menorComConta = !dependente && faixa === 'minor';
  const criancaComConta = !dependente && faixa === 'child';

  const tipos = Object.values(PLAN_PERSON_TYPE).filter((pt) => (plans || []).some((p) => p.active !== false && (p.person_type || PLAN_PERSON_TYPE.ATHLETE) === pt));
  const candidatos = plansFor(plans || [], { personType: tipo, age: idade });
  const plano = candidatos.find((p) => p.id === planId) || null;
  const preco = plano ? planPrice(plano, { age: idade }) : null;
  const docsExigidos = requiredDocKinds(plano);
  const setPriv = (patch) => { setPrivado((x) => ({ ...x, ...patch })); setErros({}); };

  const enviar = (e) => {
    e.preventDefault();
    if (!plano) { setErro(t('Escolha um plano.')); return; }
    if (criancaComConta) { setErro(t('Menor de {n} anos: o responsável filia como dependente, pela conta dele.', { n: GUARDIAN_ONLY_AGE })); return; }
    const extra = {};
    if (dependente) {
      const rd = validateDependentInput(dep, { hoje });
      if (!rd.ok) { setErros(rd.errors); setErro(t('Confira os dados do dependente.')); return; }
      extra.dependent = { name: rd.value.name, birth_date: rd.value.birth_date };
      extra.guardian = { contact: privado.guardian_contact };
      extra.minorPhotoConsent = privado.minor_photo_consent;
    } else {
      const rp = validatePrivateInput(privado, { asksCpf: pedeCpf, isMinor: menorComConta });
      if (!rp.ok) { setErros(rp.errors); setErro(t('Confira os campos destacados.')); return; }
      if (rp.value.cpf) extra.cpf = rp.value.cpf;
      if (menorComConta) { extra.guardian = { ...rp.value.guardian, consent: true }; extra.minorPhotoConsent = privado.minor_photo_consent; }
    }
    if (!opcoes.termos) { setErro(t('Para se filiar é preciso aceitar os termos.')); return; }
    setErro('');
    m.mutate({
      federationId: federation.id, action: 'request', planId: plano.id,
      publicBadge: opcoes.publicBadge, showInDirectory: opcoes.showInDirectory, clubId: opcoes.clubId || null, note: opcoes.note, ...extra,
    }, {
      onSuccess: () => { toast.success(dependente ? t('Pedido de filiação do dependente enviado.') : t('Pedido de filiação enviado.')); window.scrollTo?.(0, 0); onEnviado?.(); },
      onError: (er) => { setErro(er.message); toast.error(er.message); },
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-6" noValidate data-dica="federacao-filiar-formulario">
      {dependente && (
        <V2Surface className="space-y-4" data-dica="federacao-filiar-dependente">
          <h2 className="font-display text-lg font-bold text-ink">{t('Quem é o dependente')}</h2>
          <p className="text-sm text-gray-600">{t('A filiação é da criança ou adolescente; a cobrança, os avisos e a carteirinha ficam com você, o responsável. A federação guarda o nascimento e o seu contato de forma reservada.')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Nome completo')} htmlFor="fj-dep-nome" error={erros.name} required><V2Input id="fj-dep-nome" maxLength={120} value={dep.name} onChange={(e) => { setDep((d) => ({ ...d, name: e.target.value })); setErros({}); }} /></V2Field>
            <V2Field label={t('Data de nascimento')} htmlFor="fj-dep-nasc" error={erros.birth_date} required><V2Input id="fj-dep-nasc" type="date" value={dep.birth_date} onChange={(e) => { setDep((d) => ({ ...d, birth_date: e.target.value })); setPlanId(''); setErros({}); }} /></V2Field>
          </div>
          <V2Field label={t('Seu telefone ou e-mail de contato')} htmlFor="fj-dep-contato" hint={t('Em branco, vale o do seu cadastro.')}><V2Input id="fj-dep-contato" maxLength={160} value={privado.guardian_contact} onChange={(e) => setPriv({ guardian_contact: e.target.value })} /></V2Field>
          <V2Toggle id="fj-dep-foto" checked={privado.minor_photo_consent} onChange={(v) => setPriv({ minor_photo_consent: v })} label={t('Autorizo a foto na verificação pública da carteirinha')} hint={t('Sem autorização, a verificação mostra só nome e situação.')} />
        </V2Surface>
      )}
      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{dependente ? t('1. O dependente se filia como') : t('1. Você se filia como')}</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Tipo de filiação')}>
          {(tipos.length ? tipos : [PLAN_PERSON_TYPE.ATHLETE]).map((pt) => (
            <V2FilterChip key={pt} type="button" role="radio" aria-checked={tipo === pt} active={tipo === pt} onClick={() => { setTipo(pt); setPlanId(''); }}>{t(PLAN_PERSON_TYPE_LABELS[pt])}</V2FilterChip>
          ))}
        </div>
        {idade == null && !dependente && <p className="text-xs text-gray-500">{t('Sem a data de nascimento no seu perfil, os planos por faixa de idade não aparecem. Complete o perfil para vê-los.')}</p>}
        {criancaComConta && <p className="text-sm font-semibold text-amber-700">{t('Menor de {n} anos não se filia pela própria conta: o responsável filia como dependente, pela conta dele.', { n: GUARDIAN_ONLY_AGE })}</p>}
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
                    {planBenefitLines(p).length > 0 && <ul className="mt-2 space-y-1 text-sm text-gray-700">{planBenefitLines(p).map((b) => <li key={b} className="flex gap-2"><span aria-hidden="true">•</span>{b}</li>)}</ul>}
                    {p.auto_approve && <p className="mt-2 text-xs text-gray-500">{t('Aprovação automática')}</p>}
                    {requiredDocKinds(p).length > 0 && <p className="mt-2 text-xs text-gray-500">{t('Exige documentos: {lista}', { lista: requiredDocKinds(p).map((k) => t(DOC_KIND_LABELS[k])).join(', ') })}</p>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </V2Surface>

      {(pedeCpf || menorComConta) && (
        <V2Surface className="space-y-4" data-dica="federacao-filiar-dados">
          <h2 className="font-display text-lg font-bold text-ink">{t('Dados reservados')}</h2>
          <p className="text-sm text-gray-600">{t('Só a secretaria da federação lê, com motivo registrado. Nada disso aparece na carteirinha nem no perfil.')}</p>
          {pedeCpf && <V2Field label={t('CPF')} htmlFor="fj-cpf" error={erros.cpf} required hint={t('Esta federação pede o CPF para a filiação.')}><V2Input id="fj-cpf" inputMode="numeric" maxLength={14} value={privado.cpf} onChange={(e) => setPriv({ cpf: e.target.value })} className="sm:max-w-xs" /></V2Field>}
          {menorComConta && (
            <>
              <p className="text-sm font-semibold text-ink">{t('Você tem menos de 18 anos: a federação precisa saber quem responde por você.')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <V2Field label={t('Nome do responsável')} htmlFor="fj-resp-nome" error={erros.guardian_name} required><V2Input id="fj-resp-nome" maxLength={120} value={privado.guardian_name} onChange={(e) => setPriv({ guardian_name: e.target.value })} /></V2Field>
                <V2Field label={t('Telefone ou e-mail do responsável')} htmlFor="fj-resp-contato" error={erros.guardian_contact} required><V2Input id="fj-resp-contato" maxLength={160} value={privado.guardian_contact} onChange={(e) => setPriv({ guardian_contact: e.target.value })} /></V2Field>
              </div>
              <V2Toggle id="fj-resp-ciente" checked={privado.guardian_consent} onChange={(v) => setPriv({ guardian_consent: v })} label={t('Meu responsável está ciente desta filiação')} />
              {erros.guardian_consent && <p className="text-sm font-medium text-red-500">{erros.guardian_consent}</p>}
              <V2Toggle id="fj-foto-menor" checked={privado.minor_photo_consent} onChange={(v) => setPriv({ minor_photo_consent: v })} label={t('O responsável autoriza a foto na verificação pública da carteirinha')} hint={t('Sem autorização, a verificação mostra só nome e situação.')} />
            </>
          )}
        </V2Surface>
      )}

      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{dependente ? t('3. Escolhas do dependente') : t('3. Suas escolhas')}</h2>
        <V2Toggle id="fj-selo" checked={opcoes.publicBadge} onChange={(v) => setOpcoes((o) => ({ ...o, publicBadge: v }))} label={t('Mostrar o selo de federado no meu perfil')} hint={t('Aparece no perfil público e nas inscrições em torneio.')} />
        <V2Toggle id="fj-dir" checked={opcoes.showInDirectory} onChange={(v) => setOpcoes((o) => ({ ...o, showInDirectory: v }))} label={t('Aparecer no diretório de filiados da federação')} hint={t('Nome e foto, para outros filiados.')} />
        {docsExigidos.length > 0 && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('Este plano exige: {lista}. Depois de pedir, envie os arquivos pela página da federação (PDF ou imagem, até 5 MB).', { lista: docsExigidos.map((k) => t(DOC_KIND_LABELS[k])).join(', ') })}</p>}
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
        <V2Button type="submit" disabled={m.isPending || !plano || criancaComConta} data-dica="federacao-filiar-enviar">{m.isPending ? t('Enviando…') : plano && !isFreePlan(plano) ? t('Pedir filiação e gerar o Pix') : t('Pedir filiação')}</V2Button>
      </div>
    </form>
  );
}

function Pagina() {
  const { federationId } = useParams();
  const [params, setParams] = useSearchParams();
  const dependente = params.get('dependente') === '1';
  const fq = useFederation(federationId);
  const pq = useFederationPlans(federationId);
  const mq = useMyMembership(federationId);
  const cq = useMyFederationCharges();
  const f = fq.data;

  let corpo;
  if (fq.isError || pq.isError || mq.isError || cq.isError) corpo = <V2ErrorState onRetry={() => [fq, pq, mq, cq].filter((q) => q.isError).forEach((q) => q.refetch())} />;
  else if (fq.isLoading || pq.isLoading || mq.isLoading || cq.isLoading) corpo = <V2Skeleton className="h-96" />;
  else if (!f) corpo = <V2EmptyState icon={Landmark} title={t('Federação não encontrada')} action={<V2Button asChild variant="secondary"><Link to="/federacoes">{t('Ver as federações')}</Link></V2Button>} />;
  else if (f.status !== FEDERATION_STATUS.APPROVED || f.published !== true) corpo = <V2Surface><p className="text-gray-600">{f.status === FEDERATION_STATUS.APPROVED ? t('A filiação abre quando a federação for publicada pelo admin dela.') : t('Esta federação não está recebendo filiações no momento.')}</p></V2Surface>;
  else if (dependente) corpo = <Formulario federation={f} plans={pq.data} dependente onEnviado={() => setParams({}, { replace: true })} />;
  else if (!canRequestMembership(mq.data)) {
    const abertas = (cq.data || []).filter((c) => c.federation_id === f.id && [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status));
    corpo = (
      <V2Surface className="space-y-4">
        <div className="flex items-start gap-3">
          <IdCard className="h-6 w-6 shrink-0 text-ink" />
          <div>
            <h2 className="font-display text-xl font-bold text-ink">{abertas.length ? t('Falta só o pagamento') : mq.data.status === MEMBER_STATUS.PENDING ? t('Pedido enviado') : t('Você já tem uma filiação aqui')}</h2>
            <p className="mt-1 text-sm text-gray-600">{abertas.length ? t('Pague por Pix e informe. O financeiro da federação confirma e libera a carteirinha.') : mq.data.status === MEMBER_STATUS.PENDING ? t('A secretaria da federação analisa e avisa pelo sino.') : t('Acompanhe a situação, renove e abra a carteirinha na página da federação.')}</p>
          </div>
        </div>
        {abertas.map((c) => <PixChargeBlock key={c.id} charge={c} federation={f} />)}
        <div className="flex flex-wrap gap-2">
          <V2Button asChild variant="secondary"><Link to={fedPath(f)}>{t('Voltar à federação')}</Link></V2Button>
          <V2Button asChild variant="ghost"><Link to={`/federacoes/${f.id}/filiar?dependente=1`}><Users className="h-4 w-4" />{t('Filiar um dependente')}</Link></V2Button>
        </div>
      </V2Surface>
    );
  } else corpo = <Formulario federation={f} plans={pq.data} />;

  return (
    <V2Page className="space-y-6">
      <V2BackLink to={f ? fedPath(f) : '/federacoes'}>{f?.name || t('Federações')}</V2BackLink>
      <div className="flex items-start gap-4">
        {f && <FedLogo federation={f} size="lg" />}
        <V2PageIntro className="mb-0" title={dependente ? t('Filiar um dependente') : t('Filiar-se')} subtitle={f ? t('à {nome}', { nome: f.name }) : ''} />
      </div>
      {corpo}
    </V2Page>
  );
}

export default function V2FederationJoin() {
  return <FederationGate><Pagina /></FederationGate>;
}
