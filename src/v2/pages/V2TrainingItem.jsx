/**
 * V2TrainingItem — a FICHA de um item de treino (`/treino/item/:itemId`).
 *
 * Três desfechos da leitura, e eles NÃO se confundem:
 *  - carregando → esqueleto;
 *  - falhou (rede) → `V2ErrorState` com "Tentar de novo";
 *  - `reason: 'indisponivel'` → "Este item não está disponível para você".
 *
 * O conteúdo antigo do professor (`cc_…`) não está em `training_items`: é
 * achado entre os itens dos professores ativos da pessoa.
 *
 * Ações que dependem de dado que não carregou (favorito, domínio) não são
 * mostradas como se estivessem desligadas: aparecem só com o dado na mão.
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarPlus, CopyPlus, EyeOff, Flag, Heart, MessageCircleQuestion, NotebookPen, Pencil,
  Send, ShieldCheck, Star, Trash2,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useTrainingSettings } from '@/modules/training/hooks/useTrainingSettings';
import {
  useCoachTrainingItems, useDeleteTrainingItem, useTrainingItem, useVisibleTrainingItems,
} from '@/modules/training/hooks/useTrainingItems';
import { useMetaActions, useTrainingMeta } from '@/modules/training/hooks/useTrainingMeta';
import { useTrainingAdminActions } from '@/modules/training/hooks/useTrainingAdmin';
import { useStudentCoaches } from '@/modules/coaches/hooks/useStudents';
import { canEditItem, isAuthor, itemStatusLabel, REVIEW, VISIBILITY } from '@/modules/training/domain/visibility';
import { canShareItem } from '@/modules/training/domain/share';
import { canCopyItem } from '@/modules/training/domain/copy';
import { MASTERY, MASTERY_LABELS } from '@/modules/training/domain/evolution';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import TrainingGate from '@/v2/components/training/TrainingGate';
import TrainingItemView from '@/v2/components/training/item/TrainingItemView';
import {
  ConfirmDialog, ReasonDialog, ReportDialog, mensagemDeErro,
} from '@/v2/components/training/item/ItemActionDialogs';

const ShareDialog = lazy(() => import('@/v2/components/training/item/ShareDialog'));

const VOLTAR = '/treino?aba=biblioteca';

function Voltar() {
  return (
    <Link to={VOLTAR} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Biblioteca
    </Link>
  );
}

function Indisponivel() {
  return (
    <V2Surface>
      <V2EmptyState
        icon={EyeOff}
        title="Este item não está disponível para você"
        description="Ele pode ser privado do autor, ter sido removido ou ser só para os alunos de um professor."
        action={<V2Button asChild variant="secondary"><Link to={VOLTAR}>Ir para a biblioteca</Link></V2Button>}
      />
    </V2Surface>
  );
}

const Carregando = () => <V2Skeleton className="h-96 rounded-4xl" />;

/** O treino aponta para outros itens: só ele busca o mapa. */
function FichaDeTreino({ item, identity, aside }) {
  const { byId } = useVisibleTrainingItems(identity);
  return <TrainingItemView item={item} itemsById={byId} aside={aside} />;
}

