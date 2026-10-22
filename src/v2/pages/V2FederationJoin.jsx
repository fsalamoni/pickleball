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
 * abre o envio aqui mesmo (os arquivos sobem logo depois do pedido gravado);
 * o que ficar faltando a pessoa envia pela página da federação.
 *
 * Etapa 2: os tipos de filiação vêm do catálogo do admin da plataforma (só
 * os de PESSOA aparecem aqui); `?entidade=club:ID` ou `arena:ID` troca a tela
 * pela filiação da entidade (`OrgMembershipJoin`).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, IdCard, Landmark, MailPlus, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { calculateAge } from '@/core/lib/profileValidation';
import { useFederation, useFederationMutation, useFederationPlans, useMyFederationCharges, useMyFederationInvites, useMyMembership } from '@/modules/federations/hooks/useFederations';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { membershipAction, uploadChosenDocuments } from '@/modules/federations/services/federationService';
import { canRequestMembership } from '@/modules/federations/domain/membership';
import { isFreePlan, planPeriodLabel, planPrice, plansFor, planBenefitLines } from '@/modules/federations/domain/plans';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { ageGroup, ageOn, docLabel, federationAsksCpf, requiredDocs, validateDependentInput, validatePrivateInput } from '@/modules/federations/domain/privateData';
import { personTypeLabel } from '@/modules/federations/domain/memberTypes';
import DocumentsUploadList from '@/v2/components/federations/DocumentsUploadList';
import OrgMembershipJoin from '@/v2/components/federations/OrgMembershipJoin';
import { isoDate } from '@/modules/federations/domain/membership';
import { CHARGE_STATUS, FEDERATION_STATUS, GUARDIAN_ONLY_AGE, MEMBER_STATUS, PLAN_PERSON_TYPE, PLAN_TIER_LABELS, isInvitePending } from '@/modules/federations/domain/constants';
import {
  V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Page, V2PageIntro, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import { FedLogo, FederationGate, fedPath, quando } from '@/v2/components/federations/federationUi';
import PixChargeBlock from '@/v2/components/federations/PixChargeBlock';
import { cn } from '@/core/lib/utils';
import { safeHttpUrl } from '@/core/domain/externalUrl';
import { rolarAte } from '@/v2/ui/rolarAte';
import { t, tn } from '@/core/i18n';

/**
 * Depois do pedido do DEPENDENTE: a confirmação e, quando já nasceu, o Pix
 * dele. Sem isto, quem não é filiado voltava ao próprio formulário, sem saber
 * se o pedido tinha ido nem onde pagar.
 */
function DependenteEnviado({ federation, enviado, cobrancas, onOutro }) {
  const ref = useRef(null);
  useEffect(() => { rolarAte(ref.current); }, []);
  const minhas = cobrancas.filter((c) => c.member_id === enviado.memberId);
  return (
    <V2Surface className="space-y-4" role="status">
      <div ref={ref} className="flex items-start gap-3">
        <Check className="mt-0.5 h-6 w-6 shrink-0 text-green-700" aria-hidden="true" />
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{enviado.nome ? t('Pedido de {nome} enviado', { nome: enviado.nome }) : t('Pedido do dependente enviado')}</h2>
          <p className="mt-1 text-sm text-gray-600">{minhas.length ? t('Pague por Pix e informe. O financeiro da federação confirma e libera a carteirinha, que fica com você.') : t('A secretaria da federação analisa e avisa você pelo sino. Se houver valor a pagar, a cobrança aparece em Minha área → Federações.')}</p>
        </div>
      </div>
      {minhas.map((c) => <PixChargeBlock key={c.id} charge={c} federation={federation} />)}
      <div className="flex flex-wrap gap-2">
        <V2Button asChild variant="secondary"><Link to="/perfil?secao=federacoes">{t('Ver em Minha área')}</Link></V2Button>
        <V2Button type="button" variant="ghost" onClick={onOutro}><Users className="h-4 w-4" />{t('Filiar outro dependente')}</V2Button>
      </div>
    </V2Surface>
  );
}

/** O convite da secretaria, em cima do formulário: o plano já vem escolhido. */
function ConviteAviso({ convite }) {
  const recusar = useFederationMutation(() => membershipAction({ federationId: convite.federation_id, action: 'invite_decline' }));
  return (
    <V2Surface className="flex flex-wrap items-start gap-3 border-acid/60 bg-acid/10" role="note">
      <MailPlus className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {convite.source === 'import' ? (
          <>
            <p className="font-bold text-ink">{t('A federação já tinha você na lista de filiados')}</p>
            <p className="text-sm text-gray-600">{t('Plano {plano}, já escolhido abaixo. Confirmando, a filiação entra ativa, sem cobrança, com o número e a validade da lista. O convite vale até {data}.', { plano: convite.plan_name, data: quando(convite.expires_at_ms) })}</p>
          </>
        ) : (
          <>
            <p className="font-bold text-ink">{t('Você foi convidado(a) pela secretaria')}</p>
            <p className="text-sm text-gray-600">{t('Plano {plano}, já escolhido abaixo. Pedindo neste plano, a filiação entra sem esperar aprovação. O convite vale até {data}.', { plano: convite.plan_name, data: quando(convite.expires_at_ms) })}</p>
          </>
        )}
        {convite.note && <p className="mt-1 text-sm text-gray-700">“{convite.note}”</p>}
      </div>
      <V2Button type="button" size="sm" variant="ghost" disabled={recusar.isPending} onClick={() => recusar.mutate(undefined, { onSuccess: () => toast.success(t('Convite recusado.')), onError: (e) => toast.error(e.message) })}>{t('Recusar o convite')}</V2Button>
    </V2Surface>
  );
}

function Formulario({ federation, plans, dependente = false, onEnviado, convite = null, planoInicial = '' }) {
  const { user, userProfile } = useAuth();
  const [arquivos, setArquivos] = useState({});
  const [enviandoDocs, setEnviandoDocs] = useState(false);
  const idadeConta = useMemo(() => calculateAge(userProfile?.birth_date), [userProfile?.birth_date]);
  const clubes = useMyClubs();
  const planoConvite = convite ? (plans || []).find((p) => p.id === convite.plan_id && p.active !== false) : null;
  // O plano que a pessoa tocou na página da federação (`?plano=`) já vem escolhido; o do convite vence.
  const planoEscolhido = planoConvite || (planoInicial ? (plans || []).find((p) => p.id === planoInicial && p.active !== false) : null);
  const [tipo, setTipo] = useState(planoEscolhido?.person_type || PLAN_PERSON_TYPE.ATHLETE);
  const [planId, setPlanId] = useState(planoEscolhido?.id || '');
  const [opcoes, setOpcoes] = useState({ publicBadge: true, showInDirectory: false, clubId: '', note: '', termos: false });
  const [dep, setDep] = useState({ name: '', birth_date: '' });
  const [privado, setPrivado] = useState({ cpf: '', guardian_name: '', guardian_contact: '', guardian_consent: false, minor_photo_consent: false });
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState('');
  const erroRef = useRef(null);
  const m = useFederationMutation((payload) => membershipAction(payload));
  // A mensagem fica no fim do formulário: ao aparecer, a tela vai até ela (no celular, quem tocou em "Pedir" está lá embaixo, mas o motivo pode estar fora da vista).
  useEffect(() => { if (erro) rolarAte(erroRef.current, { alinhar: 'centro' }); }, [erro]);

  const hoje = isoDate();
  const idadeDep = dependente ? ageOn(dep.birth_date, hoje) : null;
  const idade = dependente ? idadeDep : idadeConta;
  const faixa = ageGroup(idade);
  const pedeCpf = federationAsksCpf(federation) && !dependente;
  const menorComConta = !dependente && faixa === 'minor';
  const criancaComConta = !dependente && faixa === 'child';

  // Os tipos de PESSOA que a federação oferece (os planos ativos dizem quais); clube e arena pedem pela gestão deles.
  const tipos = [];
  (plans || []).filter((p) => p.active !== false && (p.entity || 'person') === 'person').forEach((p) => {
    const id = p.person_type || PLAN_PERSON_TYPE.ATHLETE;
    if (!tipos.some((x) => x.id === id)) tipos.push({ id, label: personTypeLabel(p) });
  });
  const candidatos = plansFor(plans || [], { personType: tipo, age: idade });
  const plano = candidatos.find((p) => p.id === planId) || null;
  const preco = plano ? planPrice(plano, { age: idade }) : null;
  const docsExigidos = requiredDocs(plano);
  // O Pix só nasce na hora com aprovação automática ou convite neste plano; senão, depois que a secretaria aprova.
  const pagaDepois = Boolean(plano && !isFreePlan(plano) && !plano.auto_approve && planoConvite?.id !== plano.id);
  // Convite da importação, neste plano: entra ativo sem cobrança (já era filiado fora da plataforma).
  const semCobranca = Boolean(plano && convite?.source === 'import' && planoConvite?.id === plano.id);
  const estatuto = safeHttpUrl(federation?.governance?.statute_url);
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
      onSuccess: async (r) => {
        toast.success(dependente ? t('Pedido de filiação do dependente enviado.') : semCobranca ? t('Filiação confirmada.') : t('Pedido de filiação enviado.'));
        // Os arquivos sobem com o pedido já gravado; um que falhe não desfaz o pedido — a tela diz qual falta.
        if (r?.memberId && docsExigidos.some((d) => arquivos[d.key])) {
          setEnviandoDocs(true);
          const up = await uploadChosenDocuments({ docs: docsExigidos, arquivos, member: { id: r.memberId, federation_id: federation.id }, uid: user?.uid });
          setEnviandoDocs(false);
          if (up.falhas.length) toast.error(t('Não deu para enviar: {lista}. Envie depois em Minha filiação, na página da federação.', { lista: up.falhas.join(', ') }), { duration: 12000 });
          else toast.success(tn(up.total, 'Documento enviado. A secretaria confere.', '{n} documentos enviados. A secretaria confere.'));
        }
        onEnviado?.({ ...(r || {}), nome: dependente ? dep.name.trim() : '' });
      },
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
          {(tipos.length ? tipos : [{ id: PLAN_PERSON_TYPE.ATHLETE, label: personTypeLabel({}) }]).map((x) => (
            <V2FilterChip key={x.id} type="button" role="radio" aria-checked={tipo === x.id} active={tipo === x.id} onClick={() => { setTipo(x.id); setPlanId(''); }}>{x.label}</V2FilterChip>
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
                    {requiredDocs(p).length > 0 && <p className="mt-2 text-xs text-gray-500">{t('Exige documentos: {lista}', { lista: requiredDocs(p).map(docLabel).join(', ') })}</p>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </V2Surface>

      {docsExigidos.length > 0 && <DocumentsUploadList docs={docsExigidos} arquivos={arquivos} onChange={setArquivos} />}

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
              {erros.guardian_consent && <p className="text-sm font-medium text-red-600">{erros.guardian_consent}</p>}
              <V2Toggle id="fj-foto-menor" checked={privado.minor_photo_consent} onChange={(v) => setPriv({ minor_photo_consent: v })} label={t('O responsável autoriza a foto na verificação pública da carteirinha')} hint={t('Sem autorização, a verificação mostra só nome e situação.')} />
            </>
          )}
        </V2Surface>
      )}

      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{dependente ? t('3. Escolhas do dependente') : t('3. Suas escolhas')}</h2>
        <V2Toggle id="fj-selo" checked={opcoes.publicBadge} onChange={(v) => setOpcoes((o) => ({ ...o, publicBadge: v }))} label={t('Mostrar o selo de filiado no meu perfil')} hint={t('Aparece no perfil público e nas inscrições em torneio.')} />
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
          {/* Termo e estatuto abrem em outra aba: sair daqui desmontaria o formulário já preenchido. */}
          <span>{t('Li e aceito os')} <Link to="/legal/termos-filiacao" target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline">{t('Termos de Filiação')}</Link>{' '}{t('e o')}{' '}{estatuto ? <a href={estatuto} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-ink underline">{t('estatuto da federação')}</a> : t('estatuto da federação')}.{' '}{t('A federação recebe o meu nome, foto, data de nascimento e cidade para emitir a carteirinha.')}</span>
        </label>
        {erro && <p ref={erroRef} role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      </V2Surface>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-paper-pure p-3 shadow-organic-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div>
          <p className="text-sm text-gray-600">{semCobranca ? t('Sem cobrança: você já estava na lista de filiados.') : plano ? (isFreePlan(plano) ? t('Plano gratuito') : t('Total: {valor} {periodo}', { valor: formatBrlCents(preco.total), periodo: planPeriodLabel(plano) })) : t('Escolha um plano')}</p>
          {pagaDepois && <p className="text-xs text-gray-500">{t('Você paga depois que a secretaria aprovar.')}</p>}
        </div>
        <V2Button type="submit" disabled={m.isPending || enviandoDocs || !plano || criancaComConta} data-dica="federacao-filiar-enviar">{enviandoDocs ? t('Enviando os documentos…') : m.isPending ? t('Enviando…') : semCobranca ? t('Confirmar a filiação') : plano && !isFreePlan(plano) && !pagaDepois ? t('Pedir filiação e gerar o Pix') : t('Pedir filiação')}</V2Button>
      </div>
    </form>
  );
}

