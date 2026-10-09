/**
 * Painel admin → Treino (flag `training_center`): uma porta só para as cinco
 * abas (a aba decide qual), com a visão geral no topo. Cada número da visão
 * geral leva à aba que resolve.
 *
 * `/admin/painel` não está em `<Isolada>`: o corpo vai dentro de um
 * `V2RouteBoundary`, para um defeito aqui não derrubar o aplicativo.
 */
import React from 'react';
import { BookOpenCheck, ClipboardCheck, Flag, Library } from 'lucide-react';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useTrainingSettings } from '@/modules/training/hooks/useTrainingSettings';
import { useAllTrainingItems, useTrainingReports } from '@/modules/training/hooks/useTrainingAdmin';
import { ITEM_KIND_LABELS } from '@/modules/training/domain/taxonomy';
import { AUTHOR_ROLE_LABELS } from '@/modules/training/domain/visibility';
import { cn } from '@/core/lib/utils';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import V2RouteBoundary from '@/v2/components/V2RouteBoundary';
import { adminItemCounts } from './adminTrainingView';
import AdminTrainingContent from './AdminTrainingContent';
import AdminTrainingReview from './AdminTrainingReview';
import AdminTrainingReports from './AdminTrainingReports';
import AdminTrainingSeed from './AdminTrainingSeed';
import AdminTrainingSettings from './AdminTrainingSettings';

function Numero({ icon: Icon, label, value, detalhe, alerta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-3xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink',
        alerta ? 'border-amber-200 bg-amber-50 hover:border-amber-300' : 'border-gray-100 bg-paper-pure hover:border-ink',
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </span>
      <span className="font-display text-2xl font-bold text-ink">{value}</span>
      {detalhe && <span className="truncate text-xs text-gray-500">{detalhe}</span>}
    </button>
  );
}

function VisaoGeral({ itens, denuncias, settingsQ, onTab }) {
  if (itens.isPending) return <V2Skeleton className="h-28 rounded-3xl" />;
  if (itens.isError) {
    return <V2ErrorState inline title="Os itens de treino não carregaram" onRetry={() => itens.refetch()} />;
  }
  const c = adminItemCounts(itens.data || []);
  const abertas = denuncias.isSuccess ? (denuncias.data || []).filter((r) => r.status === 'aberta').length : null;
  const porTipo = Object.entries(c.byKind).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${ITEM_KIND_LABELS[k].toLowerCase()}`).join(' · ');
  const porAutor = Object.entries(c.byRole).filter(([, n]) => n > 0).map(([r, n]) => `${n} ${AUTHOR_ROLE_LABELS[r]}`).join(' · ');
  const versao = settingsQ.isSuccess ? settingsQ.data.seed_installed_version : undefined;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero icon={Library} label="Itens" value={c.total} detalhe={porAutor || 'Nenhum item ainda'} onClick={() => onTab('treino-conteudo')} />
        <Numero icon={ClipboardCheck} label="Em revisão" value={c.pendentes} alerta={c.pendentes > 0} detalhe={c.pendentes ? 'Esperando a equipe' : 'Fila vazia'} onClick={() => onTab('treino-revisao')} />
        <Numero
          icon={Flag}
          label="Denúncias abertas"
          value={abertas ?? '—'}
          alerta={abertas > 0}
          detalhe={denuncias.isError ? 'Não carregaram' : abertas === null ? 'Carregando…' : abertas ? 'Para decidir' : 'Nada para decidir'}
          onClick={() => onTab('treino-denuncias')}
        />
        <Numero
          icon={BookOpenCheck}
          label="Biblioteca inicial"
          value={versao === undefined ? '—' : versao ? `v${versao}` : 'Não instalada'}
          detalhe={settingsQ.isError ? 'Configuração não carregou' : `${c.semente} itens da biblioteca`}
          onClick={() => onTab('treino-biblioteca')}
        />
      </div>
      {porTipo && <p className="text-xs text-gray-500">Por tipo: {porTipo}{c.ocultos ? ` · ${c.ocultos} oculto${c.ocultos === 1 ? '' : 's'}` : ''}{c.destaques ? ` · ${c.destaques} em destaque` : ''}</p>}
    </div>
  );
}

export default function AdminTrainingPanel({ tab, onTab }) {
  const identity = useTrainingIdentity();
  const settingsQ = useTrainingSettings();
  const itens = useAllTrainingItems({ enabled: identity.isAdmin });
  const denuncias = useTrainingReports({ enabled: identity.isAdmin });
  const props = { identity, settingsQ, itens, denuncias };
  return (
    <V2RouteBoundary name="admin-treino">
      <div className="space-y-6">
        <VisaoGeral itens={itens} denuncias={denuncias} settingsQ={settingsQ} onTab={onTab} />
        {tab === 'treino-conteudo' && <AdminTrainingContent {...props} />}
        {tab === 'treino-revisao' && <AdminTrainingReview {...props} />}
        {tab === 'treino-denuncias' && <AdminTrainingReports {...props} />}
        {tab === 'treino-biblioteca' && <AdminTrainingSeed {...props} />}
        {tab === 'treino-config' && <AdminTrainingSettings {...props} />}
      </div>
    </V2RouteBoundary>
  );
}