/** Selo de estado e o recado da equipe — só para o autor e a equipe. */
function EstadoDoAutor({ item }) {
  const recusado = item.visibility === VISIBILITY.PUBLICO && item.review === REVIEW.RECUSADO;
  const tom = item.hidden ? 'red' : recusado ? 'red' : item.review === REVIEW.PENDENTE ? 'amber' : 'neutral';
  return (
    <div className="space-y-2 rounded-3xl bg-gray-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-600">Quem vê:</span>
        <V2Badge tone={tom}>{itemStatusLabel(item)}</V2Badge>
      </div>
      {item.hidden && item.hidden_reason && (
        <p className="text-sm text-gray-700"><span className="font-semibold">Motivo da equipe: </span>{item.hidden_reason}</p>
      )}
      {recusado && item.review_note && (
        <p className="text-sm text-gray-700"><span className="font-semibold">Por que não foi aprovado: </span>{item.review_note}</p>
      )}
      {recusado && !item.legacy && (
        <Link to={`/treino/item/${item.id}/editar`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink underline underline-offset-4">
          <Pencil className="h-4 w-4" aria-hidden="true" /> Editar e reenviar
        </Link>
      )}
    </div>
  );
}

function MeuDominio({ item, uid }) {
  const meta = useTrainingMeta(uid);
  const acoes = useMetaActions(uid);
  if (meta.isPending) return <V2Skeleton className="h-10 rounded-2xl" />;
  if (meta.isError) {
    return <V2ErrorState inline title="Não foi possível carregar seus favoritos" onRetry={() => meta.refetch()} />;
  }
  const favorito = (meta.data?.favorites || []).includes(item.id);
  const nivel = meta.data?.mastery?.[item.id] || null;
  const salvarFav = () => acoes.favorite.mutate({ itemId: item.id, on: !favorito }, {
    onSuccess: () => toast.success(favorito ? 'Tirado dos salvos.' : 'Salvo. Ele aparece em "Salvos" na biblioteca.'),
    onError: () => toast.error('Não foi possível salvar agora.'),
  });
  const marcar = (valor) => acoes.mastery.mutate({ itemId: item.id, level: valor === nivel ? null : valor }, {
    onError: () => toast.error('Não foi possível salvar agora.'),
  });
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <V2Button variant="secondary" size="sm" aria-pressed={favorito} onClick={salvarFav} disabled={acoes.favorite.isPending}>
        <Heart className={cn('h-4 w-4', favorito && 'fill-current text-red-500')} aria-hidden="true" />
        {favorito ? 'Salvo' : 'Salvar'}
      </V2Button>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Meu domínio deste item">
        <span className="text-sm font-semibold text-gray-600">Meu domínio:</span>
        {Object.values(MASTERY).map((m) => (
          <V2FilterChip
            key={m}
            active={nivel === m}
            aria-pressed={nivel === m}
            disabled={acoes.mastery.isPending}
            onClick={() => marcar(m)}
            className="px-3 py-1"
          >
            {MASTERY_LABELS[m]}
          </V2FilterChip>
        ))}
      </div>
    </div>
  );
}

