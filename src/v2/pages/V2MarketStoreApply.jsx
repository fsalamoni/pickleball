/**
 * V2MarketStoreApply — "Abrir minha loja" (`/mercado/loja/abrir`).
 *
 * Loja é quem vende como empresa (com CNPJ). O cadastro vai para análise da
 * equipe do PickleRush; aprovada, a loja aparece em "Lojas" na vitrine e no
 * "Vendendo como" do painel. Recusada, a pessoa lê o motivo, corrige e pede
 * de novo. CNPJ completo, razão social e telefone ficam na parte privada:
 * em público só sai o CNPJ pela metade.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, PackageCheck, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { BR_UFS } from '@/core/domain/ufs';
import { sellerKeyFor, validateStoreApplication } from '@/modules/marketplace/domain/seller';
import { applyStore } from '@/modules/marketplace/services/marketService';
import { useMarketMutation, useMarketSettings, useSeller, useSellerPrivate } from '@/modules/marketplace/hooks/useMarket';
import {
  V2BackLink, V2Button, V2ErrorState, V2Field, V2Input, V2PageIntro, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Page,
} from '@/v2/ui/primitives';
import { rolarAte } from '@/v2/ui/rolarAte';
import { MarketGate } from '@/v2/components/marketplace/marketUi';
import { t, tk } from '@/core/i18n';

const VANTAGENS = [
  { icon: Store, title: tk('Vitrine própria'), text: tk('Logo, capa, políticas e todos os seus produtos numa página.') },
  { icon: BadgeCheck, title: tk('Selo de verificada'), text: tk('A equipe confere o CNPJ e pode dar o selo que o comprador vê.') },
  { icon: PackageCheck, title: tk('Sem comissão'), text: tk('O Pix vai direto para a sua conta, pedido a pedido.') },
];

function StoreForm({ uid, inicial }) {
  const [f, setF] = useState(inicial);
  const [erros, setErros] = useState({});
  const m = useMarketMutation(({ input }) => applyStore(uid, input));
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const enviar = (e) => {
    e.preventDefault();
    const r = validateStoreApplication(f);
    if (!r.ok) {
      setErros(r.errors);
      requestAnimationFrame(() => rolarAte(document.querySelector('#form-loja .text-red-500'), { reservaInferior: 96 }));
      return;
    }
    m.mutate({ input: f }, {
      onSuccess: () => { toast.success(t('Cadastro enviado. A equipe avisa assim que analisar.')); window.scrollTo?.(0, 0); },
      onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); },
    });
  };
  return (
    <form id="form-loja" onSubmit={enviar} className="space-y-6" noValidate>
      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('A loja')}</h2>
        <V2Field label={t('Nome da loja')} htmlFor="l-nome" error={erros.display_name} hint={t('Como aparece para os compradores.')}>
          <V2Input id="l-nome" maxLength={60} value={f.display_name} onChange={(e) => set({ display_name: e.target.value })} />
        </V2Field>
        <V2Field label={t('Sobre a loja')} htmlFor="l-bio" hint={t('O que vende, há quanto tempo, onde fica. Até 600 caracteres.')}>
          <V2Textarea id="l-bio" rows={4} maxLength={600} value={f.bio} onChange={(e) => set({ bio: e.target.value })} />
        </V2Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <V2Field label={t('Cidade')} htmlFor="l-cidade" error={erros.city}>
            <V2Input id="l-cidade" maxLength={60} value={f.city} onChange={(e) => set({ city: e.target.value })} />
          </V2Field>
          <V2Field label={t('UF')} htmlFor="l-uf">
            <V2Select id="l-uf" value={f.state} onChange={(e) => set({ state: e.target.value })}>
              <option value="">—</option>
              {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </V2Select>
          </V2Field>
        </div>
        <V2Field label={t('Site (opcional)')} htmlFor="l-site" error={erros.website}>
          <V2Input id="l-site" type="url" placeholder={t('https://')} value={f.website} onChange={(e) => set({ website: e.target.value })} />
        </V2Field>
      </V2Surface>

      <V2Surface className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{t('Dados da empresa')}</h2>
          <p className="text-sm text-gray-500">{t('Só a equipe do PickleRush vê. Em público aparece o CNPJ pela metade.')}</p>
        </div>
        <V2Field label={t('Razão social')} htmlFor="l-razao" error={erros.legal_name}>
          <V2Input id="l-razao" maxLength={120} value={f.legal_name} onChange={(e) => set({ legal_name: e.target.value })} />
        </V2Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <V2Field label={t('CNPJ')} htmlFor="l-cnpj" error={erros.cnpj}>
            <V2Input id="l-cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" value={f.cnpj} onChange={(e) => set({ cnpj: e.target.value })} />
          </V2Field>
          <V2Field label={t('Telefone')} htmlFor="l-tel" error={erros.phone}>
            <V2Input id="l-tel" type="tel" inputMode="tel" placeholder="(00) 00000-0000" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
          </V2Field>
        </div>
      </V2Surface>

      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('Políticas')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <V2Field label={t('Dias para devolução')} htmlFor="l-dev" error={erros.return_days} hint={t('Mínimo de 7 dias (Código de Defesa do Consumidor).')}>
            <V2Input id="l-dev" type="number" min={7} max={90} value={f.return_days} onChange={(e) => set({ return_days: e.target.value })} />
          </V2Field>
          <V2Field label={t('Despacha em até')} htmlFor="l-desp" hint={t('Horas depois do pagamento confirmado.')}>
            <V2Select id="l-desp" value={String(f.ship_within_hours)} onChange={(e) => set({ ship_within_hours: e.target.value })}>
              {[24, 48, 72, 120].map((h) => <option key={h} value={h}>{h < 48 ? t('24 horas') : t('{n} dias', { n: h / 24 })}</option>)}
            </V2Select>
          </V2Field>
        </div>
        <label htmlFor="l-termos" className="flex items-start gap-3 text-sm text-gray-700">
          <input id="l-termos" type="checkbox" className="mt-1 h-5 w-5 accent-ink" checked={Boolean(f.accept_terms)} onChange={(e) => set({ accept_terms: e.target.checked })} />
          <span>Li e aceito os <Link to="/legal/termos-de-uso" className="font-bold text-ink underline">Termos de Uso</Link>, os <Link to="/legal/termos-mercado" className="font-bold text-ink underline">Termos Gerais do Mercado</Link> e os <Link to="/legal/termos-vendedor-mercado" className="font-bold text-ink underline">Termos do Vendedor</Link>, e respondo, de forma exclusiva, pelos produtos que vendo, pela entrega e pelos documentos da venda.</span>
        </label>
        {erros.accept_terms && <p className="text-sm font-medium text-red-500">{erros.accept_terms}</p>}
      </V2Surface>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-100 bg-paper-pure/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <V2Button type="submit" className="w-full sm:w-auto" disabled={m.isPending}>{m.isPending ? t('Enviando…') : t('Enviar para análise')}</V2Button>
      </div>
    </form>
  );
}

function ApplyPage() {
  const { user, userProfile } = useAuth();
  const key = user ? sellerKeyFor('store', user.uid) : '';
  const sq = useSeller(key);
  const loja = sq.data;
  const priv = useSellerPrivate(key, { enabled: loja?.status === 'rejected' });
  const settings = useMarketSettings();

  let corpo;
  if (sq.isError || settings.isError) corpo = <V2ErrorState onRetry={() => { sq.refetch(); settings.refetch(); }} />;
  else if (sq.isLoading || settings.isLoading || (loja?.status === 'rejected' && priv.isLoading)) corpo = <V2Skeleton className="h-96" />;
  else if (loja?.status === 'pending') {
    corpo = (
      <V2Surface className="flex items-start gap-4">
        <Clock className="h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('{loja} está em análise', { loja: loja.display_name })}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('A equipe do PickleRush confere os dados e avisa pelo sino. Enquanto isso, você pode vender como pessoa.')}</p>
          <V2Button asChild variant="secondary" className="mt-4"><Link to="/mercado/vender">{t('Ir para o painel de vendas')}</Link></V2Button>
        </div>
      </V2Surface>
    );
  } else if (loja?.status === 'active') {
    corpo = (
      <V2Surface className="flex items-start gap-4">
        <ShieldCheck className="h-6 w-6 shrink-0 text-green-600" />
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('{loja} está aberta', { loja: loja.display_name })}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('Anuncie, responda e acompanhe as vendas pelo painel.')}</p>
          <V2Button asChild className="mt-4"><Link to={`/mercado/vender?como=${key}`}>{t('Abrir o painel da loja')}</Link></V2Button>
        </div>
      </V2Surface>
    );
  } else if (loja?.status === 'suspended') {
    corpo = (
      <V2Surface>
        <h2 className="font-display text-xl font-bold text-ink">{t('As vendas de {loja} estão suspensas', { loja: loja.display_name })}</h2>
        <p className="mt-1 text-sm text-gray-600">{loja.reject_reason || t('Fale com o suporte para entender o motivo.')}</p>
      </V2Surface>
    );
  } else if (!settings.data?.stores_enabled) {
    corpo = <V2Surface><p className="text-gray-600">{t('O cadastro de lojas está fechado no momento. Você pode vender como pessoa pelo')} <Link to="/mercado/vender" className="font-bold text-ink underline">{t('painel de vendas')}</Link>.</p></V2Surface>;
  } else {
    const p = priv.data || {};
    const inicial = {
      display_name: loja?.display_name || '', bio: loja?.bio || '', city: loja?.city || userProfile?.city || '', state: loja?.state || userProfile?.state || '',
      website: loja?.website || '', legal_name: p.legal_name || '', cnpj: p.cnpj || '', phone: p.phone || '',
      return_days: loja?.policies?.return_days ?? 7, ship_within_hours: loja?.policies?.ship_within_hours ?? 48, accept_terms: false,
    };
    corpo = (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {loja?.status === 'rejected' && (
            <V2Surface variant="compacto" className="border-red-200 p-4">
              <p className="font-bold text-ink">{t('O cadastro anterior não foi aprovado')}</p>
              <p className="text-sm text-gray-600">{t('Motivo: {motivo}. Corrija e envie de novo.', { motivo: loja.reject_reason || t('não informado') })}</p>
            </V2Surface>
          )}
          <StoreForm uid={user.uid} inicial={inicial} />
        </div>
        <aside className="space-y-3 lg:col-span-4">
          {VANTAGENS.map((v) => (
            <V2Surface key={v.title} variant="compacto" className="flex gap-3 p-4">
              <v.icon className="h-5 w-5 shrink-0 text-ink" />
              <div><p className="font-bold text-ink">{t(v.title)}</p><p className="text-sm text-gray-600">{t(v.text)}</p></div>
            </V2Surface>
          ))}
          <p className="px-1 text-xs text-gray-500">{t('Vende como pessoa ou professor? Não precisa de loja: use o')} <Link to="/mercado/vender" className="font-bold underline">{t('painel de vendas')}</Link>.</p>
        </aside>
      </div>
    );
  }

  return (
    <V2Page className="space-y-6">
      <V2BackLink to="/mercado/vender">{t('Painel de vendas')}</V2BackLink>
      <V2PageIntro title={t('Abrir minha loja')} subtitle={t('Para quem vende como empresa, com CNPJ. A equipe analisa antes de abrir.')} />
      {corpo}
    </V2Page>
  );
}

export default function V2MarketStoreApply() {
  return <MarketGate><ApplyPage /></MarketGate>;
}
