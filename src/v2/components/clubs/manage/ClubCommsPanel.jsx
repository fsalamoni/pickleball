/**
 * Comunicação do clube-associação (permissão `comms`):
 *  - Vantagens: o que o associado ganha por ser do clube (parceiro, desconto,
 *    prioridade…). A vitrine pode ir à página pública; o "como usar" e o código
 *    só chegam ao associado em dia, pelo servidor;
 *  - Comunicados: rascunho, publicado ou arquivado, para o público ou só para
 *    quem é do clube; "Avisar os associados" chama o SERVIDOR, uma vez só;
 *  - Patrocinadores: a lista que sai na página do clube;
 *  - Cupons e campanhas: o console de divulgação (`PromoMarketingConsole`) com o
 *    clube como emissor — só na página do clube, nunca na vitrine nem no início.
 */
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Gift, Handshake, Newspaper, Pause, Pencil, Pin, Play, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import { t, tk, tn } from '@/core/i18n';
import {
  BENEFIT_KIND, BENEFIT_KIND_LABELS, EMPTY_BENEFIT, EMPTY_SPONSOR, NEWS_AUDIENCE, NEWS_STATUS, SPONSORS_MAX, SPONSOR_TIER,
  benefitMetaLine, benefitState, canNotifyNews, sortNews, sortSponsors, validateBenefit, validateClubNews, validateSponsor,
} from '@/modules/clubs/domain/content';
import { NEWS_AUDIENCE_LABELS, NEWS_STATUS_LABELS, SPONSOR_TIER_LABELS } from '@/modules/federations/domain/constants';
import { newsSummaryLine } from '@/modules/federations/domain/news';
import { AssociationError } from '@/modules/clubs/services/associationService';
import {
  useBenefitSecret, useDeleteBenefit, useDeleteClubNews, useDeleteSponsor, useNotifyClubNews, useSaveBenefit, useSaveClubNews, useSaveSponsor, useSetBenefitActive,
} from '@/modules/clubs/hooks/useClubAssociation';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { isAssociationOpen } from '@/modules/clubs/domain/association';
import { clubIssuer } from '@/v2/components/promo/promoUi';
import { quando } from '@/v2/components/federations/federationUi';
import { BuscaLista, MostrarMais, useBuscaLista } from '@/v2/components/federations/manage/listTools';
import { useAvisoNaoSalvo } from '@/v2/components/federations/manage/naoSalvo';

const PromoMarketingConsole = lazy(() => import('@/v2/components/promo/PromoMarketingConsole'));

const TOM_ESTADO = { published: 'green' };
const TOM_VANTAGEM = { live: 'green', paused: 'neutral', expired: 'amber' };
const ROTULO_VANTAGEM = { live: tk('No ar'), paused: tk('Pausada'), expired: tk('Vencida') };

/* ---------------------------------------------------------------- vantagens -- */