function Acoes({ item, identity, settings, onShare, onDelete, onReport, pedidoDeEnvio }) {
  const uid = identity.uid;
  const legado = item.legacy === true;
  const autor = isAuthor(item, uid);
  const share = canShareItem(item, { uid });
  const podeEnviar = share.ok && settings?.allow_sharing !== false;
  const copia = canCopyItem(item, { uid });
  const edita = !legado && canEditItem(item, { uid, isAdmin: identity.isAdmin });
  const linkBtn = 'inline-flex items-center gap-1.5';
  return (
    <div className="space-y-4">
      {(autor || identity.isAdmin) && !legado && <EstadoDoAutor item={item} />}
      {pedidoDeEnvio && !podeEnviar && (
        <p role="status" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          {settings?.allow_sharing === false ? 'O compartilhamento de treinos está pausado no momento.' : share.reason}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <V2Button asChild size="sm" data-dica="treino-item-registrar">
          <Link to={`/treino?aba=diario&registrar=${encodeURIComponent(item.id)}`} className={linkBtn}>
            <NotebookPen className="h-4 w-4" aria-hidden="true" /> Registrar que fiz
          </Link>
        </V2Button>
        <V2Button asChild size="sm" variant="secondary" data-dica="treino-item-plano">
          <Link to={`/treino?aba=planos&adicionar=${encodeURIComponent(item.id)}`} className={linkBtn}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Pôr no plano
          </Link>
        </V2Button>
        {podeEnviar && (
          <V2Button size="sm" variant="secondary" onClick={onShare} data-dica="treino-item-enviar">
            <Send className="h-4 w-4" aria-hidden="true" /> {identity.isCoach ? 'Enviar ou indicar' : 'Indicar'}
          </V2Button>
        )}
      </div>
      <MeuDominio item={item} uid={uid} />
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        {identity.activeCoachIds.length > 0 && (
          <V2Button asChild size="sm" variant="ghost" data-dica="treino-item-perguntar">
            <Link to={`/treino?aba=duvidas&nova=1&item=${encodeURIComponent(item.id)}`} className={linkBtn}>
              <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" /> Perguntar ao professor
            </Link>
          </V2Button>
        )}
        {copia.ok && (
          <V2Button asChild size="sm" variant="ghost" data-dica="treino-item-copiar">
            <Link to={`/treino/novo?copiar=${encodeURIComponent(item.id)}`} className={linkBtn}>
              <CopyPlus className="h-4 w-4" aria-hidden="true" /> Copiar e adaptar
            </Link>
          </V2Button>
        )}
        {edita && (
          <V2Button asChild size="sm" variant="ghost">
            <Link to={`/treino/item/${item.id}/editar`} className={linkBtn}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
            </Link>
          </V2Button>
        )}
        {legado && autor && (
          <V2Button asChild size="sm" variant="ghost">
            <Link to="/aulas?aba=conteudo" className={linkBtn}><Pencil className="h-4 w-4" aria-hidden="true" /> Editar na área do professor</Link>
          </V2Button>
        )}
        {edita && (
          <V2Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
          </V2Button>
        )}
        {!autor && !legado && (
          <V2Button size="sm" variant="ghost" onClick={onReport}>
            <Flag className="h-4 w-4" aria-hidden="true" /> Denunciar
          </V2Button>
        )}
      </div>
    </div>
  );
}

/** Moderação na própria ficha (equipe da plataforma). */
function PainelDaEquipe({ item, identity, settings }) {
  const acoes = useTrainingAdminActions(identity, settings);
  const [pedido, setPedido] = useState(null); // 'ocultar' | 'recusar'
  const publico = item.visibility === VISIBILITY.PUBLICO;
  const falhou = (err) => toast.error(mensagemDeErro(err, 'Não foi possível salvar agora.'));
  return (
    <V2Surface className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Equipe da plataforma
      </h2>
      <div className="flex flex-wrap gap-2">
        {publico && item.review !== REVIEW.APROVADO && (
          <V2Button size="sm" disabled={acoes.review.isPending} onClick={() => acoes.review.mutate({ item, decision: REVIEW.APROVADO, note: '' }, {
            onSuccess: () => toast.success('Aprovado. O autor foi avisado.'), onError: falhou,
          })}
          >
            Aprovar
          </V2Button>
        )}
        {publico && item.review !== REVIEW.RECUSADO && (
          <V2Button size="sm" variant="secondary" onClick={() => setPedido('recusar')}>Recusar</V2Button>
        )}
        {item.hidden ? (
          <V2Button size="sm" variant="secondary" disabled={acoes.hide.isPending} onClick={() => acoes.hide.mutate({ item, hidden: false, reason: '' }, {
            onSuccess: () => toast.success('Visível de novo.'), onError: falhou,
          })}
          >
            Mostrar de novo
          </V2Button>
        ) : (
          <V2Button size="sm" variant="secondary" onClick={() => setPedido('ocultar')}>
            <EyeOff className="h-4 w-4" aria-hidden="true" /> Ocultar
          </V2Button>
        )}
        <V2Button size="sm" variant="ghost" disabled={acoes.feature.isPending} onClick={() => acoes.feature.mutate({ item, featured: !item.featured }, {
          onSuccess: () => toast.success(item.featured ? 'Saiu dos destaques.' : 'Em destaque na biblioteca.'), onError: falhou,
        })}
        >
          <Star className="h-4 w-4" aria-hidden="true" /> {item.featured ? 'Tirar do destaque' : 'Destacar'}
        </V2Button>
      </div>
      <ReasonDialog
        open={pedido === 'ocultar'}
        onOpenChange={(a) => !a && setPedido(null)}
        title="Ocultar este item"
        description="Ele sai da biblioteca e de quem o recebeu. O autor é avisado com o motivo."
        label="Motivo (o autor vai ler)"
        confirmLabel="Ocultar"
        required
        pending={acoes.hide.isPending}
        onConfirm={(motivo, fechar) => acoes.hide.mutate({ item, hidden: true, reason: motivo }, {
          onSuccess: () => { toast.success('Ocultado. O autor foi avisado.'); fechar(); }, onError: falhou,
        })}
      />
      <ReasonDialog
        open={pedido === 'recusar'}
        onOpenChange={(a) => !a && setPedido(null)}
        title="Recusar a publicação"
        description="O item continua do autor, só não entra na biblioteca. Ele pode editar e reenviar."
        label="O que precisa mudar (o autor vai ler)"
        confirmLabel="Recusar"
        required
        maxLength={500}
        pending={acoes.review.isPending}
        onConfirm={(nota, fechar) => acoes.review.mutate({ item, decision: REVIEW.RECUSADO, note: nota }, {
          onSuccess: () => { toast.success('Recusado. O autor foi avisado.'); fechar(); }, onError: falhou,
        })}
      />
    </V2Surface>
  );
}

function Ficha({ item, identity, settings }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const excluir = useDeleteTrainingItem(identity);
  const pedidoDeEnvio = params.get('enviar') === '1';
  const podeEnviar = canShareItem(item, { uid: identity.uid }).ok && settings?.allow_sharing !== false;
  const [enviando, setEnviando] = useState(pedidoDeEnvio && podeEnviar);
  const [apagando, setApagando] = useState(false);
  const [denunciando, setDenunciando] = useState(false);

  useEffect(() => { if (pedidoDeEnvio && podeEnviar) setEnviando(true); }, [pedidoDeEnvio, podeEnviar]);

  const fecharEnvio = (aberto) => {
    setEnviando(aberto);
    if (!aberto && pedidoDeEnvio) {
      setParams((p) => { const n = new URLSearchParams(p); n.delete('enviar'); return n; }, { replace: true });
    }
  };

  const acoes = (
    <Acoes
      item={item}
      identity={identity}
      settings={settings}
      pedidoDeEnvio={pedidoDeEnvio}
      onShare={() => setEnviando(true)}
      onDelete={() => setApagando(true)}
      onReport={() => setDenunciando(true)}
    />
  );

  return (
    <>
      <V2Surface className="p-5 sm:p-8">
        {item.kind === 'treino'
          ? <FichaDeTreino item={item} identity={identity} aside={acoes} />
          : <TrainingItemView item={item} aside={acoes} />}
      </V2Surface>
      {identity.isAdmin && !item.legacy && <PainelDaEquipe item={item} identity={identity} settings={settings} />}
      {enviando && (
        <Suspense fallback={null}>
          <ShareDialog open={enviando} onOpenChange={fecharEnvio} item={item} identity={identity} settings={settings} />
        </Suspense>
      )}
      <ReportDialog open={denunciando} onOpenChange={setDenunciando} item={item} identity={identity} />
      <ConfirmDialog
        open={apagando}
        onOpenChange={setApagando}
        title="Excluir este item?"
        description="Ele some da biblioteca, dos planos e de quem o recebeu. Não dá para desfazer."
        confirmLabel="Excluir"
        pending={excluir.isPending}
        onConfirm={() => excluir.mutate(item, {
          onSuccess: () => { toast.success('Item excluído.'); setApagando(false); navigate('/treino?aba=meus'); },
          onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível excluir agora. Tente de novo.')),
        })}
      />
    </>
  );
}

/** `cc_…`: o conteúdo antigo do professor, achado entre os itens dos professores ativos. */
function FichaLegada({ itemId, identity, settings }) {
  const vinculos = useStudentCoaches(identity.uid);
  const ids = identity.activeCoachIds;
  const conteudo = useCoachTrainingItems(ids);
  if (vinculos.isPending) return <Carregando />;
  if (vinculos.isError) {
    return <V2ErrorState title="Não foi possível abrir o item" onRetry={() => vinculos.refetch()} />;
  }
  if (ids.length === 0) return <Indisponivel />;
  if (conteudo.isPending) return <Carregando />;
  if (conteudo.isError) {
    return <V2ErrorState title="Não foi possível abrir o item" onRetry={() => conteudo.refetch()} />;
  }
  const item = (conteudo.data?.items || []).find((i) => i.id === itemId);
  if (!item) {
    // Uma fonte faltou: não dá para afirmar que o item não existe.
    if (conteudo.data?.incompleto) {
      return <V2ErrorState title="Não foi possível abrir o item" onRetry={() => conteudo.refetch()} />;
    }
    return <Indisponivel />;
  }
  return <Ficha item={item} identity={identity} settings={settings} />;
}

function FichaDoBanco({ itemId, identity, settings }) {
  const leitura = useTrainingItem(itemId);
  if (leitura.isPending) return <Carregando />;
  if (leitura.isError) {
    return (
      <V2ErrorState
        title="Não foi possível abrir o item"
        description="A conexão falhou. O item continua lá — tente de novo."
        onRetry={() => leitura.refetch()}
      />
    );
  }
  const item = leitura.data?.item;
  if (!item || leitura.data?.reason === 'indisponivel') return <Indisponivel />;
  return <Ficha item={item} identity={identity} settings={settings} />;
}

function TrainingItemPage() {
  const { itemId = '' } = useParams();
  const identity = useTrainingIdentity();
  const { settings } = useTrainingSettings();
  const legado = itemId.startsWith('cc_');
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Voltar />
      {legado
        ? <FichaLegada itemId={itemId} identity={identity} settings={settings} />
        : <FichaDoBanco itemId={itemId} identity={identity} settings={settings} />}
    </div>
  );
}

export default function V2TrainingItem() {
  return (
    <TrainingGate>
      <TrainingItemPage />
    </TrainingGate>
  );
}
