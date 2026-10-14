/**
 * Painel admin → Mercado. As abas do Mercado (`mercado-*`): por enquanto as
 * LOJAS — a fila de aprovação e o cuidado com as que já vendem (selo de
 * verificada, suspender, reativar).
 *
 * Toda decisão avisa o dono da loja e vai para a auditoria (`reviewSeller`).
 * Os dados da empresa (razão social, CNPJ inteiro, telefone) só são lidos
 * quando o admin abre a ficha.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, ExternalLink, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { reviewSeller } from '@/modules/marketplace/services/marketService';
import { useAdminStores, useMarketMutation, useSellerPrivate } from '@/modules/marketplace/hooks/useMarket';
import { SELLER_STATUS_LABELS } from '@/modules/marketplace/domain/constants';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

const FILTROS = [
  { id: 'pending', label: 'Em análise' },
  { id: 'active', label: 'Ativas' },
  { id: 'suspended', label: 'Suspensas' },
  { id: 'rejected', label: 'Recusadas' },
];

const quando = (ts) => {
  const ms = ts?.toMillis ? ts.toMillis() : Number(ts) || 0;
  return ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};
const cnpjFmt = (c) => (String(c || '').length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c || '—');

function CompanyData({ sellerKey }) {
  const q = useSellerPrivate(sellerKey);
  if (q.isError) return <V2ErrorState inline onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={3} />;
  const p = q.data || {};
  return (
    <dl className="grid gap-x-6 gap-y-1 rounded-2xl bg-paper p-4 text-sm sm:grid-cols-3">
      <div><dt className="text-xs text-gray-500">Razão social</dt><dd className="font-medium text-ink">{p.legal_name || '—'}</dd></div>
      <div><dt className="text-xs text-gray-500">CNPJ</dt><dd className="font-medium text-ink">{cnpjFmt(p.cnpj)}</dd></div>
      <div><dt className="text-xs text-gray-500">Telefone</dt><dd className="font-medium text-ink">{p.phone || '—'}</dd></div>
    </dl>
  );
}

/** Recusar / suspender: o motivo é obrigatório, porque a pessoa vai ler. */
function ReasonDialog({ acao, loja, onClose }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useMarketMutation(({ status, reason }) => reviewSeller(loja, { status, reason }, { actor: user }));
  const recusar = acao === 'rejected';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{recusar ? 'Recusar o cadastro' : 'Suspender as vendas'}</DialogTitle>
        <DialogDescription>{loja.display_name}. {recusar ? 'A pessoa lê o motivo e pode corrigir e pedir de novo.' : 'Os anúncios saem da vitrine até você reativar.'}</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({ status: acao, reason: motivo }, {
              onSuccess: () => { toast.success(recusar ? 'Cadastro recusado. A pessoa foi avisada.' : 'Vendas suspensas. A pessoa foi avisada.'); onClose(); },
              onError: (er) => setErro(er.message),
            });
          }}
        >
          <V2Field label="Motivo" htmlFor="motivo-loja" error={erro}>
            <V2Textarea id="motivo-loja" rows={3} maxLength={300} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus
              placeholder={recusar ? 'Ex.: o CNPJ não está ativo na Receita.' : 'Ex.: pedidos pagos sem entrega.'} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>Voltar</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending}>{recusar ? 'Recusar' : 'Suspender'}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StoreRow({ loja }) {
  const { user } = useAuth();
  const [aberta, setAberta] = useState(loja.status === 'pending');
  const [motivo, setMotivo] = useState(null);
  const m = useMarketMutation((patch) => reviewSeller(loja, patch, { actor: user }));
  const agir = (patch, msg) => m.mutate(patch, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <V2Avatar name={loja.display_name} photoUrl={loja.logo_url} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
              {loja.display_name}
              {loja.verified && <BadgeCheck className="h-4 w-4 text-blue-600" aria-label="Verificada" />}
              <V2Badge tone={loja.status === 'active' ? 'green' : loja.status === 'pending' ? 'amber' : 'neutral'}>{SELLER_STATUS_LABELS[loja.status] || loja.status}</V2Badge>
            </p>
            <p className="text-xs text-gray-500">{[loja.city, loja.state].filter(Boolean).join(' · ')}{loja.cnpj_masked ? ` · CNPJ ${loja.cnpj_masked}` : ''} · desde {quando(loja.created_at)}</p>
            {loja.reject_reason && loja.status !== 'active' && <p className="mt-1 text-sm text-red-600">Motivo: {loja.reject_reason}</p>}
          </div>
          <V2Button type="button" size="sm" variant="ghost" aria-expanded={aberta} onClick={() => setAberta((x) => !x)}>{aberta ? 'Fechar ficha' : 'Ver ficha'}</V2Button>
        </div>
        {aberta && (
          <div className="space-y-3">
            {loja.bio && <p className="whitespace-pre-line text-sm text-gray-700">{loja.bio}</p>}
            <p className="text-sm text-gray-600">Devolução em até {loja.policies?.return_days ?? '—'} dias · despacha em até {loja.policies?.ship_within_hours ?? '—'} h{loja.website ? <> · <a href={loja.website} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-ink underline">site</a></> : null}</p>
            <CompanyData sellerKey={loja.id} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {loja.status === 'pending' && (
            <>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir({ status: 'active' }, 'Loja aprovada. O dono foi avisado.')}>Aprovar</V2Button>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir({ status: 'active', verified: true }, 'Loja aprovada e verificada.')} variant="secondary">Aprovar e verificar</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('rejected')}>Recusar</V2Button>
            </>
          )}
          {loja.status === 'active' && (
            <>
              <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => agir({ verified: !loja.verified }, loja.verified ? 'Selo retirado.' : 'Selo de verificada dado.')}>
                {loja.verified ? 'Tirar o selo' : 'Dar o selo de verificada'}
              </V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('suspended')}>Suspender</V2Button>
              <V2Button asChild size="sm" variant="ghost"><Link to={`/mercado/vendedor/${loja.id}`}>Ver vitrine <ExternalLink className="h-3.5 w-3.5" /></Link></V2Button>
            </>
          )}
          {loja.status === 'suspended' && (
            <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir({ status: 'active' }, 'Loja reativada. O dono foi avisado.')}>Reativar</V2Button>
          )}
        </div>
      </V2Surface>
      {motivo && <ReasonDialog acao={motivo} loja={loja} onClose={() => setMotivo(null)} />}
    </li>
  );
}

