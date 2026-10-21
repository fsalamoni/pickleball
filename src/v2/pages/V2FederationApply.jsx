/**
 * V2FederationApply — "Abrir uma federação" (`/federacoes/abrir`).
 *
 * Qualquer conta pede; o admin da plataforma analisa (Painel admin →
 * Organizações → Federações) e, aprovada, quem pediu vira presidente. CNPJ
 * completo, razão social e telefone ficam na parte privada (`private/data`);
 * em público só sai o CNPJ pela metade. Recusada, a pessoa lê o motivo,
 * corrige e pede de novo.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, IdCard, ShieldCheck, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { FEDERATION_LEVEL, FEDERATION_STATUS } from '@/modules/federations/domain/constants';
import { slugifyName, validateFederationInput } from '@/modules/federations/domain/federation';
import { applyFederation } from '@/modules/federations/services/federationService';
import { useFederationMutation, useMyCreatedFederations } from '@/modules/federations/hooks/useFederations';
import {
  V2BackLink, V2Button, V2ErrorState, V2Field, V2Input, V2Page, V2PageIntro, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import { rolarAte } from '@/v2/ui/rolarAte';
import { FederationGate, fedManagePath } from '@/v2/components/federations/federationUi';
import FederationPublicFields from '@/v2/components/federations/FederationPublicFields';
import { t, tk } from '@/core/i18n';

const VANTAGENS = [
  { icon: IdCard, title: tk('Carteirinha digital'), text: tk('Cada filiado recebe número, validade e QR de verificação pública.') },
  { icon: Trophy, title: tk('Torneios e ranking próprios'), text: tk('Chancele torneios da plataforma e publique o ranking oficial da federação.') },
  { icon: ShieldCheck, title: tk('Mensalidade ou anuidade por Pix'), text: tk('Planos por tipo de pessoa; o Pix vai direto para a conta da federação.') },
];

function FederationForm({ uid, userName, inicial }) {
  const [f, setF] = useState(inicial);
  const [erros, setErros] = useState({});
  const [slugManual, setSlugManual] = useState(false);
  const m = useFederationMutation(({ input }) => applyFederation(uid, input, { userName }));
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const setNome = (name) => set({ name, ...(slugManual ? {} : { slug: slugifyName(name) }) });
  const enviar = (e) => {
    e.preventDefault();
    const r = validateFederationInput(f);
    if (!r.ok) {
      setErros(r.errors);
      requestAnimationFrame(() => rolarAte(document.querySelector('#form-federacao .text-red-500'), { reservaInferior: 96 }));
      return;
    }
    m.mutate({ input: f }, {
      onSuccess: () => { toast.success(t('Pedido enviado. A equipe do PickleRush avisa assim que analisar.')); window.scrollTo?.(0, 0); },
      onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); },
    });
  };
  return (
    <form id="form-federacao" onSubmit={enviar} className="space-y-6" noValidate data-dica="federacao-formulario">
      <FederationPublicFields f={f} set={set} setNome={setNome} erros={erros} setSlugManual={setSlugManual} />

      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('Dados da entidade')}</h2>
        <p className="text-sm text-gray-500">{t('Só a equipe do PickleRush lê. Em público aparece o CNPJ pela metade.')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <V2Field label={t('CNPJ')} htmlFor="fd-cnpj" error={erros.cnpj} required>
            <V2Input id="fd-cnpj" inputMode="numeric" maxLength={18} value={f.cnpj} onChange={(e) => set({ cnpj: e.target.value })} />
          </V2Field>
          <V2Field label={t('Razão social')} htmlFor="fd-razao" error={erros.legal_name} required>
            <V2Input id="fd-razao" maxLength={160} value={f.legal_name} onChange={(e) => set({ legal_name: e.target.value })} />
          </V2Field>
        </div>
        <V2Field label={t('Observações para a análise')} htmlFor="fd-notas" hint={t('Estatuto, ata de eleição, site da entidade: o que ajudar a equipe a confirmar que a federação existe.')}>
          <V2Textarea id="fd-notas" rows={3} maxLength={1000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </V2Field>
        <label htmlFor="fd-termos" className="flex items-start gap-3 text-sm text-gray-700">
          <input id="fd-termos" type="checkbox" className="mt-1 h-5 w-5 accent-ink" checked={Boolean(f.accept_terms)} onChange={(e) => set({ accept_terms: e.target.checked })} />
          <span>{t('Li e aceito os')} <Link to="/legal/termos-de-uso" className="font-bold text-ink underline">{t('Termos de Uso')}</Link> {t('e os')} <Link to="/legal/termos-federacao" className="font-bold text-ink underline">{t('Termos da Federação')}</Link>{t(', e declaro representar a entidade. A federação responde pelos valores que cobra e pelos dados dos seus filiados.')}</span>
        </label>
        {erros.accept_terms && <p className="text-sm font-medium text-red-500">{erros.accept_terms}</p>}
      </V2Surface>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-100 bg-paper-pure/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <V2Button type="submit" className="w-full sm:w-auto" disabled={m.isPending} data-dica="federacao-enviar">{m.isPending ? t('Enviando…') : t('Enviar para análise')}</V2Button>
      </div>
    </form>
  );
}

function ApplyPage() {
  const { user, userProfile } = useAuth();
  const minhas = useMyCreatedFederations();
  const pendente = (minhas.data || []).find((f) => f.status === FEDERATION_STATUS.PENDING);
  const aprovada = (minhas.data || []).find((f) => f.status === FEDERATION_STATUS.APPROVED);
  const recusada = (minhas.data || []).find((f) => f.status === FEDERATION_STATUS.REJECTED);

  let corpo;
  if (minhas.isError) corpo = <V2ErrorState onRetry={() => minhas.refetch()} />;
  else if (minhas.isLoading) corpo = <V2Skeleton className="h-96" />;
  else if (pendente) {
    corpo = (
      <V2Surface className="flex items-start gap-4">
        <Clock className="h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('{nome} está em análise', { nome: pendente.name })}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('A equipe do PickleRush confere os dados e avisa pelo sino. Aprovada, você vira presidente e abre a Central da federação.')}</p>
        </div>
      </V2Surface>
    );
  } else if (aprovada) {
    corpo = (
      <V2Surface className="flex items-start gap-4">
        <ShieldCheck className="h-6 w-6 shrink-0 text-green-600" />
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('{nome} está aprovada', { nome: aprovada.name })}</h2>
          <p className="mt-1 text-sm text-gray-600">{aprovada.published === true ? t('Cadastre os planos e a chave Pix, monte a equipe e divulgue a página pública.') : t('Ela está oculta: só a equipe a vê. Cadastre os planos e a chave Pix, monte a equipe e, quando estiver pronta, publique em Página pública → Publicação.')}</p>
          <V2Button asChild className="mt-4"><Link to={fedManagePath(aprovada)}>{t('Abrir a Central da federação')}</Link></V2Button>
        </div>
      </V2Surface>
    );
  } else {
    const inicial = {
      name: recusada?.name || '', acronym: recusada?.acronym || '', slug: recusada?.slug || '', level: recusada?.level || FEDERATION_LEVEL.STATE,
      state: recusada?.state || userProfile?.state || '', city: recusada?.city || userProfile?.city || '', about: recusada?.about || '',
      site: recusada?.site || '', instagram: recusada?.instagram || '',
      contact_email: recusada?.contact_public?.email || userProfile?.email || user?.email || '', contact_phone: recusada?.contact_public?.phone || '',
      cnpj: '', legal_name: '', notes: '', accept_terms: false,
    };
    corpo = (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {recusada && (
            <V2Surface variant="compacto" className="border-red-200 p-4">
              <p className="font-bold text-ink">{t('O pedido anterior não foi aprovado')}</p>
              <p className="text-sm text-gray-600">{t('Motivo: {motivo}. Corrija e envie de novo.', { motivo: recusada.review?.reason || t('não informado') })}</p>
            </V2Surface>
          )}
          <FederationForm uid={user.uid} userName={userProfile?.platform_name || userProfile?.full_name || user?.displayName || ''} inicial={inicial} />
        </div>
        <aside className="space-y-3 lg:col-span-4">
          {VANTAGENS.map((v) => (
            <V2Surface key={v.title} variant="compacto" className="flex gap-3 p-4">
              <v.icon className="h-5 w-5 shrink-0 text-ink" />
              <div><p className="font-bold text-ink">{t(v.title)}</p><p className="text-sm text-gray-600">{t(v.text)}</p></div>
            </V2Surface>
          ))}
          <V2Surface variant="compacto" className="flex gap-3 p-4">
            <BadgeCheck className="h-5 w-5 shrink-0 text-ink" />
            <p className="text-sm text-gray-600">{t('Pode haver mais de uma federação por estado. A equipe do PickleRush marca como "Oficial" a reconhecida pela confederação, quando houver.')}</p>
          </V2Surface>
        </aside>
      </div>
    );
  }

  return (
    <V2Page className="space-y-6">
      <V2BackLink to="/federacoes">{t('Federações')}</V2BackLink>
      <V2PageIntro title={t('Abrir uma federação')} subtitle={t('Para quem representa uma federação de pickleball com CNPJ. A equipe analisa antes de abrir.')} />
      {corpo}
    </V2Page>
  );
}

export default function V2FederationApply() {
  return <FederationGate><ApplyPage /></FederationGate>;
}