function BenefitForm({ clubId, benefit, plans, onFechar }) {
  const segredoQ = useBenefitSecret(clubId, benefit?.id, { enabled: !!benefit?.has_secret });
  const salvar = useSaveBenefit(clubId);
  const [inicial] = useState(() => ({ ...EMPTY_BENEFIT, ...(benefit || {}), plan_ids: benefit?.plan_ids || [] }));
  const [f, setF] = useState(inicial);
  const [segredoLido, setSegredoLido] = useState(false);
  const [erros, setErros] = useState({});
  useAvisoNaoSalvo(JSON.stringify(f) !== JSON.stringify(inicial));
  // O segredo vem de outra leitura: entra uma vez só, sem atropelar o que a pessoa já digitou.
  useEffect(() => {
    if (!segredoQ.isSuccess || segredoLido) return;
    setSegredoLido(true);
    setF((x) => ({ ...x, how_to: x.how_to || segredoQ.data.how_to || '', code: x.code || segredoQ.data.code || '' }));
  }, [segredoQ.isSuccess, segredoQ.data, segredoLido]);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const alternaPlano = (id) => set({ plan_ids: f.plan_ids.includes(id) ? f.plan_ids.filter((p) => p !== id) : [...f.plan_ids, id] });
  // Editar sem ter lido o segredo regravaria o "como usar" em branco.
  const semSegredo = !!benefit?.has_secret && !segredoLido;

  function enviar(e) {
    e.preventDefault();
    const v = validateBenefit(f);
    if (!v.ok) { setErros(v.errors); return; }
    salvar.mutate({ benefitId: benefit?.id || null, input: f }, {
      onSuccess: () => { toast.success(benefit ? t('Vantagem atualizada.') : t('Vantagem criada.')); onFechar(); },
      onError: (er) => { if (er instanceof AssociationError) setErros(er.fieldErrors); toast.error(er.message); },
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="clube-vantagem-formulario">
      <V2Field label={t('Título')} htmlFor="vt-titulo" error={erros.title} required><V2Input id="vt-titulo" maxLength={80} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('Ex.: 15% na loja parceira')} /></V2Field>
      <V2Field label={t('Resumo')} htmlFor="vt-resumo" hint={t('O que a pessoa ganha, em uma ou duas frases.')}><V2Textarea id="vt-resumo" rows={2} maxLength={300} value={f.summary} onChange={(e) => set({ summary: e.target.value })} /></V2Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <V2Field label={t('Tipo')} htmlFor="vt-tipo"><V2Select id="vt-tipo" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{Object.values(BENEFIT_KIND).map((k) => <option key={k} value={k}>{t(BENEFIT_KIND_LABELS[k])}</option>)}</V2Select></V2Field>
        <V2Field label={t('Parceiro (opcional)')} htmlFor="vt-parceiro"><V2Input id="vt-parceiro" maxLength={80} value={f.partner} onChange={(e) => set({ partner: e.target.value })} /></V2Field>
        <V2Field label={t('Vale até (opcional)')} htmlFor="vt-validade" error={erros.valid_until}><V2Input id="vt-validade" type="date" value={f.valid_until} onChange={(e) => set({ valid_until: e.target.value })} /></V2Field>
      </div>
      {plans.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">{t('Para quais planos')}</legend>
          <p className="text-xs text-gray-500">{t('Nenhum marcado = vale para todos os associados em dia.')}</p>
          <div className="flex flex-wrap gap-2">
            {plans.map((p) => (
              <label key={p.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-gray-50">
                <input type="checkbox" checked={f.plan_ids.includes(p.id)} onChange={() => alternaPlano(p.id)} />{p.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="space-y-3 rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-ink">{t('Só para o associado em dia')}</p>
        <p className="text-xs text-gray-500">{t('O "como usar" e o código não aparecem na página pública: só quem tem filiação em dia os recebe.')}</p>
        {segredoQ.isError && <V2ErrorState inline title={t('Não carregou o "como usar" desta vantagem')} onRetry={() => segredoQ.refetch()} />}
        <V2Field label={t('Como usar')} htmlFor="vt-comousar"><V2Textarea id="vt-comousar" rows={3} maxLength={800} value={f.how_to} onChange={(e) => set({ how_to: e.target.value })} placeholder={t('Ex.: Diga que é do clube no caixa e mostre a carteirinha.')} /></V2Field>
        <V2Field label={t('Código (opcional)')} htmlFor="vt-codigo"><V2Input id="vt-codigo" maxLength={40} value={f.code} onChange={(e) => set({ code: e.target.value })} autoComplete="off" /></V2Field>
      </div>
      <V2Toggle id="vt-publica" checked={f.public} onChange={(v) => set({ public: v })} label={t('Mostrar na página pública do clube')} hint={t('Ligado, quem visita vê o título e o resumo como convite para se associar. Desligado, só o associado vê.')} />
      <V2Toggle id="vt-ativa" checked={f.active} onChange={(v) => set({ active: v })} label={t('No ar')} />
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" disabled={salvar.isPending || semSegredo}>{salvar.isPending ? t('Salvando…') : t('Salvar vantagem')}</V2Button>
      </div>
    </form>
  );
}

export function ClubBenefitsTab({ club, benefitsQ, plansQ }) {
  const [edicao, setEdicao] = useState(null); // null | 'nova' | vantagem
  const [apagar, setApagar] = useState(null);
  const remover = useDeleteBenefit(club.id);
  const ativar = useSetBenefitActive(club.id);
  const planNames = useMemo(() => Object.fromEntries((plansQ.data || []).map((p) => [p.id, p.name])), [plansQ.data]);
  const lista = useMemo(() => [...(benefitsQ.data || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR')), [benefitsQ.data]);

  return (
    <section className="space-y-4" aria-label={t('Vantagens do associado')} data-dica="clube-vantagens">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Vantagens do associado')}</h2>
          <p className="max-w-2xl text-sm text-gray-500">{t('O que o associado em dia ganha por ser do clube. A vitrine pode ir à página pública para atrair gente; o "como usar" e o código só chegam a quem está em dia.')}</p>
        </div>
        <V2Button type="button" onClick={() => setEdicao('nova')} data-dica="clube-vantagem-nova"><Plus className="h-4 w-4" />{t('Nova vantagem')}</V2Button>
      </div>
      {benefitsQ.isLoading && <V2Skeleton lines={3} />}
      {benefitsQ.isError && <V2ErrorState title={t('Não carregaram as vantagens')} onRetry={() => benefitsQ.refetch()} />}
      {benefitsQ.isSuccess && podeAfirmarVazio(benefitsQ) && lista.length === 0 && (
        <V2Surface><V2EmptyState icon={Gift} title={t('Nenhuma vantagem ainda')} description={t('Desconto em parceiro, prioridade em evento, brinde: o que faz valer a pena se associar.')} action={<V2Button type="button" onClick={() => setEdicao('nova')}>{t('Criar a primeira vantagem')}</V2Button>} /></V2Surface>
      )}
      {lista.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lista.map((b) => {
            const estado = benefitState(b);
            return (
              <V2Surface as="li" key={b.id} variant="compacto" className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-bold text-ink">{b.title}</p>
                  <div className="flex flex-wrap justify-end gap-1">
                    <V2Badge tone={TOM_VANTAGEM[estado]}>{t(ROTULO_VANTAGEM[estado])}</V2Badge>
                    <V2Badge tone={b.public ? 'blue' : 'neutral'}>{b.public ? t('Na página') : t('Só associados')}</V2Badge>
                  </div>
                </div>
                {b.summary && <p className="text-sm text-gray-600">{b.summary}</p>}
                {benefitMetaLine(b, planNames) && <p className="text-xs text-gray-500">{benefitMetaLine(b, planNames)}</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <V2Button type="button" size="sm" variant="secondary" onClick={() => setEdicao(b)}><Pencil className="h-4 w-4" />{t('Editar')}</V2Button>
                  <V2Button type="button" size="sm" variant="ghost" disabled={ativar.isPending} onClick={() => ativar.mutate({ benefitId: b.id, active: b.active === false }, { onSuccess: () => toast.success(b.active === false ? t('Vantagem no ar.') : t('Vantagem pausada.')), onError: (er) => toast.error(er.message) })}>
                    {b.active === false ? <><Play className="h-4 w-4" />{t('Pôr no ar')}</> : <><Pause className="h-4 w-4" />{t('Pausar')}</>}
                  </V2Button>
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => setApagar(b)} aria-label={t('Apagar {titulo}', { titulo: b.title })}><Trash2 className="h-4 w-4" /></V2Button>
                </div>
              </V2Surface>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(apagar)}
        onOpenChange={(o) => { if (!o) setApagar(null); }}
        destructive
        loading={remover.isPending}
        title={t('Apagar a vantagem "{titulo}"?', { titulo: apagar?.title || '' })}
        description={t('Ela some da página e dos associados. Para só tirar do ar por um tempo, use "Pausar".')}
        confirmLabel={t('Apagar')}
        cancelLabel={t('Voltar')}
        onConfirm={() => remover.mutate(apagar, { onSuccess: () => { setApagar(null); toast.success(t('Vantagem apagada.')); }, onError: (er) => toast.error(er.message) })}
      />
      <Dialog open={edicao != null} onOpenChange={(o) => { if (!o) setEdicao(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle>{edicao && edicao !== 'nova' ? t('Editar a vantagem') : t('Nova vantagem')}</DialogTitle>
          <DialogDescription>{t('Escreva como o associado vai enxergar.')}</DialogDescription>
          {edicao != null && <BenefitForm clubId={club.id} benefit={edicao === 'nova' ? null : edicao} plans={(plansQ.data || []).filter((p) => p.active !== false)} onFechar={() => setEdicao(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* -------------------------------------------------------------- comunicados -- */

const NOTICIA_VAZIA = { title: '', summary: '', body: '', status: NEWS_STATUS.DRAFT, audience: NEWS_AUDIENCE.PUBLIC, link: '', image_url: '', published_at: '', pinned: false };
const STATUS_DO_CLUBE = [NEWS_STATUS.DRAFT, NEWS_STATUS.PUBLISHED, NEWS_STATUS.ARCHIVED];
const CAMPOS_NOTICIA = ['title', 'summary', 'body'];

function NewsForm({ club, news, onFechar }) {
  const salvar = useSaveClubNews(club.id);
  const [inicial] = useState(() => ({ ...NOTICIA_VAZIA, ...(news || {}) }));
  const [f, setF] = useState(inicial);
  const [erros, setErros] = useState({});
  useAvisoNaoSalvo(JSON.stringify(f) !== JSON.stringify(inicial));
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };

  function enviar(e) {
    e.preventDefault();
    const v = validateClubNews(f);
    if (!v.ok) { setErros(v.errors); return; }
    salvar.mutate({ club, input: f, newsId: news?.id || null }, {
      onSuccess: () => { toast.success(news ? t('Comunicado atualizado.') : t('Comunicado criado.')); onFechar(); },
      onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); },
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="clube-comunicado-formulario">
      <V2Field label={t('Título')} htmlFor="cm-titulo" error={erros.title} required><V2Input id="cm-titulo" maxLength={140} value={f.title} onChange={(e) => set({ title: e.target.value })} /></V2Field>
      <V2Field label={t('Resumo (o que vai no aviso)')} htmlFor="cm-resumo" hint={t('Até 300 caracteres. Em branco, o aviso leva o começo do texto.')}><V2Input id="cm-resumo" maxLength={300} value={f.summary} onChange={(e) => set({ summary: e.target.value })} /></V2Field>
      <V2Field label={t('Texto')} htmlFor="cm-texto" error={erros.body} required><V2Textarea id="cm-texto" rows={8} maxLength={6000} value={f.body} onChange={(e) => set({ body: e.target.value })} /></V2Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Estado')} htmlFor="cm-estado"><V2Select id="cm-estado" value={f.status} onChange={(e) => set({ status: e.target.value })}>{STATUS_DO_CLUBE.map((v) => <option key={v} value={v}>{t(NEWS_STATUS_LABELS[v])}</option>)}</V2Select></V2Field>
        <V2Field label={t('Para quem')} htmlFor="cm-publico" hint={t('"Só filiados" aparece a quem é do clube.')}><V2Select id="cm-publico" value={f.audience} onChange={(e) => set({ audience: e.target.value })}>{Object.values(NEWS_AUDIENCE).map((v) => <option key={v} value={v}>{t(NEWS_AUDIENCE_LABELS[v])}</option>)}</V2Select></V2Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Link (opcional)')} htmlFor="cm-link" error={erros.link} hint={t('https:// ou um caminho do app, como /torneios.')}><V2Input id="cm-link" maxLength={300} value={f.link} onChange={(e) => set({ link: e.target.value })} /></V2Field>
        <V2Field label={t('Imagem (URL, opcional)')} htmlFor="cm-img" error={erros.image_url}><V2Input id="cm-img" type="url" maxLength={500} placeholder="https://" value={f.image_url} onChange={(e) => set({ image_url: e.target.value })} /></V2Field>
      </div>
      <V2Toggle id="cm-fixar" checked={f.pinned} onChange={(v) => set({ pinned: v })} label={t('Fixar no topo')} />
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="submit" disabled={salvar.isPending}>{news ? t('Salvar') : t('Criar comunicado')}</V2Button></div>
    </form>
  );
}

export function ClubNewsTab({ club, newsQ, associados = 0 }) {
  const [editando, setEditando] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // null | { tipo: 'avisar'|'apagar', n }
  const avisar = useNotifyClubNews(club.id);
  const apagar = useDeleteClubNews(club.id);
  const lista = useMemo(() => (newsQ.isSuccess ? sortNews(newsQ.data) : null), [newsQ.isSuccess, newsQ.data]);
  const busca = useBuscaLista(lista || [], CAMPOS_NOTICIA);
  return (
    <section className="space-y-4" aria-label={t('Comunicados do clube')} data-dica="clube-comunicados">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Comunicados')}</h2>
          <p className="max-w-2xl text-sm text-gray-500">{t('Publicado e público, sai na página do clube. "Só filiados" só aparece a quem é do clube. "Avisar os associados" manda um aviso a cada associado em dia, uma vez só por comunicado.')}</p>
        </div>
        <V2Button type="button" onClick={() => setEditando('nova')} data-dica="clube-comunicado-novo"><Plus className="h-4 w-4" />{t('Novo comunicado')}</V2Button>
      </div>
      {newsQ.isError && <V2ErrorState inline title={t('Não carregaram os comunicados')} onRetry={() => newsQ.refetch()} />}
      {newsQ.isLoading && <V2Skeleton lines={3} />}
      {lista && lista.length === 0 && <V2EmptyState icon={Newspaper} title={t('Nenhum comunicado ainda')} description={t('Assembleia, evento, resultado, aviso da diretoria: escreva o primeiro.')} />}
      {lista && lista.length > 0 && <BuscaLista id="cm-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar comunicado por título ou texto')} total={lista.length} achados={busca.filtrados.length} />}
      {lista && lista.length > 0 && !busca.filtrados.length && <V2EmptyState icon={Newspaper} title={t('Nenhum comunicado com esse termo')} />}
      {busca.visiveis.length > 0 && (
        <ul className="space-y-2">
          {busca.visiveis.map((n) => (
            <li key={n.id}>
              <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
                {n.pinned ? <Pin className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" /> : <Newspaper className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{n.title}<V2Badge tone={TOM_ESTADO[n.status] || 'neutral'}>{t(NEWS_STATUS_LABELS[n.status] || n.status)}</V2Badge><V2Badge tone="ink">{t(NEWS_AUDIENCE_LABELS[n.audience] || n.audience)}</V2Badge></p>
                  <p className="text-xs text-gray-500">{[n.published_at ? quando(n.published_at) : null, newsSummaryLine(n)].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canNotifyNews(n) && <V2Button type="button" size="sm" variant="secondary" disabled={avisar.isPending} onClick={() => setConfirmar({ tipo: 'avisar', n })}><Bell className="h-4 w-4" />{t('Avisar os associados')}</V2Button>}
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => setEditando(n)} aria-label={t('Editar {titulo}', { titulo: n.title })}><Pencil className="h-4 w-4" /></V2Button>
                  <V2Button type="button" size="sm" variant="ghost" disabled={apagar.isPending} onClick={() => setConfirmar({ tipo: 'apagar', n })} aria-label={t('Apagar {titulo}', { titulo: n.title })}><Trash2 className="h-4 w-4" /></V2Button>
                </div>
              </V2Surface>
            </li>
          ))}
        </ul>
      )}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
      <ConfirmDialog
        open={Boolean(confirmar)}
        onOpenChange={(o) => { if (!o) setConfirmar(null); }}
        destructive={confirmar?.tipo === 'apagar'}
        loading={avisar.isPending || apagar.isPending}
        title={confirmar?.tipo === 'avisar' ? t('Avisar os associados sobre "{titulo}"?', { titulo: confirmar.n.title }) : t('Apagar o comunicado "{titulo}"?', { titulo: confirmar?.n.title || '' })}
        description={confirmar?.tipo === 'avisar'
          ? `${associados > 0 ? tn(associados, 'O aviso vai para até {n} associado em dia, no sino e nos canais que ele escolheu.', 'O aviso vai para até {n} associados em dia, no sino e nos canais que cada um escolheu.') : t('O aviso vai para todos os associados em dia, no sino e nos canais que cada um escolheu.')} ${t('Sai uma vez só por comunicado e não dá para desfazer.')}`
          : t('O comunicado sai da página do clube. Quem já recebeu o aviso continua com ele no sino.')}
        confirmLabel={confirmar?.tipo === 'avisar' ? t('Avisar agora') : t('Apagar')}
        cancelLabel={t('Voltar')}
        onConfirm={() => {
          const { tipo, n } = confirmar;
          if (tipo === 'avisar') avisar.mutate(n.id, { onSuccess: (r) => { setConfirmar(null); toast.success(tn(r?.count || 0, 'Aviso enviado a {n} associado.', 'Aviso enviado a {n} associados.')); }, onError: (e) => toast.error(e.message) });
          else apagar.mutate(n, { onSuccess: () => { setConfirmar(null); toast.success(t('Comunicado apagado.')); }, onError: (e) => toast.error(e.message) });
        }}
      />
      <Dialog open={editando != null} onOpenChange={(o) => { if (!o) setEditando(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle>{editando && editando !== 'nova' ? t('Editar comunicado') : t('Novo comunicado')}</DialogTitle>
          <DialogDescription>{t('O que o clube quer contar. Salve como rascunho e publique quando estiver pronto.')}</DialogDescription>
          {editando != null && <NewsForm club={club} news={editando === 'nova' ? null : editando} onFechar={() => setEditando(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------ patrocinadores -- */

function SponsorForm({ clubId, sponsor, total, onFechar }) {
  const salvar = useSaveSponsor(clubId);
  const [f, setF] = useState(() => ({ ...EMPTY_SPONSOR, ...(sponsor || {}) }));
  const [erros, setErros] = useState({});
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  function enviar(e) {
    e.preventDefault();
    const v = validateSponsor(f);
    if (!v.ok) { setErros(v.errors); return; }
    salvar.mutate({ sponsorId: sponsor?.id || null, input: f, total }, {
      onSuccess: () => { toast.success(sponsor ? t('Patrocinador atualizado.') : t('Patrocinador acrescentado.')); onFechar(); },
      onError: (er) => { if (er instanceof AssociationError) setErros(er.fieldErrors); toast.error(er.message); },
    });
  }
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="clube-patrocinador-formulario">
      <V2Field label={t('Nome')} htmlFor="sp-nome" error={erros.name} required><V2Input id="sp-nome" maxLength={60} value={f.name} onChange={(e) => set({ name: e.target.value })} /></V2Field>
      <V2Field label={t('Faixa')} htmlFor="sp-faixa"><V2Select id="sp-faixa" value={f.tier} onChange={(e) => set({ tier: e.target.value })}>{Object.values(SPONSOR_TIER).map((v) => <option key={v} value={v}>{t(SPONSOR_TIER_LABELS[v])}</option>)}</V2Select></V2Field>
      <V2Field label={t('Logo (URL)')} htmlFor="sp-logo" error={erros.logo_url}><V2Input id="sp-logo" type="url" maxLength={500} placeholder="https://" value={f.logo_url} onChange={(e) => set({ logo_url: e.target.value })} /></V2Field>
      <V2Field label={t('Site (URL)')} htmlFor="sp-url" error={erros.url}><V2Input id="sp-url" type="url" maxLength={300} placeholder="https://" value={f.url} onChange={(e) => set({ url: e.target.value })} /></V2Field>
      <V2Toggle id="sp-publico" checked={f.public} onChange={(v) => set({ public: v })} label={t('Aparece na página pública')} />
      <V2Toggle id="sp-ativo" checked={f.active} onChange={(v) => set({ active: v })} label={t('Ativo')} />
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? t('Salvando…') : t('Salvar')}</V2Button></div>
    </form>
  );
}

export function ClubSponsorsTab({ club, sponsorsQ }) {
  const [edicao, setEdicao] = useState(null);
  const [apagar, setApagar] = useState(null);
  const remover = useDeleteSponsor(club.id);
  const lista = useMemo(() => sortSponsors(sponsorsQ.data || []), [sponsorsQ.data]);
  const total = (sponsorsQ.data || []).length;
  return (
    <section className="space-y-4" aria-label={t('Patrocinadores')} data-dica="clube-patrocinadores">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Patrocinadores')}</h2>
          <p className="max-w-2xl text-sm text-gray-500">{t('Saem na página do clube, por faixa. Até {n}.', { n: SPONSORS_MAX })}</p>
        </div>
        <V2Button type="button" disabled={total >= SPONSORS_MAX || !sponsorsQ.isSuccess} onClick={() => setEdicao('novo')}><Plus className="h-4 w-4" />{t('Acrescentar patrocinador')}</V2Button>
      </div>
      {sponsorsQ.isLoading && <V2Skeleton lines={3} />}
      {sponsorsQ.isError && <V2ErrorState title={t('Não carregaram os patrocinadores')} onRetry={() => sponsorsQ.refetch()} />}
      {sponsorsQ.isSuccess && podeAfirmarVazio(sponsorsQ) && lista.length === 0 && <V2Surface><V2EmptyState icon={Handshake} title={t('Nenhum patrocinador ainda')} description={t('Quem apoia o clube aparece na página, com logo e link.')} /></V2Surface>}
      {lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((s) => (
            <V2Surface as="li" key={s.id} variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
              <Handshake className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{s.name}<V2Badge tone="ink">{t(SPONSOR_TIER_LABELS[s.tier] || s.tier)}</V2Badge>{s.active === false && <V2Badge tone="neutral">{t('Inativo')}</V2Badge>}{s.public === false && <V2Badge tone="neutral">{t('Interno')}</V2Badge>}</p>
                {s.url && <p className="truncate text-xs text-gray-500">{s.url}</p>}
              </div>
              <div className="flex gap-2">
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setEdicao(s)} aria-label={t('Editar {titulo}', { titulo: s.name })}><Pencil className="h-4 w-4" /></V2Button>
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setApagar(s)} aria-label={t('Apagar {titulo}', { titulo: s.name })}><Trash2 className="h-4 w-4" /></V2Button>
              </div>
            </V2Surface>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(apagar)}
        onOpenChange={(o) => { if (!o) setApagar(null); }}
        destructive
        loading={remover.isPending}
        title={t('Remover "{titulo}"?', { titulo: apagar?.name || '' })}
        description={t('O patrocinador sai da página do clube.')}
        confirmLabel={t('Remover')}
        cancelLabel={t('Voltar')}
        onConfirm={() => remover.mutate(apagar, { onSuccess: () => { setApagar(null); toast.success(t('Patrocinador removido.')); }, onError: (er) => toast.error(er.message) })}
      />
      <Dialog open={edicao != null} onOpenChange={(o) => { if (!o) setEdicao(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle>{edicao && edicao !== 'novo' ? t('Editar patrocinador') : t('Novo patrocinador')}</DialogTitle>
          <DialogDescription>{t('Nome, faixa e, se quiser, logo e site.')}</DialogDescription>
          {edicao != null && <SponsorForm key={edicao === 'novo' ? 'novo' : edicao.id} clubId={club.id} sponsor={edicao === 'novo' ? null : edicao} total={total} onFechar={() => setEdicao(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ---------------------------------------------------------------- divulgação -- */

function ClubPromoTab({ club }) {
  return (
    <section className="space-y-4" aria-label={t('Cupons e campanhas do clube')} data-dica="clube-divulgacao">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Cupons e campanhas')}</h2>
        <p className="text-sm text-gray-500">{t('Cupons de desconto e vales (evento, produto, parceiro) e banners de campanha na página do clube. O aviso aos associados vai pelos Comunicados; o benefício só de associado fica em Vantagens.')}</p>
      </div>
      {isAssociationOpen(club) ? (
        <Suspense fallback={<V2Skeleton lines={6} />}>
          <PromoMarketingConsole issuer={clubIssuer(club)} />
        </Suspense>
      ) : (
        // Cupom e campanha são legíveis por qualquer conta logada: só a página no ar divulga.
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('Cupons e campanhas abrem depois que a associação for publicada (Configurações → Associação do clube): eles aparecem para quem visita a página.')}</p>
      )}
    </section>
  );
}

export default function ClubCommsPanel({ club, tab, benefitsQ, newsQ, sponsorsQ, plansQ, associados }) {
  if (tab === 'divulgacao') return <ClubPromoTab club={club} />;
  if (tab === 'vantagens') return <ClubBenefitsTab club={club} benefitsQ={benefitsQ} plansQ={plansQ} />;
  if (tab === 'patrocinadores') return <ClubSponsorsTab club={club} sponsorsQ={sponsorsQ} />;
  return <ClubNewsTab club={club} newsQ={newsQ} associados={associados} />;
}