function StoresTab() {
  const q = useAdminStores();
  const [filtro, setFiltro] = useState('pending');
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={6} />;
  const todas = q.data || [];
  const lista = todas.filter((l) => l.status === filtro).sort((a, b) => (a.created_at?.toMillis?.() || 0) - (b.created_at?.toMillis?.() || 0));
  return (
    <section className="space-y-4" aria-label="Lojas do Mercado">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">Lojas</h2>
        <p className="text-sm text-gray-500">Quem vende como empresa passa por aqui antes de abrir. Confira o CNPJ na Receita antes de aprovar.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label} ({todas.filter((l) => l.status === f.id).length})</V2FilterChip>)}
      </div>
      {!lista.length ? (
        <V2EmptyState icon={filtro === 'pending' ? Store : Building2} title={filtro === 'pending' ? 'Nenhuma loja esperando' : 'Nada aqui'} description={filtro === 'pending' ? 'Quando alguém pedir para abrir uma loja, o cadastro aparece aqui.' : undefined} />
      ) : (
        <ul className="space-y-3">{lista.map((l) => <StoreRow key={l.id} loja={l} />)}</ul>
      )}
    </section>
  );
}

export default function AdminMarketPanel({ tab }) {
  if (tab === 'mercado-lojas') return <StoresTab />;
  return null;
}
