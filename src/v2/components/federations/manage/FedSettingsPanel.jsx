/**
 * Configurações da federação: PLANOS de filiação (quem paga o quê), o PIX que
 * recebe, a PÁGINA pública (campos + cor + logo) e os MÓDULOS internos (as
 * sub-flags da federação; os `planned` aparecem como "em breve" e não ligam).
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Plus, Puzzle } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { savePlan, setPlanActive, setFederationModule, updateFederationGovernance, updateFederationPayment, updateFederationProfile, updateFederationRules } from '@/modules/federations/services/federationService';
import { BOARD_MAX, MINUTES_MAX, validateGovernance, womenQuota, womenQuotaText } from '@/modules/federations/domain/governance';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { formatBrlCents, parseBrlCents } from '@/modules/federations/domain/charges';
import { planPeriodLabel, validatePlanInput } from '@/modules/federations/domain/plans';
import { isFederationPublic, normalizeFederationRules, slugifyName, validateFederationPayment, validateFederationPublicInput } from '@/modules/federations/domain/federation';
import { DOC_KIND, DOC_KIND_LABELS, FED_MODULE_META, PLAN_BILLING, PLAN_BILLING_LABELS, PLAN_PERSON_TYPE, PLAN_PERSON_TYPE_LABELS, PLAN_TIER, PLAN_TIER_LABELS, PLAN_VALIDITY, PLAN_VALIDITY_LABELS } from '@/modules/federations/domain/constants';
import { PIX_KEY_TYPES, PIX_KEY_TYPE_LABELS } from '@/modules/arenas/domain/pix_payment';
import { BRAND_DEFAULT_COLOR } from '@/modules/arenas/domain/whiteLabel';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import FederationPublicFields from '../FederationPublicFields';
import FedPublicationTab from './FedPublication';
import { FedLogo, fedPublicPath, publicHost } from '../federationUi';
import { listIssuerCampaigns, listIssuerCoupons, setPromoCouponActive, updatePromoCampaign } from '@/modules/promo/services/promoService';
import { listSellerListings, setListingStatus } from '@/modules/marketplace/services/marketService';
import { federationIssuer } from '@/v2/components/promo/promoUi';
import { t, tk } from '@/core/i18n';
import { useAvisoNaoSalvo } from './naoSalvo';

const reais = (cents) => (Number(cents) / 100).toFixed(2).replace('.', ',');
const cents = parseBrlCents;

/**
 * O formulário e o que está salvo: com diferença, fechar a aba do navegador
 * ou trocar de aba da Central pergunta antes (`useAvisoNaoSalvo`). O terceiro
 * valor marca como salvo o que foi ENVIADO, depois que o servidor aceitou.
 */
function useRascunho(inicial) {
  const [f, setF] = useState(inicial);
  const [base, setBase] = useState(f);
  useAvisoNaoSalvo(JSON.stringify(f) !== JSON.stringify(base));
  return [f, setF, setBase];
}

/* ---------------------------------------------------------------- planos -- */

const PLANO_VAZIO = { name: '', description: '', benefits: '', person_type: PLAN_PERSON_TYPE.ATHLETE, tier: PLAN_TIER.FEDERATED, billing: PLAN_BILLING.ANNUAL, validity: PLAN_VALIDITY.ROLLING, rollover_mmdd: '12-31', calendar_grace_days: 60, preco: '0,00', age_min: '', age_max: '', discounts: { minor_pct: 0, senior_pct: 0, family_pct: 0, family_from: 2 }, requires_docs: [], auto_approve: false, active: true, sort: 0 };

