/**
 * Treino → CONTEÚDO: todos os itens de todos os autores. Busca, filtros por
 * tipo, papel do autor, visibilidade, revisão e estado; por item: abrir,
 * editar (o MESMO editor do autor, com a autoria preservada), duplicar como
 * Equipe PickleRush, destacar, ocultar/mostrar com motivo e excluir.
 *
 * Toda escrita audita e avisa o autor no serviço.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Copy, Eye, EyeOff, Pencil, Plus, Search, Star, Trash2,
} from 'lucide-react';
import { useTrainingAdminActions } from '@/modules/training/hooks/useTrainingAdmin';
import { useDeleteTrainingItem } from '@/modules/training/hooks/useTrainingItems';
import { ITEM_KINDS, ITEM_KIND_LABELS } from '@/modules/training/domain/taxonomy';
import {
  AUTHOR_ROLE_LABELS, REVIEW_LABELS, VISIBILITY_LABELS, VISIBILITY,
} from '@/modules/training/domain/visibility';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2SearchInput, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import ItemCard from '@/v2/components/training/ItemCard';
import { ConfirmDialog, ReasonDialog, mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';
import {
  ADMIN_ESTADOS, EMPTY_ADMIN_FILTERS, adminItemCounts, filterAdminItems, openReportsByItem, sortAdminItems,
} from './adminTrainingView';

const PAGINA = 60;

/** O que o admin precisa saber antes de excluir (a mídia de outra pessoa não sai junto). */
function textoDeExclusao(item, uid) {
  const partes = ['O item some para todos, e os envios e indicações dele são apagados. Não dá para desfazer.'];
  const uploads = (item.media || []).filter((m) => m?.source === 'upload' && m.path);
  const meus = uploads.filter((m) => String(m.path).startsWith(`treino/${uid}/`)).length;
  if (meus) partes.push('Os arquivos que você enviou para ele são apagados junto.');
  if (uploads.length > meus) partes.push('Os vídeos e imagens que o autor enviou ficam no armazenamento: só quem enviou um arquivo pode apagá-lo.');
  if (item.seed_slug) partes.push('É da biblioteca inicial: a atualização não o recria (dá para restaurar na aba Biblioteca inicial).');
  return partes.join(' ');
}

function Acoes({ item, identity, acoes, excluir }) {
  const [pedido, setPedido] = useState(null); // 'ocultar' | 'excluir'
  const falhou = (err) => toast.error(mensagemDeErro(err, 'Não foi possível salvar agora.'));
  return (
    <>
      <V2Button asChild size="sm" variant="secondary">
        <Link to={`/treino/item/${item.id}/editar`}><Pencil className="h-4 w-4" aria-hidden="true" /> Editar</Link>
      </V2Button>
      <V2Button asChild size="sm" variant="ghost">
        <Link to={`/treino/novo?copiar=${item.id}&como=plataforma`}><Copy className="h-4 w-4" aria-hidden="true" /> Duplicar</Link>
      </V2Button>
      <V2Button
        size="sm"
        variant="ghost"
        aria-pressed={!!item.featured}
        disabled={acoes.feature.isPending}
        onClick={() => acoes.feature.mutate({ item, featured: !item.featured }, {
          onSuccess: () => toast.success(item.featured ? 'Saiu dos destaques.' : 'Em destaque na biblioteca.'), onError: falhou,
        })}
      >
        <Star className="h-4 w-4" aria-hidden="true" /> {item.featured ? 'Tirar destaque' : 'Destacar'}
      </V2Button>
      {item.hidden ? (
        <V2Button size="sm" variant="ghost" disabled={acoes.hide.isPending} onClick={() => acoes.hide.mutate({ item, hidden: false, reason: '' }, {
          onSuccess: () => toast.success('Visível de novo. O autor foi avisado.'), onError: falhou,
        })}
        >
          <Eye className="h-4 w-4" aria-hidden="true" /> Mostrar
        </V2Button>
      ) : (
        <V2Button size="sm" variant="ghost" onClick={() => setPedido('ocultar')}>
          <EyeOff className="h-4 w-4" aria-hidden="true" /> Ocultar
        </V2Button>
      )}
      <V2Button size="sm" variant="ghost" onClick={() => setPedido('excluir')}>
        <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
      </V2Button>
      <ReasonDialog
        open={pedido === 'ocultar'}
        onOpenChange={(a) => !a && setPedido(null)}
        title="Ocultar este item"
        description="Ele sai da biblioteca e de quem o recebeu; o autor continua vendo. O autor é avisado com o motivo."
        label="Motivo (o autor vai ler)"
        confirmLabel="Ocultar"
        required
        pending={acoes.hide.isPending}
        onConfirm={(motivo, fechar) => acoes.hide.mutate({ item, hidden: true, reason: motivo }, {
          onSuccess: () => { toast.success('Ocultado. O autor foi avisado.'); fechar(); }, onError: falhou,
        })}
      />
      <ConfirmDialog
        open={pedido === 'excluir'}
        onOpenChange={(a) => !a && setPedido(null)}
        title={`Excluir “${item.title}”?`}
        description={textoDeExclusao(item, identity.uid)}
        confirmLabel="Excluir"
        pending={excluir.isPending}
        onConfirm={() => excluir.mutate(item, {
          onSuccess: () => { toast.success('Item excluído.'); setPedido(null); }, onError: falhou,
        })}
      />
    </>
  );
}