function Pagina() {
  const { federationId } = useParams();
  const [params] = useSearchParams();
  const dependente = params.get('dependente') === '1';
  // `?entidade=club:ID` ou `arena:ID`: o clube/arena se filia por plano (quem gere a entidade).
  const [orgKind, orgId] = String(params.get('entidade') || '').split(':');
  const entidade = ['club', 'arena'].includes(orgKind) && orgId ? { kind: orgKind, id: orgId } : null;
  const planoInicial = params.get('plano') || '';
  const fq = useFederation(federationId);
  const pq = useFederationPlans(federationId);
  const mq = useMyMembership(federationId);
  const cq = useMyFederationCharges();
  // Convite opcional: se a leitura falhar, a página segue sem o aviso.
  const iq = useMyFederationInvites();
  const f = fq.data;
  const convite = (iq.data || []).find((inv) => inv.federation_id === federationId && isInvitePending(inv)) || null;
  const [depEnviado, setDepEnviado] = useState(null);
  const topoRef = useRef(null);
  // Depois do pedido, o resultado (o Pix ou "pedido enviado") nasce no topo: a tela vai até ele. `window.scrollTo` não serve — quem rola é o <main>.
  const [enviou, setEnviou] = useState(false);
  useEffect(() => { if (enviou && topoRef.current) rolarAte(topoRef.current); }, [enviou, mq.data]);
  const abertasDaFed = (cq.data || []).filter((c) => c.federation_id === federationId && [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status));

  let corpo;
  if (fq.isError || pq.isError || mq.isError || cq.isError) corpo = <V2ErrorState onRetry={() => [fq, pq, mq, cq].filter((q) => q.isError).forEach((q) => q.refetch())} />;
  else if (fq.isLoading || pq.isLoading || mq.isLoading || cq.isLoading) corpo = <V2Skeleton className="h-96" />;
  else if (!f) corpo = <V2EmptyState icon={Landmark} title={t('Federação não encontrada')} action={<V2Button asChild variant="secondary"><Link to="/federacoes">{t('Ver as federações')}</Link></V2Button>} />;
  else if (f.status !== FEDERATION_STATUS.APPROVED || f.published !== true) corpo = <V2Surface><p className="text-gray-600">{f.status === FEDERATION_STATUS.APPROVED ? t('A filiação abre quando a federação for publicada pelo admin dela.') : t('Esta federação não está recebendo filiações no momento.')}</p></V2Surface>;
  else if (entidade) corpo = <OrgMembershipJoin federation={f} plans={pq.data} kind={entidade.kind} orgId={entidade.id} charges={cq.data} />;
  else if (dependente && depEnviado) corpo = <DependenteEnviado federation={f} enviado={depEnviado} cobrancas={abertasDaFed} onOutro={() => setDepEnviado(null)} />;
  else if (dependente) corpo = <Formulario key="dependente" federation={f} plans={pq.data} dependente planoInicial={planoInicial} onEnviado={(r) => setDepEnviado(r)} />;
  else if (!canRequestMembership(mq.data)) {
    // Só as cobranças DESTA filiação (não as do dependente, curso ou multa) decidem o título.
    const abertas = abertasDaFed.filter((c) => !c.member_id || c.member_id === mq.data.id);
    const daFiliacao = abertas.filter((c) => (c.origin || 'membership') === 'membership');
    corpo = (
      <V2Surface className="space-y-4">
        <div ref={topoRef} className="flex items-start gap-3">
          <IdCard className="h-6 w-6 shrink-0 text-ink" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-bold text-ink">{daFiliacao.length ? t('Falta só o pagamento') : mq.data.status === MEMBER_STATUS.PENDING ? t('Pedido enviado') : t('Você já tem uma filiação aqui')}</h2>
            <p className="mt-1 text-sm text-gray-600">{daFiliacao.length ? t('Pague por Pix e informe. O financeiro da federação confirma e libera a carteirinha.') : mq.data.status === MEMBER_STATUS.PENDING ? t('A secretaria da federação analisa e avisa pelo sino.') : t('Acompanhe a situação, renove e abra a carteirinha na página da federação.')}</p>
          </div>
        </div>
        {abertas.map((c) => <PixChargeBlock key={c.id} charge={c} federation={f} />)}
        <div className="flex flex-wrap gap-2">
          <V2Button asChild variant="secondary"><Link to={`${fedPath(f)}?aba=minha`}>{t('Ver minha filiação')}</Link></V2Button>
          <V2Button asChild variant="ghost"><Link to={`/federacoes/${f.id}/filiar?dependente=1`}><Users className="h-4 w-4" />{t('Filiar um dependente')}</Link></V2Button>
        </div>
      </V2Surface>
    );
  } else corpo = (
    <div className="space-y-4">
      {convite && <ConviteAviso convite={convite} />}
      <Formulario key={convite?.id || 'sem-convite'} federation={f} plans={pq.data} convite={convite} planoInicial={planoInicial} onEnviado={() => setEnviou(true)} />
    </div>
  );

  return (
    <V2Page className="space-y-6">
      <V2BackLink to={f ? fedPath(f) : '/federacoes'}>{f?.name || t('Federações')}</V2BackLink>
      <div className="flex items-start gap-4">
        {f && <FedLogo federation={f} size="lg" />}
        <V2PageIntro className="mb-0" title={entidade ? (entidade.kind === 'club' ? t('Filiar o clube') : t('Filiar a arena')) : dependente ? t('Filiar um dependente') : t('Filiar-se')} subtitle={f ? t('à {nome}', { nome: f.name }) : ''} />
      </div>
      {corpo}
    </V2Page>
  );
}

export default function V2FederationJoin() {
  return <FederationGate><Pagina /></FederationGate>;
}