function PlanoForm({ federationId, plano, onFechar }) {
  const { user } = useAuth();
  const [f, setF] = useRascunho(plano ? { ...PLANO_VAZIO, ...plano, preco: reais(plano.price_cents), age_min: plano.age_min ?? '', age_max: plano.age_max ?? '', discounts: { ...PLANO_VAZIO.discounts, ...(plano.discounts || {}) } } : PLANO_VAZIO);
  const [erros, setErros] = useState({});
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const setDesc = (patch) => set({ discounts: { ...f.discounts, ...patch } });
  const m = useFederationMutation((input) => savePlan(federationId, input, { uid: user?.uid, planId: plano?.id || null }));
  const enviar = (e) => {
    e.preventDefault();
    const input = { ...f, price_cents: cents(f.preco), age_min: f.age_min === '' ? null : f.age_min, age_max: f.age_max === '' ? null : f.age_max };
    const r = validatePlanInput(input);
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate(input, { onSuccess: () => { toast.success(plano ? t('Plano atualizado.') : t('Plano criado.')); onFechar(); }, onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); } });
  };
  const anualFixo = f.billing === PLAN_BILLING.ANNUAL && f.validity === PLAN_VALIDITY.CALENDAR;
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="federacao-plano-formulario">
      <V2Field label={t('Nome do plano')} htmlFor="pl-nome" error={erros.name} required hint={t('Ex.: Atleta federado 2026, Professor, Cadastro gratuito.')}>
        <V2Input id="pl-nome" maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} />
      </V2Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <V2Field label={t('Para quem')} htmlFor="pl-tipo"><V2Select id="pl-tipo" value={f.person_type} onChange={(e) => set({ person_type: e.target.value })}>{Object.values(PLAN_PERSON_TYPE).map((v) => <option key={v} value={v}>{t(PLAN_PERSON_TYPE_LABELS[v])}</option>)}</V2Select></V2Field>
        <V2Field label={t('Vínculo')} htmlFor="pl-tier" hint={t('Federado pontua no ranking oficial; cadastrado só consta.')}><V2Select id="pl-tier" value={f.tier} onChange={(e) => set({ tier: e.target.value })}>{Object.values(PLAN_TIER).map((v) => <option key={v} value={v}>{t(PLAN_TIER_LABELS[v])}</option>)}</V2Select></V2Field>
        <V2Field label={t('Valor (R$)')} htmlFor="pl-preco" error={erros.price_cents} hint={t('0,00 = gratuito.')} required><V2Input id="pl-preco" inputMode="decimal" value={f.preco} onChange={(e) => set({ preco: e.target.value })} /></V2Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <V2Field label={t('Cobrança')} htmlFor="pl-bill"><V2Select id="pl-bill" value={f.billing} onChange={(e) => set({ billing: e.target.value })}>{Object.values(PLAN_BILLING).map((v) => <option key={v} value={v}>{t(PLAN_BILLING_LABELS[v])}</option>)}</V2Select></V2Field>
        {f.billing === PLAN_BILLING.ANNUAL && (
          <V2Field label={t('Validade')} htmlFor="pl-val"><V2Select id="pl-val" value={f.validity} onChange={(e) => set({ validity: e.target.value })}>{Object.values(PLAN_VALIDITY).map((v) => <option key={v} value={v}>{t(PLAN_VALIDITY_LABELS[v])}</option>)}</V2Select></V2Field>
        )}
        {anualFixo && (
          <V2Field label={t('Vira em (MM-DD)')} htmlFor="pl-virada" error={erros.rollover_mmdd} hint={t('Quem paga até {dias} dias antes já vale para a temporada seguinte.', { dias: f.calendar_grace_days })}><V2Input id="pl-virada" maxLength={5} placeholder="12-31" value={f.rollover_mmdd} onChange={(e) => set({ rollover_mmdd: e.target.value })} /></V2Field>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <V2Field label={t('Idade mínima')} htmlFor="pl-imin"><V2Input id="pl-imin" inputMode="numeric" value={f.age_min} onChange={(e) => set({ age_min: e.target.value })} /></V2Field>
        <V2Field label={t('Idade máxima')} htmlFor="pl-imax" error={erros.age_max}><V2Input id="pl-imax" inputMode="numeric" value={f.age_max} onChange={(e) => set({ age_max: e.target.value })} /></V2Field>
        <V2Field label={t('Desconto menor de 18 (%)')} htmlFor="pl-dmenor"><V2Input id="pl-dmenor" inputMode="numeric" value={f.discounts.minor_pct} onChange={(e) => setDesc({ minor_pct: e.target.value })} /></V2Field>
        <V2Field label={t('Desconto 60+ (%)')} htmlFor="pl-dsenior"><V2Input id="pl-dsenior" inputMode="numeric" value={f.discounts.senior_pct} onChange={(e) => setDesc({ senior_pct: e.target.value })} /></V2Field>
      </div>
      <V2Field label={t('Descrição')} htmlFor="pl-desc"><V2Textarea id="pl-desc" rows={2} maxLength={600} value={f.description} onChange={(e) => set({ description: e.target.value })} /></V2Field>
      <V2Field label={t('Benefícios (um por linha)')} htmlFor="pl-benef"><V2Textarea id="pl-benef" rows={3} maxLength={1200} value={f.benefits} onChange={(e) => set({ benefits: e.target.value })} /></V2Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">{t('Documentos exigidos')}</legend>
        <p className="text-xs text-gray-500">{t('A pessoa envia pela página da federação e a secretaria confere em Filiados → Documentos. Nada trava a filiação sozinho: é a secretaria que decide.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.values(DOC_KIND).map((k) => (
            <V2Toggle key={k} id={`pl-doc-${k}`} label={t(DOC_KIND_LABELS[k])} checked={(f.requires_docs || []).includes(k)} onChange={(v) => set({ requires_docs: v ? [...(f.requires_docs || []), k] : (f.requires_docs || []).filter((x) => x !== k) })} />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Toggle id="pl-auto" checked={f.auto_approve} onChange={(v) => set({ auto_approve: v })} label={t('Aprovar na hora')} hint={t('Sem fila: pedido aprovado e cobrança gerada no ato.')} />
        <V2Toggle id="pl-ativo" checked={f.active !== false} onChange={(v) => set({ active: v })} label={t('Plano disponível')} hint={t('Desligado, não aparece para quem vai se filiar; quem já tem continua.')} />
      </div>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" disabled={m.isPending} data-dica="federacao-plano-salvar">{plano ? t('Salvar plano') : t('Criar plano')}</V2Button>
      </div>
    </form>
  );
}

function PlanosTab({ federation, plansQ }) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(null); // null | 'novo' | plan
  const ativar = useFederationMutation(({ id, active }) => setPlanActive(id, active, { uid: user?.uid }));
  if (plansQ.isError) return <V2ErrorState title={t('Não carregaram os planos')} onRetry={() => plansQ.refetch()} />;
  if (plansQ.isLoading) return <V2Skeleton lines={4} />;
  const planos = [...(plansQ.data || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.price_cents ?? 0) - (b.price_cents ?? 0));
  return (
    <section className="space-y-4" aria-label={t('Planos de filiação')} data-dica="federacao-planos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-xl font-bold text-ink">{t('Planos de filiação')}</h2><p className="text-sm text-gray-500">{t('Mensalidade ou anuidade, por tipo de pessoa. Sem plano ativo ninguém consegue se filiar.')}</p></div>
        {editando == null && <V2Button type="button" size="sm" onClick={() => setEditando('novo')} data-dica="federacao-plano-novo"><Plus className="h-4 w-4" />{t('Novo plano')}</V2Button>}
      </div>
      {editando != null && <V2Surface><PlanoForm federationId={federation.id} plano={editando === 'novo' ? null : editando} onFechar={() => setEditando(null)} /></V2Surface>}
      {!planos.length && editando == null ? <V2EmptyState icon={Plus} title={t('Nenhum plano ainda')} description={t('Crie ao menos um: por exemplo "Atleta federado", anual, com o valor da anuidade.')} action={<V2Button type="button" onClick={() => setEditando('novo')}>{t('Criar o primeiro plano')}</V2Button>} /> : (
        <ul className="space-y-3">
          {planos.map((p) => (
            <li key={p.id}>
              <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{p.name}{p.active === false && <V2Badge tone="neutral">{t('Desligado')}</V2Badge>}{p.auto_approve && <V2Badge tone="green">{t('Aprova na hora')}</V2Badge>}</p>
                  <p className="text-xs text-gray-500">{t(PLAN_PERSON_TYPE_LABELS[p.person_type] || PLAN_PERSON_TYPE_LABELS.athlete)} · {t(PLAN_TIER_LABELS[p.tier] || PLAN_TIER_LABELS.federated)} · {p.price_cents > 0 ? `${formatBrlCents(p.price_cents)} ${planPeriodLabel(p)}` : planPeriodLabel(p)}{p.age_min != null || p.age_max != null ? ` · ${t('{min} a {max} anos', { min: p.age_min ?? '0', max: p.age_max ?? '∞' })}` : ''}</p>
                </div>
                <V2Toggle id={`pl-on-${p.id}`} checked={p.active !== false} onChange={(v) => ativar.mutate({ id: p.id, active: v }, { onError: (e) => toast.error(e.message) })} label={t('Disponível')} />
                <V2Button type="button" size="sm" variant="ghost" aria-label={t('Editar {nome}', { nome: p.name })} onClick={() => setEditando(p)}><Pencil className="h-4 w-4" /></V2Button>
              </V2Surface>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- pix -- */

function PixTab({ federation }) {
  const { user } = useAuth();
  const p = federation.payment || {};
  const [f, setF, marcarSalvo] = useRascunho({ pix_key_type: p.pix_key_type || PIX_KEY_TYPES.CNPJ, pix_key: p.pix_key || '', receiver_name: p.receiver_name || '', instructions: p.instructions || '' });
  const [erro, setErro] = useState('');
  const m = useFederationMutation(() => updateFederationPayment(federation.id, f, { uid: user?.uid }));
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErro(''); };
  const enviar = (e) => {
    e.preventDefault();
    const r = validateFederationPayment(f);
    if (!r.valid) { setErro(r.error); return; }
    const enviado = f;
    m.mutate(undefined, { onSuccess: () => { marcarSalvo(enviado); toast.success(t('Pix salvo. As próximas cobranças já saem com ele.')); }, onError: (er) => { setErro(er.message); } });
  };
  return (
    <section className="space-y-4" aria-label={t('Pix da federação')} data-dica="federacao-pix">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Pix para receber')}</h2><p className="text-sm text-gray-500">{t('O filiado paga direto na conta da federação; a plataforma não intermedeia nem cobra taxa. Depois, você confirma o recebimento em Financeiro.')}</p></div>
      <V2Surface>
        <form onSubmit={enviar} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <V2Field label={t('Tipo da chave')} htmlFor="px-tipo"><V2Select id="px-tipo" value={f.pix_key_type} onChange={(e) => set({ pix_key_type: e.target.value })}>{Object.values(PIX_KEY_TYPES).map((v) => <option key={v} value={v}>{t(PIX_KEY_TYPE_LABELS[v])}</option>)}</V2Select></V2Field>
            <V2Field label={t('Chave Pix')} htmlFor="px-chave" error={erro} required><V2Input id="px-chave" maxLength={120} value={f.pix_key} onChange={(e) => set({ pix_key: e.target.value })} /></V2Field>
          </div>
          <V2Field label={t('Nome de quem recebe')} htmlFor="px-nome" hint={t('Como aparece no banco: a pessoa confere antes de pagar.')} required><V2Input id="px-nome" maxLength={80} value={f.receiver_name} onChange={(e) => set({ receiver_name: e.target.value })} /></V2Field>
          <V2Field label={t('Instruções (opcional)')} htmlFor="px-instr" hint={t('Aparecem junto do QR: por exemplo, "mande o comprovante no WhatsApp".')}><V2Textarea id="px-instr" rows={2} maxLength={300} value={f.instructions} onChange={(e) => set({ instructions: e.target.value })} /></V2Field>
          <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending} data-dica="federacao-pix-salvar">{t('Salvar Pix')}</V2Button></div>
        </form>
      </V2Surface>
    </section>
  );
}

/* ---------------------------------------------------------------- página -- */

function PaginaTab({ federation }) {
  const { user } = useAuth();
  const [f, setF, marcarSalvo] = useRascunho({ name: federation.name || '', acronym: federation.acronym || '', slug: federation.slug || '', level: federation.level, state: federation.state || '', city: federation.city || '', about: federation.about || '', site: federation.site || '', instagram: federation.instagram || '', contact_email: federation.contact_public?.email || '', contact_phone: federation.contact_public?.phone || '', color: federation.branding?.color || BRAND_DEFAULT_COLOR, logo_url: federation.branding?.logo_url || '' });
  const [erros, setErros] = useState({});
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const setNome = (name) => set({ name, ...(f.slug ? {} : { slug: slugifyName(name) }) });
  const m = useFederationMutation(() => updateFederationProfile(federation.id, { ...f, branding: { color: f.color, logo_url: f.logo_url } }, { uid: user?.uid }));
  const enviar = (e) => {
    e.preventDefault();
    const r = validateFederationPublicInput(f);
    if (!r.ok) { setErros(r.errors); return; }
    const enviado = f;
    m.mutate(undefined, { onSuccess: () => { marcarSalvo(enviado); toast.success(t('Página atualizada.')); }, onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); } });
  };
  const previa = { ...federation, name: f.name, acronym: f.acronym, branding: { color: f.color, logo_url: f.logo_url } };
  return (
    <section className="space-y-4" aria-label={t('Página pública')} data-dica="federacao-pagina">
      <div>
        <div><h2 className="font-display text-xl font-bold text-ink">{t('Conteúdo da página pública')}</h2><p className="text-sm text-gray-500">{t('Nome, apresentação, contato e marca: o que qualquer pessoa vê em {url}.', { url: `${publicHost()}${fedPublicPath(federation)}` })}</p></div>
      </div>
      <form onSubmit={enviar} noValidate className="space-y-6">
        <FederationPublicFields f={f} set={set} setNome={setNome} erros={erros} />
        <V2Surface className="space-y-4">
          <h3 className="font-display text-lg font-bold text-ink">{t('Marca')}</h3>
          <div className="flex flex-wrap items-center gap-4">
            <FedLogo federation={previa} size="lg" />
            <div className="grid flex-1 gap-4 sm:grid-cols-[8rem_1fr]">
              <V2Field label={t('Cor')} htmlFor="br-cor"><input id="br-cor" type="color" value={f.color} onChange={(e) => set({ color: e.target.value })} className="h-11 w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-1" /></V2Field>
              <V2Field label={t('Logo (URL da imagem)')} htmlFor="br-logo" hint={t('Quadrada, fundo transparente. Sem logo, a sigla sai sobre a cor.')}><V2Input id="br-logo" type="url" maxLength={500} placeholder="https://" value={f.logo_url} onChange={(e) => set({ logo_url: e.target.value })} /></V2Field>
            </div>
          </div>
        </V2Surface>
        <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending} data-dica="federacao-pagina-salvar">{t('Salvar página')}</V2Button></div>
      </form>
    </section>
  );
}

/* --------------------------------------------------------------- módulos -- */

/**
 * Um módulo: o interruptor mostra o estado na hora do toque (otimista) e
 * volta se o servidor recusar; ligado, diz onde aparece e leva até lá.
 */
/** O que desligar faz com o que está no ar (o aviso antes de confirmar). */
const AO_DESLIGAR = {
  promos: tk('Os cupons e os banners da federação que estão valendo serão pausados (nada é apagado; dá para reativar depois de religar).'),
  store: tk('Os anúncios da loja oficial serão pausados. Conclua antes os pedidos em andamento: sem o módulo, a loja sai do painel do Mercado.'),
  discipline: tk('Não dá mais para aplicar sanção nem receber manifestação na ouvidoria. As sanções em vigor seguem valendo, e os recursos continuam na Central.'),
  tournaments: tk('Não chegam mais pedidos de chancela. Os torneios já chancelados mantêm o selo, e os pedidos em aberto continuam na Central para você decidir.'),
};

/**
 * Antes de desligar, pausa o que ainda está no ar e que a equipe deixaria de
 * alcançar: sem o módulo, a regra tira dela o poder de mexer em cupom,
 * banner e anúncio — e eles ficariam valendo sem dono.
 */
async function pausarAntesDeDesligar(federation, id, user) {
  if (id === 'promos') {
    const issuer = federationIssuer(federation);
    const [cupons, campanhas] = await Promise.all([listIssuerCoupons(issuer), listIssuerCampaigns(issuer)]);
    await Promise.all([
      ...cupons.filter((c) => c.active !== false).map((c) => setPromoCouponActive(issuer, c.id, false, user)),
      ...campanhas.filter((c) => c.banner_active === true).map((c) => updatePromoCampaign(c.id, { banner_active: false }, user)),
    ]);
  }
  if (id === 'store') {
    const anuncios = await listSellerListings(`federation_${federation.id}`);
    await Promise.all(anuncios.filter((l) => l.status === 'active' || l.status === 'sold_out').map((l) => setListingStatus(l, 'paused')));
  }
}

function ModuloCard({ federation, id, meta }) {
  const { user } = useAuth();
  const ligado = federation.modules?.[id] === true;
  const [pendente, setPendente] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const m = useFederationMutation(async (on) => {
    if (!on) await pausarAntesDeDesligar(federation, id, user);
    return setFederationModule(federation.id, id, on, { uid: user?.uid });
  });
  useEffect(() => { if (pendente !== null && ligado === pendente) setPendente(null); }, [ligado, pendente]);
  const disponivel = meta.status === 'available';
  const on = pendente ?? ligado;
  const depende = meta.requires && federation.modules?.[meta.requires] !== true ? FED_MODULE_META[meta.requires] : null;
  const aplicar = (v) => {
    setConfirmar(false);
    setPendente(v);
    m.mutate(v, {
      onSuccess: () => toast.success(v ? t('{modulo} ligado.', { modulo: t(meta.label) }) : t('{modulo} desligado.', { modulo: t(meta.label) })),
      onError: (e) => { setPendente(null); toast.error(e.message); },
    });
  };
  const mudar = (v) => (v ? aplicar(true) : setConfirmar(true));
  return (
    <li>
      <V2Surface variant="compacto" className={`flex h-full flex-col gap-3 p-4 ${on ? 'ring-2 ring-acid' : ''}`}>
        <div className="flex items-start gap-3">
          <Puzzle className={`mt-0.5 h-5 w-5 shrink-0 ${on ? 'text-ink' : 'text-gray-500'}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
              {t(meta.label)}
              {!disponivel ? <V2Badge tone="neutral">{t('Em breve')}</V2Badge> : <V2Badge tone={on ? 'green' : 'neutral'}>{on ? t('Ligado') : t('Desligado')}</V2Badge>}
            </p>
            <p className="text-sm text-gray-500">{t(meta.description)}</p>
          </div>
          {disponivel && <V2Toggle id={`mod-${id}`} checked={on} disabled={m.isPending} onChange={mudar} ariaLabel={on ? t('Desligar {modulo}', { modulo: t(meta.label) }) : t('Ligar {modulo}', { modulo: t(meta.label) })} />}
        </div>
        {disponivel && meta.central && (
          <dl className="space-y-0.5 border-t border-gray-100 pt-2 text-xs text-gray-500">
            <div className="flex gap-1"><dt className="font-semibold">{t('Na Central:')}</dt><dd>{t(meta.central)}</dd></div>
            <div className="flex gap-1"><dt className="font-semibold">{t('Na página:')}</dt><dd>{t(meta.page)}</dd></div>
          </dl>
        )}
        {on && depende && <p className="text-xs text-amber-700">{t('Depende de "{outro}": sem ele, nenhum resultado chega.', { outro: t(depende.label) })}</p>}
        {confirmar && (
          <div className="space-y-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            <p>{t('Desligar {modulo}? Some da Central e da página pública na hora.', { modulo: t(meta.label) })} {AO_DESLIGAR[id] ? t(AO_DESLIGAR[id]) : t('O que já foi gravado fica guardado e volta quando você religa.')}</p>
            <div className="flex flex-wrap gap-2">
              <V2Button type="button" size="sm" variant="danger" onClick={() => aplicar(false)}>{t('Desligar')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => setConfirmar(false)}>{t('Manter ligado')}</V2Button>
            </div>
          </div>
        )}
        {on && ligado && !confirmar && meta.tab && <Link to={{ search: `?aba=${meta.tab}` }} className="self-start text-sm font-semibold text-ink underline underline-offset-4">{t('Abrir {local}', { local: t(meta.central) })}</Link>}
      </V2Surface>
    </li>
  );
}

function ModulosTab({ federation }) {
  const entradas = Object.entries(FED_MODULE_META);
  const ligados = entradas.filter(([id, meta]) => meta.status === 'available' && federation.modules?.[id] === true).length;
  return (
    <section className="space-y-4" aria-label={t('Módulos da federação')} data-dica="federacao-modulos">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Módulos')}</h2>
        <p className="text-sm text-gray-500">{t('O que a sua federação liga para si. Ligado, o módulo aparece na hora na Central e na página pública; desligado, some dos dois lugares e ninguém consegue usá-lo. O que já foi gravado fica guardado e volta quando você religa.')}</p>
        <p className="mt-1 text-sm font-semibold text-ink">{t('{n} de {total} ligados', { n: ligados, total: entradas.filter(([, meta]) => meta.status === 'available').length })}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {entradas.map(([id, meta]) => <ModuloCard key={id} federation={federation} id={id} meta={meta} />)}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- regras -- */

function RegrasTab({ federation }) {
  const { user } = useAuth();
  const atual = normalizeFederationRules(federation.rules);
  const [f, setF, marcarSalvo] = useRascunho({ ask_cpf: atual.ask_cpf, transfer_cooldown_days: String(atual.transfer_cooldown_days), transfer_release_days: String(atual.transfer_release_days), member_declarations: atual.member_declarations, convocation_min_days: String(atual.convocation_min_days), comments: atual.comments });
  const m = useFederationMutation(() => updateFederationRules(federation.id, f, { uid: user?.uid }));
  return (
    <section className="space-y-4" aria-label={t('Regras da federação')} data-dica="federacao-regras">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Regras')}</h2><p className="text-sm text-gray-500">{t('O que a sua federação pede e como trata transferências. Vale para os pedidos novos.')}</p></div>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const enviado = f; m.mutate(undefined, { onSuccess: () => { marcarSalvo(enviado); toast.success(t('Regras salvas.')); }, onError: (er) => toast.error(er.message) }); }}>
        <V2Surface className="space-y-4">
          <V2Toggle id="rg-cpf" checked={f.ask_cpf} onChange={(v) => setF((x) => ({ ...x, ask_cpf: v }))} label={t('Pedir o CPF na filiação')} hint={t('Fica reservado (só a secretaria, com motivo registrado). Dependente menor não precisa.')} />
          <V2Toggle id="rg-declaracao" checked={f.member_declarations} onChange={(v) => setF((x) => ({ ...x, member_declarations: v }))} label={t('O filiado emite a própria declaração de vínculo')} hint={t('Só com a filiação em dia, com o QR que confere a validade. Desligado, só a secretaria emite (Filiados → Ficha).')} />
          <V2Toggle id="rg-comentarios" checked={f.comments} onChange={(v) => setF((x) => ({ ...x, comments: v }))} label={t('Comentários nos documentos e eventos')} hint={t('Quem tem conta comenta no que pode ler; a equipe do acervo responde e modera. Desligado, ninguém comenta e o que já foi escrito continua à vista.')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Carência entre transferências (dias)')} htmlFor="rg-carencia" hint={t('0 = sem carência.')}><V2Input id="rg-carencia" inputMode="numeric" value={f.transfer_cooldown_days} onChange={(e) => setF((x) => ({ ...x, transfer_cooldown_days: e.target.value }))} /></V2Field>
            <V2Field label={t('Prazo para liberar quem sai (dias)')} htmlFor="rg-prazo" hint={t('Sem resposta no prazo, a transferência para outra federação é liberada sozinha.')}><V2Input id="rg-prazo" inputMode="numeric" value={f.transfer_release_days} onChange={(e) => setF((x) => ({ ...x, transfer_release_days: e.target.value }))} /></V2Field>
            <V2Field label={t('Prazo mínimo de convocação (dias)')} htmlFor="rg-convocacao" hint={t('O que o estatuto pede entre o edital e a reunião. Fora do prazo, a agenda avisa (não bloqueia).')}><V2Input id="rg-convocacao" inputMode="numeric" value={f.convocation_min_days} onChange={(e) => setF((x) => ({ ...x, convocation_min_days: e.target.value }))} /></V2Field>
          </div>
          <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending}>{t('Salvar regras')}</V2Button></div>
        </V2Surface>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------ governança -- */

const vazio = { statute_url: '', bylaws: '', mandate: { start: '', end: '' }, board: [], minutes: [], women_count: '' };

function GovernancaTab({ federation }) {
  const { user } = useAuth();
  const g = federation.governance || {};
  const [f, setF, marcarSalvo] = useRascunho({ ...vazio, ...g, mandate: { ...vazio.mandate, ...(g.mandate || {}) }, board: g.board || [], minutes: g.minutes || [], women_count: g.women_count ?? '' });
  const cota = womenQuota({ board: f.board, women_count: f.women_count === '' ? null : Number(f.women_count) });
  const [erros, setErros] = useState({});
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const setItem = (lista, i, patch) => set({ [lista]: f[lista].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const tira = (lista, i) => set({ [lista]: f[lista].filter((_, j) => j !== i) });
  const m = useFederationMutation(() => updateFederationGovernance(federation.id, f, { uid: user?.uid }));
  const salvar = (e) => {
    e.preventDefault();
    const r = validateGovernance(f);
    if (!r.ok) { setErros(r.errors); return; }
    const enviado = f;
    m.mutate(undefined, { onSuccess: () => { marcarSalvo(enviado); toast.success(t('Governança salva.')); }, onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); } });
  };
  return (
    <section className="space-y-4" aria-label={t('Governança da federação')} data-dica="federacao-governanca">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Transparência')}</h2><p className="text-sm text-gray-500">{t('Estatuto, mandato, diretoria e atas. É público: aparece na página da federação, para o filiado saber quem decide e com que regras.')}</p></div>
      <form onSubmit={salvar} noValidate className="space-y-4">
        <V2Surface className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <V2Field label={t('Estatuto (link https)')} htmlFor="gv-estatuto" error={erros.statute_url} className="sm:col-span-3"><V2Input id="gv-estatuto" type="url" maxLength={500} placeholder="https://" value={f.statute_url} onChange={(e) => set({ statute_url: e.target.value })} /></V2Field>
            <V2Field label={t('Início do mandato')} htmlFor="gv-ini" error={erros['mandate.start']}><V2Input id="gv-ini" type="date" value={f.mandate.start} onChange={(e) => set({ mandate: { ...f.mandate, start: e.target.value } })} /></V2Field>
            <V2Field label={t('Fim do mandato')} htmlFor="gv-fim" error={erros['mandate.end']}><V2Input id="gv-fim" type="date" value={f.mandate.end} onChange={(e) => set({ mandate: { ...f.mandate, end: e.target.value } })} /></V2Field>
          </div>
          <V2Field label={t('Regimento ou nota (opcional)')} htmlFor="gv-regimento" hint={t('Até 4000 caracteres.')}><V2Textarea id="gv-regimento" rows={4} maxLength={4000} value={f.bylaws} onChange={(e) => set({ bylaws: e.target.value })} /></V2Field>
        </V2Surface>
        <V2Surface className="space-y-3">
          <h3 className="font-bold text-ink">{t('Diretoria')}</h3>
          {f.board.map((b, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-12">
              <V2Field label={t('Cargo')} htmlFor={`gv-cargo-${i}`} error={erros[`board.${i}`]} className="sm:col-span-5"><V2Input id={`gv-cargo-${i}`} maxLength={60} value={b.role} onChange={(e) => setItem('board', i, { role: e.target.value })} /></V2Field>
              <V2Field label={t('Nome')} htmlFor={`gv-nome-${i}`} className="sm:col-span-6"><V2Input id={`gv-nome-${i}`} maxLength={80} value={b.name} onChange={(e) => setItem('board', i, { name: e.target.value })} /></V2Field>
              <div className="flex items-end sm:col-span-1"><V2Button type="button" size="sm" variant="ghost" onClick={() => tira('board', i)} aria-label={t('Remover {nome}', { nome: b.name || t('membro') })}>×</V2Button></div>
            </div>
          ))}
          <V2Button type="button" variant="secondary" disabled={f.board.length >= BOARD_MAX} onClick={() => set({ board: [...f.board, { role: '', name: '' }] })}><Plus className="h-4 w-4" />{t('Acrescentar cargo')}</V2Button>
          {f.board.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 pt-3" data-dica="federacao-cota-mulheres">
              <V2Field label={t('Quantas dessas pessoas são mulheres?')} htmlFor="gv-mulheres" error={erros.women_count} hint={t('Só o número, para conferir a cota da lei. Não aparece na página da federação.')}>
                <V2Input id="gv-mulheres" inputMode="numeric" className="w-24" value={f.women_count} onChange={(e) => set({ women_count: e.target.value })} />
              </V2Field>
              <p className={`text-sm ${cota.status === 'ok' ? 'text-green-700' : 'text-amber-800'}`}>{womenQuotaText(cota)}</p>
            </div>
          )}
        </V2Surface>
        <V2Surface className="space-y-3">
          <h3 className="font-bold text-ink">{t('Atas e documentos')}</h3>
          {f.minutes.map((a, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-12">
              <V2Field label={t('Título')} htmlFor={`gv-ata-${i}`} error={erros[`minutes.${i}.title`]} className="sm:col-span-5"><V2Input id={`gv-ata-${i}`} maxLength={120} value={a.title} onChange={(e) => setItem('minutes', i, { title: e.target.value })} /></V2Field>
              <V2Field label={t('Data')} htmlFor={`gv-ata-data-${i}`} error={erros[`minutes.${i}.date`]} className="sm:col-span-2"><V2Input id={`gv-ata-data-${i}`} type="date" value={a.date} onChange={(e) => setItem('minutes', i, { date: e.target.value })} /></V2Field>
              <V2Field label={t('Link (https)')} htmlFor={`gv-ata-url-${i}`} error={erros[`minutes.${i}.url`]} className="sm:col-span-4"><V2Input id={`gv-ata-url-${i}`} type="url" maxLength={500} placeholder="https://" value={a.url} onChange={(e) => setItem('minutes', i, { url: e.target.value })} /></V2Field>
              <div className="flex items-end sm:col-span-1"><V2Button type="button" size="sm" variant="ghost" onClick={() => tira('minutes', i)} aria-label={t('Remover {nome}', { nome: a.title || t('ata') })}>×</V2Button></div>
            </div>
          ))}
          <V2Button type="button" variant="secondary" disabled={f.minutes.length >= MINUTES_MAX} onClick={() => set({ minutes: [...f.minutes, { title: '', date: '', url: '' }] })}><Plus className="h-4 w-4" />{t('Acrescentar ata')}</V2Button>
        </V2Surface>
        <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending}>{t('Salvar governança')}</V2Button></div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------- loja -- */

function LojaTab({ federation }) {
  const chave = `federation_${federation.id}`;
  return (
    <section className="space-y-4" aria-label={t('Loja oficial no Mercado')} data-dica="federacao-loja">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Loja oficial no Mercado')}</h2><p className="text-sm text-gray-500">{t('A federação vende uniforme, material e inscrições pelo Mercado, como vendedora própria: quem tem "admin" ou "financeiro" na equipe opera a loja. O Pix do pedido vai direto para a conta cadastrada na loja.')}</p></div>
      {!isFederationPublic(federation) ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('A loja oficial abre depois que a federação for publicada (Página pública → Publicação): os anúncios aparecem para todo mundo no Mercado.')}</p>
      ) : (
      <V2Surface className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-700">{t('Anúncios, pedidos e a vitrine ficam no painel do vendedor do Mercado, com a federação escolhida em "Vendendo como".')}</p>
        <div className="flex flex-wrap gap-2">
          <V2Button asChild><Link to={`/mercado/vender?como=${chave}`}>{t('Abrir o painel da loja')}</Link></V2Button>
          <V2Button asChild variant="secondary"><Link to={`/mercado/vendedor/${chave}`}><ExternalLink className="h-4 w-4" />{t('Ver a vitrine')}</Link></V2Button>
        </div>
      </V2Surface>
      )}
    </section>
  );
}

export default function FedSettingsPanel({ federation, plansQ, tab }) {
  if (tab === 'publicacao') return <FedPublicationTab federation={federation} plansQ={plansQ} />;
  if (tab === 'governanca') return <GovernancaTab federation={federation} />;
  if (tab === 'loja') return <LojaTab federation={federation} />;
  if (tab === 'regras') return <RegrasTab federation={federation} />;
  if (tab === 'pix') return <PixTab federation={federation} />;
  if (tab === 'pagina') return <PaginaTab federation={federation} />;
  if (tab === 'modulos') return <ModulosTab federation={federation} />;
  return <PlanosTab federation={federation} plansQ={plansQ} />;
}