function Selo({ item, denuncias }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <V2Badge tone={item.visibility === VISIBILITY.PUBLICO ? 'blue' : 'neutral'}>{VISIBILITY_LABELS[item.visibility] || item.visibility}</V2Badge>
      {item.visibility === VISIBILITY.PUBLICO && (
        <V2Badge tone={item.review === 'pendente' ? 'amber' : item.review === 'recusado' ? 'red' : 'green'}>{REVIEW_LABELS[item.review] || item.review}</V2Badge>
      )}
      {item.hidden && <V2Badge tone="red">Oculto</V2Badge>}
      {item.seed_slug && <V2Badge tone="ink">Biblioteca inicial{item.seed_customized ? ' · editado' : ''}</V2Badge>}
      {denuncias > 0 && <V2Badge tone="red">{denuncias} denúncia{denuncias === 1 ? '' : 's'}</V2Badge>}
      {item.hidden && item.hidden_reason && <span className="w-full text-xs text-gray-500">Motivo: {item.hidden_reason}</span>}
    </div>
  );
}

export default function AdminTrainingContent({ identity, settingsQ, itens, denuncias }) {
  const acoes = useTrainingAdminActions(identity, settingsQ.settings);
  const excluir = useDeleteTrainingItem(identity);
  const [f, setF] = useState(EMPTY_ADMIN_FILTERS);
  const [limite, setLimite] = useState(PAGINA);
  const set = (patch) => { setLimite(PAGINA); setF((x) => ({ ...x, ...patch })); };

  const todos = useMemo(() => sortAdminItems(itens.data || []), [itens.data]);
  const lista = useMemo(() => filterAdminItems(todos, f), [todos, f]);
  const contagem = useMemo(() => adminItemCounts(filterAdminItems(todos, { ...f, estado: '' })), [todos, f]);
  const porItem = useMemo(() => openReportsByItem(denuncias.data || []), [denuncias.data]);

  const filtrando = Object.entries(f).some(([, v]) => v);
  const chips = [['', 'Todos', contagem.total], ['ocultos', ADMIN_ESTADOS.ocultos, contagem.ocultos], ['destaques', ADMIN_ESTADOS.destaques, contagem.destaques], ['semente', ADMIN_ESTADOS.semente, contagem.semente], ['ia', ADMIN_ESTADOS.ia, null]];

  return (
    <section className="space-y-4" aria-label="Conteúdo de treino" data-dica="admin-treino-conteudo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500">
          Todos os treinos e drills da plataforma, de todos os autores. Editar mantém a autoria; ocultar e excluir avisam o autor.
        </p>
        <V2Button asChild>
          <Link to="/treino/novo?como=plataforma"><Plus className="h-4 w-4" aria-hidden="true" /> Criar como Equipe PickleRush</Link>
        </V2Button>
      </div>

      <V2Surface className="space-y-3">
        <V2SearchInput icon={Search} aria-label="Buscar itens" placeholder="Buscar por título, autor ou código" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <V2Select aria-label="Tipo" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="">Todos os tipos</option>
            {ITEM_KINDS.map((k) => <option key={k} value={k}>{ITEM_KIND_LABELS[k]}</option>)}
          </V2Select>
          <V2Select aria-label="Autor" value={f.role} onChange={(e) => set({ role: e.target.value })}>
            <option value="">Todos os autores</option>
            {Object.entries(AUTHOR_ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{v === 'plataforma' ? 'Equipe PickleRush' : l}</option>)}
          </V2Select>
          <V2Select aria-label="Visibilidade" value={f.visibility} onChange={(e) => set({ visibility: e.target.value })}>
            <option value="">Qualquer visibilidade</option>
            {Object.entries(VISIBILITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </V2Select>
          <V2Select aria-label="Revisão" value={f.review} onChange={(e) => set({ review: e.target.value })}>
            <option value="">Qualquer revisão</option>
            {['pendente', 'aprovado', 'recusado'].map((v) => <option key={v} value={v}>{REVIEW_LABELS[v]}</option>)}
          </V2Select>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Recorte">
          {chips.map(([valor, rotulo, n]) => (
            <V2FilterChip key={valor || 'todos'} active={f.estado === valor} aria-pressed={f.estado === valor} onClick={() => set({ estado: valor })}>
              {rotulo}{itens.isSuccess && n !== null ? ` (${n})` : ''}
            </V2FilterChip>
          ))}
          {filtrando && <V2Button size="sm" variant="ghost" onClick={() => set(EMPTY_ADMIN_FILTERS)}>Limpar filtros</V2Button>}
        </div>
      </V2Surface>

      {itens.isPending ? <V2Skeleton className="h-64 rounded-4xl" />
        : itens.isError ? <V2Surface><V2ErrorState title="Os itens de treino não carregaram" onRetry={() => itens.refetch()} /></V2Surface>
          : podeAfirmarVazio(itens) && !lista.length ? (
            <V2Surface>
              <V2EmptyState
                icon={Search}
                title={filtrando ? 'Nenhum item com esses filtros' : 'Nenhum item de treino ainda'}
                description={filtrando ? 'Tire um filtro ou mude a busca.' : 'Instale a biblioteca inicial ou crie o primeiro item como Equipe PickleRush.'}
                action={filtrando ? <V2Button variant="secondary" onClick={() => set(EMPTY_ADMIN_FILTERS)}>Limpar filtros</V2Button> : null}
              />
            </V2Surface>
          ) : (
            <>
              <p className="text-sm text-gray-500" aria-live="polite">
                {lista.length === todos.length ? `${todos.length} itens` : `${lista.length} de ${todos.length} itens`}
                {denuncias.isError ? ' · as denúncias não carregaram' : ''}
              </p>
              <ul className="grid gap-3 lg:grid-cols-2">
                {lista.slice(0, limite).map((item) => (
                  <li key={item.id}>
                    <ItemCard
                      item={item}
                      extra={<Selo item={item} denuncias={porItem.get(item.id) || 0} />}
                      actions={<Acoes item={item} identity={identity} acoes={acoes} excluir={excluir} />}
                    />
                  </li>
                ))}
              </ul>
              {lista.length > limite && (
                <div className="flex justify-center">
                  <V2Button variant="secondary" onClick={() => setLimite((n) => n + PAGINA)}>Mostrar mais ({lista.length - limite})</V2Button>
                </div>
              )}
            </>
          )}
    </section>
  );
}
